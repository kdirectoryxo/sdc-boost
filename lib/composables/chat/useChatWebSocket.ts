import { ref } from 'vue';
import { createGlobalState } from '@vueuse/core';
import { websocketManager } from '@/lib/websocket-manager';
import { typingStateManager } from '@/lib/websocket-handlers';
import { countersManager } from '@/lib/counters-manager';
import { refreshLatestPage } from '@/lib/message-service';
import { useChatState } from './useChatState';
import { useChatMessages } from './useChatMessages';
import { useChatFolders } from './useChatFolders';

export const useChatWebSocket = createGlobalState(() => {
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
  async function setupEventListeners() {
    // Ensure WebSocket is connected (connect() is safe to call multiple times)
    if (!websocketManager.connected) {
      try {
        await websocketManager.connect();
      } catch (error) {
        console.error('[useChatWebSocket] Failed to connect WebSocket:', error);
      }
    }
    
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
        if (optimisticMsg && chat) {
          // Remove optimistic message from database - the real one will come from refreshLatestPage
          const { messageStorage } = await import('@/lib/message-storage');
          await messageStorage.deleteMessage(chat.group_id, 0); // Delete optimistic message
        }
        
        // Clean up tracking
        optimisticMessages.value.delete(tempId);
        optimisticMessageTempIds.value.delete(tempId);
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
              
              // Remove optimistic message from database
              if (chat) {
                const { messageStorage } = await import('@/lib/message-storage');
                await messageStorage.deleteMessage(chat.group_id, 0); // Delete optimistic message
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
        // Messages will update reactively from database
        refreshLatestPage(selectedChat.value).catch(console.error);
        
        // Try to match optimistic messages with real messages after a short delay
        setTimeout(async () => {
          const { messageStorage } = await import('@/lib/message-storage');
          const updatedMessages = await messageStorage.getMessages(chat.group_id);
          
          // Remove matched optimistic messages from database and tracking
          for (const [tempId, optimisticMsg] of optimisticMessages.value.entries()) {
            const matchingRealMessage = updatedMessages.find(real => {
              // Match by: same message content, same sender (0 = current user), and timestamp within 30 seconds
              return real.message === optimisticMsg.message &&
                     real.sender === 0 && // Only match own messages
                     Math.abs(real.date2 - optimisticMsg.date2) < 30; // Allow 30 second window
            });
            
            if (matchingRealMessage && chat) {
              console.log(`[useChatWebSocket] Matched optimistic message ${tempId} with real message ${matchingRealMessage.message_id}`);
              // Remove optimistic message from database
              await messageStorage.deleteMessage(chat.group_id, 0); // Delete optimistic message
              // Add real message to database if not already there
              await messageStorage.addMessage(chat.group_id, matchingRealMessage);
              // Clean up tracking
              optimisticMessages.value.delete(tempId);
              optimisticMessageTempIds.value.delete(tempId);
            }
          }
        }, 1000); // Wait 1 second for refreshLatestPage to complete
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
          // Update all own messages to seen (sender === 0) in database
          const { messageStorage } = await import('@/lib/message-storage');
          const currentMessages = messages.value || [];
          for (const msg of currentMessages) {
            if (msg.sender === 0 && msg.seen === 0) {
              await messageStorage.updateMessage(selectedChat.value.group_id, msg.message_id, { seen: 1 });
            }
          }
          // Messages will update reactively
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
  
  return {
    isWebSocketConnected,
    typingStates,
    messengerCounter,
    setupEventListeners,
    cleanupEventListeners,
  };
});

