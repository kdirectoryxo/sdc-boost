import { ref, onUnmounted } from 'vue';
import { websocketManager } from '@/lib/websocket-manager';
import { typingStateManager } from '@/lib/websocket-handlers';
import { countersManager } from '@/lib/counters-manager';
import { refreshLatestPage } from '@/lib/message-service';
import { useChatState } from './useChatState';
import { useChatMessages } from './useChatMessages';
import { useChatFolders } from './useChatFolders';

export function useChatWebSocket() {
  const { selectedChat, chatList } = useChatState();
  const { messages, optimisticMessages, optimisticMessageTempIds } = useChatMessages();
  const { refreshFolderCounts } = useChatFolders();
  
  const isWebSocketConnected = ref(false);
  const typingStates = ref<Map<string, boolean>>(new Map()); // Map of groupId -> isTyping
  const messengerCounter = ref<number>(0); // Track messenger counter from counters manager
  
  // Cleanup references
  let typingUnsubscribe: (() => void) | null = null;
  let connectionCheckInterval: ReturnType<typeof setInterval> | null = null;
  let countersUnsubscribe: (() => void) | null = null;
  
  /**
   * Set up WebSocket event listeners
   */
  function setupEventListeners() {
    // Update WebSocket connection status
    const updateConnectionStatus = () => {
      isWebSocketConnected.value = websocketManager.connected;
    };
    updateConnectionStatus();
    
    // Check connection status periodically
    connectionCheckInterval = setInterval(updateConnectionStatus, 1000);

    // Listen for typing state changes
    typingUnsubscribe = typingStateManager.onTypingChange((groupId, state) => {
      typingStates.value.set(groupId, state?.isTyping || false);
    });

    // Listen for counter updates - use raw API messenger counter (counts chats, not messages)
    countersUnsubscribe = countersManager.onUpdate((counters) => {
      // Always use raw API counter instead of calculated value from local chats
      const rawApiCount = countersManager.getRawApiMessengerCounter();
      if (rawApiCount !== null) {
        messengerCounter.value = rawApiCount;
      } else {
        // Fallback to counters.messenger if raw API counter not available yet (initial load)
        messengerCounter.value = counters.messenger || 0;
      }
    });
    
    // Initialize counter value - use raw API messenger counter
    const rawApiCount = countersManager.getRawApiMessengerCounter();
    if (rawApiCount !== null) {
      messengerCounter.value = rawApiCount;
    } else {
      // Fallback to counters.messenger if raw API counter not available yet
      const currentCounters = countersManager.getCounters();
      if (currentCounters) {
        messengerCounter.value = currentCounters.messenger || 0;
      }
    }

    // Listen for new message events
    const handleNewMessage = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { chat, groupId, message } = customEvent.detail;
      
      // Check if this message has a tempId that matches an optimistic message
      const tempId = (message as any)?.tempId;
      let matchedTempId: string | null = null;
      
      if (tempId && optimisticMessages.value.has(tempId)) {
        // This is a confirmation of an optimistic message via tempId
        matchedTempId = tempId;
        const optimisticMsg = optimisticMessages.value.get(tempId);
        if (optimisticMsg) {
          // Find and replace the optimistic message
          const optimisticIndex = messages.value.findIndex(msg => {
            const msgTempId = msg.extra1?.match(/__tempId:(.+?)__/)?.[1];
            return msgTempId === tempId;
          });
          
          if (optimisticIndex !== -1) {
            // Remove optimistic message - the real one will come from refreshLatestPage
            messages.value.splice(optimisticIndex, 1);
          }
          
          // Clean up tracking
          optimisticMessages.value.delete(tempId);
          optimisticMessageTempIds.value.delete(tempId);
        }
      } else if (message && (message as any).message && (message as any).db_id) {
        // No tempId, but try to match by content and timestamp
        // This handles cases where the server doesn't echo back the tempId
        const messageText = (message as any).message;
        const messageDate2 = (message as any).date2 || Math.floor(new Date((message as any).time || (message as any).datetime).getTime() / 1000);
        const messageDbId = (message as any).db_id;
        
        // Get current user's db_id to check if this is our own message
        const { getCurrentDBId } = await import('@/lib/sdc-api/utils');
        const currentDbId = getCurrentDBId();
        
        // Only try to match if this is our own message (sender === 0 or db_id matches)
        if (currentDbId && parseInt(currentDbId) === messageDbId) {
          // Try to find matching optimistic message
          for (const [optTempId, optMsg] of optimisticMessages.value.entries()) {
            if (optMsg.message === messageText && Math.abs(optMsg.date2 - messageDate2) < 30) {
              matchedTempId = optTempId;
              console.log(`[useChatWebSocket] Matched optimistic message ${optTempId} by content and timestamp`);
              
              // Remove optimistic message
              const optimisticIndex = messages.value.findIndex(msg => {
                const msgTempId = msg.extra1?.match(/__tempId:(.+?)__/)?.[1];
                return msgTempId === optTempId;
              });
              
              if (optimisticIndex !== -1) {
                messages.value.splice(optimisticIndex, 1);
              }
              
              // Clean up tracking
              optimisticMessages.value.delete(optTempId);
              optimisticMessageTempIds.value.delete(optTempId);
              break;
            }
          }
        }
      }
      
      if (chat) {
        // Update chat in list if it exists
        const index = chatList.value.findIndex(c => String(c.group_id) === String(groupId));
        if (index !== -1) {
          // Optimistically move chat to top if it's not already there
          if (index > 0) {
            chatList.value.splice(index, 1);
            chatList.value.unshift(chat);
          } else {
            chatList.value[index] = chat;
          }
        } else {
          // New chat - reload from storage
          const { chatStorage } = await import('@/lib/chat-storage');
          const allChats = await chatStorage.getAllChats();
          chatList.value = allChats;
        }
        
        // Refresh folder counts after chat update
        await refreshFolderCounts();
      } else {
        // Unknown chat - refresh to get it
        const { chatStorage } = await import('@/lib/chat-storage');
        const allChats = await chatStorage.getAllChats();
        chatList.value = allChats;
      }
      
      // If this message is for the currently selected chat, refresh page 0 in background
      if (selectedChat.value && String(selectedChat.value.group_id) === String(groupId)) {
        // Refresh latest page (page 0) in background to get any updates
        refreshLatestPage(selectedChat.value, (updatedMessages) => {
          // Try to match optimistic messages with real messages
          const matchedTempIds = new Set<string>();
          
          // For each optimistic message, try to find a matching real message
          optimisticMessages.value.forEach((optimisticMsg, tempId) => {
            const matchingRealMessage = updatedMessages.find(real => {
              // Match by: same message content, same sender (0 = current user), and timestamp within 30 seconds
              return real.message === optimisticMsg.message &&
                     real.sender === 0 && // Only match own messages
                     Math.abs(real.date2 - optimisticMsg.date2) < 30; // Allow 30 second window
            });
            
            if (matchingRealMessage) {
              matchedTempIds.add(tempId);
              console.log(`[useChatWebSocket] Matched optimistic message ${tempId} with real message ${matchingRealMessage.message_id}`);
            }
          });
          
          // Remove matched optimistic messages from tracking
          matchedTempIds.forEach(tempId => {
            optimisticMessages.value.delete(tempId);
            optimisticMessageTempIds.value.delete(tempId);
          });
          
          // Filter out optimistic messages that were matched
          const remainingOptimisticMsgs = Array.from(optimisticMessages.value.values()).filter(msg => {
            const msgTempId = msg.extra1?.match(/__tempId:(.+?)__/)?.[1];
            return msgTempId && !matchedTempIds.has(msgTempId);
          });
          
          // Combine and deduplicate
          const allMessages = [...remainingOptimisticMsgs, ...updatedMessages];
          const uniqueMessages = allMessages.filter((msg, index, self) => {
            if (msg.message_id > 0) {
              // Real message - check by message_id
              return index === self.findIndex(m => m.message_id === msg.message_id && m.message_id > 0);
            } else {
              // Optimistic message - check by tempId
              const msgTempId = msg.extra1?.match(/__tempId:(.+?)__/)?.[1];
              if (msgTempId) {
                return index === self.findIndex(m => {
                  const mTempId = m.extra1?.match(/__tempId:(.+?)__/)?.[1];
                  return mTempId === msgTempId;
                });
              }
              return true;
            }
          });
          
          // Sort by date2
          uniqueMessages.sort((a, b) => a.date2 - b.date2);
          
          messages.value = uniqueMessages;
        }).catch(console.error);
      }
    };

    // Listen for seen events
    const handleSeen = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { chat, groupId } = customEvent.detail;
      if (chat) {
        const index = chatList.value.findIndex(c => String(c.group_id) === String(groupId));
        if (index !== -1) {
          chatList.value[index] = chat;
        }
        
        // Optimistically update seen status for messages in the currently selected chat
        if (selectedChat.value && String(selectedChat.value.group_id) === String(groupId)) {
          // Update all own messages to seen (sender === 0)
          messages.value = messages.value.map(msg => {
            if (msg.sender === 0 && msg.seen === 0) {
              return { ...msg, seen: 1 };
            }
            return msg;
          });
        }
        
        // Refresh folder counts after seen event (unread_counter may have changed)
        await refreshFolderCounts();
      }
    };

    window.addEventListener('sdc-boost:new-message', handleNewMessage);
    window.addEventListener('sdc-boost:chat-seen', handleSeen);

    // Store cleanup functions
    (window as any).__sdcBoostChatDialogCleanup = () => {
      window.removeEventListener('sdc-boost:new-message', handleNewMessage);
      window.removeEventListener('sdc-boost:chat-seen', handleSeen);
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
      }
    };
  }
  
  /**
   * Clean up event listeners
   */
  function cleanupEventListeners() {
    if (typingUnsubscribe) {
      typingUnsubscribe();
      typingUnsubscribe = null;
    }
    
    if (countersUnsubscribe) {
      countersUnsubscribe();
      countersUnsubscribe = null;
    }
    
    if (connectionCheckInterval) {
      clearInterval(connectionCheckInterval);
      connectionCheckInterval = null;
    }
    
    if ((window as any).__sdcBoostChatDialogCleanup) {
      (window as any).__sdcBoostChatDialogCleanup();
      delete (window as any).__sdcBoostChatDialogCleanup;
    }
  }
  
  onUnmounted(() => {
    cleanupEventListeners();
  });
  
  return {
    isWebSocketConnected,
    typingStates,
    messengerCounter,
    setupEventListeners,
    cleanupEventListeners,
  };
}

