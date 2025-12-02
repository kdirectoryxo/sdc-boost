<script lang="ts" setup>
import { ref, onMounted, computed, watch, onUnmounted, nextTick } from 'vue';
import { getMessengerFolders, syncAllChats, syncInboxChats, syncFolderChats } from '@/lib/sdc-api';
import type { MessengerChatItem, MessengerFolder, MessengerMessage } from '@/lib/sdc-api-types';
import ChatListItem from '@/components/ChatListItem.vue';
import { websocketManager } from '@/lib/websocket-manager';
import { chatStorage } from '@/lib/chat-storage';
import { folderStorage } from '@/lib/folder-storage';
import { typingStateManager } from '@/lib/websocket-handlers';
import { sendMessage, sendSeenEvent, sendQuotedMessage } from '@/lib/chat-service';
import { loadMessages, refreshLatestPage } from '@/lib/message-service';
import { TypingManager } from '@/lib/typing-manager';
import { deleteMessage } from '@/lib/sdc-api';
import { messageStorage } from '@/lib/message-storage';
import { getCurrentAccountId, getCurrentDBId } from '@/lib/sdc-api/utils';
import { countersManager } from '@/lib/counters-manager';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'close': [];
}>();

const chatList = ref<MessengerChatItem[]>([]);
const folders = ref<MessengerFolder[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const searchQuery = ref('');
const selectedChat = ref<MessengerChatItem | null>(null);
const selectedFolderId = ref<number | null>(null); // null = all chats, 0 = inbox (no folder), number = specific folder
const isRefreshing = ref(false);
const typingStates = ref<Map<string, boolean>>(new Map()); // Map of groupId -> isTyping
const isWebSocketConnected = ref(false);
const messages = ref<MessengerMessage[]>([]);
const isLoadingMessages = ref(false);
const isSyncing = ref(false); // Track if we're syncing all pages for first-time load
const messagesContainer = ref<HTMLElement | null>(null);
const messageInput = ref('');
const typingManager = new TypingManager();
const openDropdownMessageId = ref<number | null>(null); // Track which message's dropdown is open
const quotedMessageRef = ref<MessengerMessage | null>(null); // Store quoted message
const dropdownButtonRefs = ref<Map<number, HTMLElement>>(new Map()); // Store refs to dropdown buttons
const optimisticMessageTempIds = ref<Map<string, string>>(new Map()); // Track optimistic messages: tempId -> message content
const optimisticMessages = ref<Map<string, MessengerMessage>>(new Map()); // Track optimistic messages by tempId
const messengerCounter = ref<number>(0); // Track messenger counter from counters manager

// Computed property for quoted message
const quotedMessage = computed(() => {
  return quotedMessageRef.value;
});

// Helper function to sort chats: pinned first, then by date_time
function sortChats(chats: MessengerChatItem[]): MessengerChatItem[] {
  return [...chats].sort((a, b) => {
    // Pinned chats first
    const aPinned = a.pin_chat || 0;
    const bPinned = b.pin_chat || 0;
    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }
    // Then by date_time (most recent first)
    // Handle empty/invalid dates better - use a very old date for invalid ones
    const getTime = (chat: MessengerChatItem): number => {
      if (!chat.date_time || chat.date_time === '') {
        // For broadcasts without date_time, try to use a fallback
        // Use a very old date so they sort to bottom, but still sortable
        return new Date('1900-01-01').getTime();
      }
      const parsed = new Date(chat.date_time).getTime();
      // If date parsing failed, return very old date
      return isNaN(parsed) ? new Date('1900-01-01').getTime() : parsed;
    };
    
    const aTime = getTime(a);
    const bTime = getTime(b);
    return bTime - aTime;
  });
}

// Helper function to get a unique key for a chat (for Vue keys)
function getChatKey(chat: MessengerChatItem | null): string {
  if (!chat) return '';
  const isBroadcast = chat.broadcast || chat.type === 100;
  if (isBroadcast) {
    // For broadcasts, use db_id and id_broadcast if available
    if (chat.id_broadcast !== undefined && chat.id_broadcast !== null) {
      return `broadcast_${chat.db_id}_${chat.id_broadcast}`;
    }
    return `broadcast_${chat.db_id}`;
  }
  return `group_${chat.group_id}`;
}


// Filter and sort chats client-side
const filteredChats = computed(() => {
  let chats = chatList.value;

  // Filter by folder
  if (selectedFolderId.value !== null) {
    chats = chats.filter(chat => {
      const chatFolderId = chat.folder_id || 0;
      return chatFolderId === selectedFolderId.value;
    });
  }

  // Client-side search filtering
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    chats = chats.filter(chat => 
      (chat.account_id && chat.account_id.toLowerCase().includes(query)) ||
      (chat.last_message && chat.last_message.toLowerCase().includes(query)) ||
      (chat.subject && chat.subject.toLowerCase().includes(query))
    );
  }

  // Client-side sorting
  return sortChats(chats);
});

/**
 * Sync inbox chats (messenger_latest) from API and store in IndexedDB
 * Updates UI progressively after each page
 */
async function fetchInboxChats(): Promise<void> {
  if (isRefreshing.value) return;
  
  isRefreshing.value = true;
  error.value = null;

  try {
    // Pass callback to reload chats from storage after each page
    await syncInboxChats(async () => {
      await loadChatsFromStorage();
    });
    // Final reload to ensure everything is up to date
    await loadChatsFromStorage();
  } catch (err) {
    console.error('[ChatDialog] Failed to sync inbox chats:', err);
    await loadChatsFromStorage();
  } finally {
    isRefreshing.value = false;
  }
}

/**
 * Sync chats for a specific folder from API and store in IndexedDB
 * Updates UI progressively after each page
 * @param folderId The folder ID to sync chats for
 */
async function fetchFolderChats(folderId: number): Promise<void> {
  if (isRefreshing.value) return;
  
  isRefreshing.value = true;
  error.value = null;

  try {
    // Pass callback to reload chats from storage after each page
    await syncFolderChats(folderId, async () => {
      await loadChatsFromStorage();
    });
    // Final reload to ensure everything is up to date
    await loadChatsFromStorage();
  } catch (err) {
    console.error(`[ChatDialog] Failed to sync folder ${folderId} chats:`, err);
    await loadChatsFromStorage();
  } finally {
    isRefreshing.value = false;
  }
}

/**
 * Sync all chats from API and store in IndexedDB
 * Syncs from messenger_latest and from each folder
 * Updates UI progressively after each page
 */
async function fetchAllChats(): Promise<void> {
  if (isRefreshing.value) return;
  
  isRefreshing.value = true;
  error.value = null;

  try {
    // Pass callback to reload chats from storage after each page
    await syncAllChats(async () => {
      await loadChatsFromStorage();
    });
    // Final reload to ensure everything is up to date
    await loadChatsFromStorage();
  } catch (err) {
    console.error('[ChatDialog] Failed to sync chats:', err);
    error.value = 'Failed to load chats. Please try again.';
    await loadChatsFromStorage();
  } finally {
    isRefreshing.value = false;
  }
}

/**
 * Load chats from IndexedDB
 */
async function loadChatsFromStorage(): Promise<void> {
  try {
    const chats = await chatStorage.getAllChats();
    chatList.value = chats;
    console.log(`[ChatDialog] Loaded ${chats.length} chats from IndexedDB`);
  } catch (err) {
    console.error('[ChatDialog] Failed to load chats from storage:', err);
    error.value = 'Failed to load chats from storage.';
  }
}

/**
 * Fetch folders from API and store in IndexedDB
 */
async function fetchFolders(): Promise<void> {
  try {
    console.log('[ChatDialog] Fetching folders from API...');
    const response = await getMessengerFolders();
    
    if (response.info.code === 200) {
      const folderList = response.info.folders || [];
      
      // Upsert to IndexedDB
      await folderStorage.upsertFolders(folderList);
      
      // Load from IndexedDB and update UI
      await loadFoldersFromStorage();
    }
  } catch (err) {
    console.error('[ChatDialog] Failed to fetch folders:', err);
    // Try to load from storage anyway
    await loadFoldersFromStorage();
  }
}

/**
 * Load folders from IndexedDB
 */
async function loadFoldersFromStorage(): Promise<void> {
  try {
    const folderList = await folderStorage.getAllFolders();
    folders.value = folderList;
    console.log(`[ChatDialog] Loaded ${folderList.length} folders from IndexedDB`);
  } catch (err) {
    console.error('[ChatDialog] Failed to load folders from storage:', err);
  }
}

/**
 * Get folder name by ID
 */
function getFolderName(folderId: number | undefined | null): string {
  if (!folderId || folderId === 0) return '';
  const folder = folders.value.find(f => f.id === folderId);
  return folder ? folder.name : '';
}

/**
 * Get unread count for a folder
 */
function getFolderUnreadCount(folderId: number): number {
  return chatList.value
    .filter(chat => (chat.folder_id || 0) === folderId && chat.unread_counter > 0)
    .reduce((sum, chat) => sum + chat.unread_counter, 0);
}

/**
 * Get unread count for inbox (folder_id = 0 or null)
 * Uses counters.messenger from counters manager (correct value)
 */
function getInboxUnreadCount(): number {
  return messengerCounter.value;
}

/**
 * Get total unread count across all chats
 * Uses counters.messenger from counters manager (correct value)
 */
function getTotalUnreadCount(): number {
  return messengerCounter.value;
}

// Search is now client-side only, no need for debounced API calls

/**
 * Load messages for a chat using the message service
 */
async function handleLoadMessages(chat: MessengerChatItem): Promise<void> {
  // Store the current chat's group_id to track which chat we're loading
  const currentChatGroupId = chat.group_id;
  
  // Clear messages and reset error when starting a new load
  messages.value = [];
  error.value = null;
  
  // Check if this is a first-time load (will need to fetch all messages)
  // If so, show loading spinner and syncing notice
  const hasBeenFetched = await messageStorage.hasChatBeenFetched(chat.group_id);
  const storedMessages = await messageStorage.getMessages(chat.group_id);
  const isFirstTimeLoad = !hasBeenFetched || storedMessages.length === 0;
  
  if (isFirstTimeLoad) {
    isLoadingMessages.value = true;
    isSyncing.value = true; // Show syncing notice while fetching all pages
  }

  try {
    const result = await loadMessages(chat, (updatedMessages) => {
      // Only update messages if we're still loading the same chat
      // This prevents old progress callbacks from updating messages after switching chats
      if (selectedChat.value && selectedChat.value.group_id === currentChatGroupId) {
        messages.value = updatedMessages;
        // If we have messages, we can hide the spinner
        if (updatedMessages.length > 0) {
          isLoadingMessages.value = false;
        }
        // Scroll to bottom after each update
        nextTick().then(() => {
          if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
          }
        });
      }
    });
    
    // Only update if we're still on the same chat
    if (selectedChat.value && selectedChat.value.group_id === currentChatGroupId) {
      messages.value = result.messages;
      // Always set loading to false after loadMessages completes
      isLoadingMessages.value = false;
      isSyncing.value = false; // Hide syncing notice when done
      
      // Always scroll to bottom after loading (with multiple attempts for reliability)
      await nextTick();
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        // Also scroll after a small delay to account for any rendering delays
        setTimeout(() => {
          if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
          }
        }, 100);
      }
    } else {
      // Chat was switched, ensure loading state is cleared
      isLoadingMessages.value = false;
      isSyncing.value = false;
    }
  } catch (err) {
    console.error('[ChatDialog] Failed to load messages:', err);
    // Only update error/loading state if we're still on the same chat
    if (selectedChat.value && selectedChat.value.group_id === currentChatGroupId) {
      error.value = 'Failed to load messages';
      isLoadingMessages.value = false;
      isSyncing.value = false;
    } else {
      // Chat was switched, ensure loading state is cleared
      isLoadingMessages.value = false;
      isSyncing.value = false;
    }
  }
}

/**
 * Check if message is from current user
 * sender: 0 = current user, sender: 1 = other user
 */
function isOwnMessage(message: MessengerMessage): boolean {
  return message.sender === 0;
}

/**
 * Format message date
 */
function formatMessageDate(message: MessengerMessage): string {
  return message.date || new Date(message.date2 * 1000).toLocaleString();
}

/**
 * Handle typing in message input
 */
function handleMessageInput(chat: MessengerChatItem): void {
  typingManager.handleTyping(chat);
}

/**
 * Handle message send with optimistic update
 */
async function handleSendMessage(): Promise<void> {
  if (!selectedChat.value || !messageInput.value.trim()) {
    return;
  }

  const messageText = messageInput.value.trim();
  const quotedMessage = quotedMessageRef.value;
  const accountId = getCurrentAccountId();
  const dbId = getCurrentDBId();
  
  if (!accountId || !dbId) {
    console.warn('[ChatDialog] Cannot send message - missing user info');
    return;
  }

  // Generate tempId for optimistic message
  const tempId = crypto.randomUUID();
  const now = new Date();
  const date2 = Math.floor(now.getTime() / 1000);

  // Create optimistic message with tempId stored in extra1 (we'll use it for tracking)
  const optimisticMessage: MessengerMessage = {
    message: messageText,
    url_videos: '',
    message_id: 0, // Will be replaced when real message arrives
    share_data: null,
    share_biz_list: [],
    message_type: null,
    seen: 0, // Start as sent (0), will update to seen (1) when confirmed
    sender: 0, // Current user
    gender1: 0,
    gender2: 0,
    date: now.toLocaleString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit' 
    }),
    account_id: accountId,
    date2: date2,
    db_id: parseInt(dbId),
    extra1: `__tempId:${tempId}__`, // Store tempId in extra1 for tracking
    forward: 0,
    forward_extra_text: '',
    forward_db_id: 0,
    is_quote: quotedMessage ? 1 : 0,
    q_message: quotedMessage?.message || '',
    q_account_id: quotedMessage?.account_id || '',
    q_db_id: quotedMessage?.db_id || 0,
    qgender1: quotedMessage?.gender1 || 0,
    qgender2: quotedMessage?.gender2 || 0,
    is_lt_offer: 0,
  };

  // Optimistically update chat list - move chat to top and update last_message
  if (selectedChat.value) {
    const chatIndex = chatList.value.findIndex(c => getChatKey(c) === getChatKey(selectedChat.value));
    if (chatIndex !== -1) {
      const updatedChat: MessengerChatItem = {
        ...selectedChat.value,
        last_message: messageText,
        date_time: now.toISOString(),
        date: optimisticMessage.date,
        unread_counter: 0, // Reset unread counter for own messages
      };
      // Remove from current position and add to top
      chatList.value.splice(chatIndex, 1);
      chatList.value.unshift(updatedChat);
      selectedChat.value = updatedChat;
      
      // Update in storage optimistically
      chatStorage.updateChat(updatedChat).catch(console.error);
    }
  }

  // Add optimistic message to UI immediately
  messages.value = [...messages.value, optimisticMessage];
  optimisticMessages.value.set(tempId, optimisticMessage);
  optimisticMessageTempIds.value.set(tempId, messageText);
  
  // Scroll to bottom to show new message
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }

  // Clear input and quoted message
  messageInput.value = '';
  quotedMessageRef.value = null;
  
  // Stop typing indicator
  typingManager.stopTyping();

  // Send message via WebSocket (pass tempId so it can be tracked)
  let success = false;
  if (quotedMessage) {
    success = sendQuotedMessage(selectedChat.value, messageText, quotedMessage);
  } else {
    success = sendMessage(selectedChat.value, messageText);
  }

  if (!success) {
    // Failed to send - remove optimistic message and revert chat update
    messages.value = messages.value.filter(msg => {
      const msgTempId = msg.extra1?.match(/__tempId:(.+?)__/)?.[1];
      return msgTempId !== tempId;
    });
    optimisticMessages.value.delete(tempId);
    optimisticMessageTempIds.value.delete(tempId);
    
    // Revert chat list update
    await loadChatsFromStorage();
    error.value = 'Failed to send message';
  } else {
    // Refetch latest page after a short delay to get the real message
    // This is a fallback in case WebSocket event doesn't come through immediately
    setTimeout(async () => {
      if (optimisticMessages.value.has(tempId) && selectedChat.value) {
        await refreshLatestPage(selectedChat.value, (updatedMessages) => {
          // Check if we got a real message that matches our optimistic one
          const matchingRealMessage = updatedMessages.find(real => 
            real.message === messageText &&
            Math.abs(real.date2 - date2) < 10 &&
            real.sender === 0
          );
          
          if (matchingRealMessage) {
            // Replace optimistic message with real one
            messages.value = messages.value.filter(msg => {
              const msgTempId = msg.extra1?.match(/__tempId:(.+?)__/)?.[1];
              return msgTempId !== tempId;
            });
            
            // Add real message if not already present
            const hasRealMessage = messages.value.some(m => m.message_id === matchingRealMessage.message_id);
            if (!hasRealMessage) {
              messages.value.push(matchingRealMessage);
              messages.value.sort((a, b) => a.date2 - b.date2);
            }
            
            // Clean up tracking
            optimisticMessages.value.delete(tempId);
            optimisticMessageTempIds.value.delete(tempId);
            
            // Scroll to bottom
            nextTick().then(() => {
              if (messagesContainer.value) {
                messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
              }
            });
          }
        }).catch(console.error);
      }
    }, 2000); // Wait 2 seconds for WebSocket, then fallback to API
    
    // Set up timeout to clean up optimistic message if it's not replaced within 30 seconds
    setTimeout(() => {
      if (optimisticMessages.value.has(tempId)) {
        console.warn(`[ChatDialog] Optimistic message ${tempId} not replaced after 30s, cleaning up`);
        messages.value = messages.value.filter(msg => {
          const msgTempId = msg.extra1?.match(/__tempId:(.+?)__/)?.[1];
          return msgTempId !== tempId;
        });
        optimisticMessages.value.delete(tempId);
        optimisticMessageTempIds.value.delete(tempId);
      }
    }, 30000); // 30 second timeout
  }
}

/**
 * Handle message delete
 */
async function handleDeleteMessage(message: MessengerMessage): Promise<void> {
  if (!selectedChat.value) return;
  
  // Access confirm dialog from global window
  const confirmDialog = (window as any).__sdcBoostConfirm;
  if (!confirmDialog) {
    console.warn('[ChatDialog] Confirm dialog not available');
    return;
  }
  
  // Show confirmation dialog
  const confirmed = await confirmDialog.confirm('Are you sure you want to delete this message?');
  if (!confirmed) {
    return; // User cancelled
  }
  
  // Clear quoted message if this was the quoted message
  if (quotedMessageRef.value && quotedMessageRef.value.message_id === message.message_id) {
    cancelQuote();
  }
  
  try {
    await deleteMessage(selectedChat.value.group_id, message.message_id);
    // Delete from IndexedDB
    await messageStorage.deleteMessage(selectedChat.value.group_id, message.message_id);
    // Refresh messages after deletion
    await refreshLatestPage(selectedChat.value, (updatedMessages) => {
      messages.value = updatedMessages;
    });
    openDropdownMessageId.value = null;
  } catch (err) {
    console.error('[ChatDialog] Failed to delete message:', err);
    error.value = 'Failed to delete message';
  }
}

/**
 * Handle message copy
 */
function handleCopyMessage(message: MessengerMessage): void {
  // Access toast from global window
  const toast = (window as any).__sdcBoostToast;
  
  navigator.clipboard.writeText(message.message).then(() => {
    console.log('[ChatDialog] Message copied to clipboard');
    // Show success toast notification
    if (toast) {
      toast.success('Message copied to clipboard');
    }
  }).catch(err => {
    console.error('[ChatDialog] Failed to copy message:', err);
    if (toast) {
      toast.error('Failed to copy message');
    }
  });
  openDropdownMessageId.value = null;
}

/**
 * Handle message quote
 */
function handleQuoteMessage(message: MessengerMessage): void {
  if (!selectedChat.value) return;
  
  // Store the quoted message in ref
  quotedMessageRef.value = message;
  openDropdownMessageId.value = null;
  
  // Scroll to bottom when quoting a message
  nextTick().then(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
    
    // Focus the input
    const input = document.querySelector('input[placeholder="Type a message..."]') as HTMLInputElement;
    if (input) {
      input.focus();
    }
  });
}

/**
 * Cancel quoted message
 */
function cancelQuote(): void {
  quotedMessageRef.value = null;
}

async function handleChatClick(chat: MessengerChatItem) {
  selectedChat.value = chat;
  messages.value = [];
  isLoadingMessages.value = false; // Reset loading state when switching chats
  isSyncing.value = false; // Reset syncing state when switching chats
  typingManager.reset(); // Reset typing when switching chats
  await handleLoadMessages(chat);
  
  // Always scroll to bottom when opening a chat
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
  
  // Send seen event when opening a chat
  sendSeenEvent(chat);
}

function handleClose() {
  // Stop typing if active
  typingManager.stopTyping();
  
  emit('update:modelValue', false);
  emit('close');
}

// Track if initial load is complete to avoid refetching on mount
const isInitialLoad = ref(true);

// Custom event listeners for WebSocket events
let typingUnsubscribe: (() => void) | null = null;
let connectionCheckInterval: ReturnType<typeof setInterval> | null = null;
let countersUnsubscribe: (() => void) | null = null;

// Watch for folder selection changes to refetch in background
watch(selectedFolderId, async (newFolderId, oldFolderId) => {
  // Skip on initial load
  if (isInitialLoad.value) {
    return;
  }
  
  // Skip if already refreshing
  if (isRefreshing.value) {
    return;
  }
  
  // Refetch in background based on selection
  if (newFolderId === null) {
    // "All Chats" selected - refetch all chats
    console.log('[ChatDialog] Refetching all chats in background...');
    fetchAllChats().catch(console.error);
  } else if (newFolderId === 0) {
    // "Inbox" selected - refetch inbox chats (messenger_latest)
    console.log('[ChatDialog] Refetching inbox chats in background...');
    fetchInboxChats().catch(console.error);
  } else if (newFolderId !== null) {
    // Specific folder selected - refetch that folder's chats
    console.log(`[ChatDialog] Refetching folder ${newFolderId} chats in background...`);
    fetchFolderChats(newFolderId).catch(console.error);
  }
});

// Watch for modelValue changes to fetch data when dialog opens
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    // Reset initial load flag
    isInitialLoad.value = true;
    
    // Load from IndexedDB first (fast)
    await loadChatsFromStorage();
    await loadFoldersFromStorage();
    
    // Fetch folders first, then fetch all chats (which includes folder chats)
    await fetchFolders();
    await fetchAllChats();
    
    // Mark initial load as complete
    isInitialLoad.value = false;
    
    // Set up event listeners
    setupEventListeners();
  } else {
    cleanupEventListeners();
    // Reset initial load flag when dialog closes
    isInitialLoad.value = true;
  }
}, { immediate: true });

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

  // Listen for counter updates
  countersUnsubscribe = countersManager.onUpdate((counters) => {
    messengerCounter.value = counters.messenger || 0;
  });
  
  // Initialize counter value
  const currentCounters = countersManager.getCounters();
  if (currentCounters) {
    messengerCounter.value = currentCounters.messenger || 0;
  }

  // Listen for new message events
  const handleNewMessage = async (event: Event) => {
    const customEvent = event as CustomEvent;
    const { chat, groupId, message } = customEvent.detail;
    
    // Check if this message has a tempId that matches an optimistic message
    const tempId = (message as any)?.tempId;
    if (tempId && optimisticMessages.value.has(tempId)) {
      // This is a confirmation of an optimistic message
      // Replace the optimistic message with the real one
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
        await loadChatsFromStorage();
      }
    } else {
      // Unknown chat - refresh to get it
      await loadChatsFromStorage();
    }
    
    // If this message is for the currently selected chat, refresh page 0 in background
    if (selectedChat.value && String(selectedChat.value.group_id) === String(groupId)) {
      // Refresh latest page (page 0) in background to get any updates
      refreshLatestPage(selectedChat.value, (updatedMessages) => {
        // Merge with any remaining optimistic messages
        const optimisticMsgs = Array.from(optimisticMessages.value.values()).filter(msg => {
          // Only keep optimistic messages that haven't been replaced
          const msgTempId = msg.extra1?.match(/__tempId:(.+?)__/)?.[1];
          if (!msgTempId) return false;
          
          // Check if we have a real message that matches
          const hasRealMatch = updatedMessages.some(real => 
            real.message === msg.message &&
            Math.abs(real.date2 - msg.date2) < 10
          );
          return !hasRealMatch;
        });
        
        // Combine and deduplicate
        const allMessages = [...optimisticMsgs, ...updatedMessages];
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
        
        // Scroll to bottom to show new messages
        nextTick().then(() => {
          if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
          }
        });
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

function cleanupEventListeners() {
  // Stop typing if active
  typingManager.stopTyping();
  
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

onMounted(async () => {
  if (props.modelValue) {
    // Reset initial load flag
    isInitialLoad.value = true;
    
    // Load from IndexedDB first
    await loadChatsFromStorage();
    await loadFoldersFromStorage();
    // Fetch folders first, then fetch all chats (which includes folder chats)
    await fetchFolders();
    await fetchAllChats();
    
    // Mark initial load as complete
    isInitialLoad.value = false;
    
    setupEventListeners();
  }
});

onUnmounted(() => {
  cleanupEventListeners();
});
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    style="pointer-events: auto; z-index: 999999; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
    @click.self="handleClose"
  >
    <div
      class="w-[95vw] h-[95vh] md:w-[90vw] md:h-[90vh] bg-[#1a1a1a] rounded-lg shadow-2xl flex flex-col overflow-hidden"
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-[#333] shrink-0">
        <div class="flex items-center gap-3">
          <h2 class="text-xl font-semibold text-white">Chats</h2>
          <!-- WebSocket Connection Status -->
          <div class="flex items-center gap-2">
            <div
              :class="[
                'w-2 h-2 rounded-full',
                isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'
              ]"
              :title="isWebSocketConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'"
            />
            <span class="text-xs text-[#666]">
              {{ isWebSocketConnected ? 'Live' : 'Offline' }}
            </span>
          </div>
        </div>
        <button
          @click="handleClose"
          class="p-2 hover:bg-[#333] rounded-md transition-colors"
          title="Close"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-[#999] hover:text-white"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Main Content -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Left Sidebar - Folders -->
        <div class="w-[200px] border-r border-[#333] flex flex-col bg-[#0f0f0f] overflow-y-auto shrink-0">
          <div class="p-4 border-b border-[#333] shrink-0">
            <h3 class="text-sm font-semibold text-[#999] uppercase tracking-wide">Folders</h3>
          </div>
          <div class="flex-1 overflow-y-auto">
            <!-- All Chats -->
            <button
              @click="selectedFolderId = null"
              :class="[
                'w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#1a1a1a] transition-colors',
                selectedFolderId === null ? 'bg-[#1a1a1a] border-l-2 border-blue-500' : ''
              ]"
            >
              <div class="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999]">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="text-white text-sm">All Chats</span>
              </div>
              <span v-if="getTotalUnreadCount() > 0" class="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                {{ getTotalUnreadCount() > 99 ? '99+' : getTotalUnreadCount() }}
              </span>
            </button>

            <!-- Inbox (no folder) -->
            <button
              @click="selectedFolderId = 0"
              :class="[
                'w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#1a1a1a] transition-colors',
                selectedFolderId === 0 ? 'bg-[#1a1a1a] border-l-2 border-blue-500' : ''
              ]"
            >
              <div class="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999]">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <span class="text-white text-sm">Inbox</span>
              </div>
              <span v-if="getInboxUnreadCount() > 0" class="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                {{ getInboxUnreadCount() > 99 ? '99+' : getInboxUnreadCount() }}
              </span>
            </button>

            <!-- Folder List -->
            <div v-for="folder in folders" :key="folder.id" class="border-t border-[#333]">
              <button
                @click="selectedFolderId = folder.id"
                :class="[
                  'w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#1a1a1a] transition-colors',
                  selectedFolderId === folder.id ? 'bg-[#1a1a1a] border-l-2 border-blue-500' : ''
                ]"
              >
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] shrink-0">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span class="text-white text-sm truncate">{{ folder.name }}</span>
                </div>
                <span v-if="getFolderUnreadCount(folder.id) > 0" class="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center shrink-0 ml-2">
                  {{ getFolderUnreadCount(folder.id) > 99 ? '99+' : getFolderUnreadCount(folder.id) }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Middle Sidebar - Chat List -->
        <div class="w-[35%] border-r border-[#333] flex flex-col bg-[#0f0f0f]">
          <!-- Search Bar -->
          <div class="p-4 border-b border-[#333] shrink-0">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search chats..."
              class="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <!-- Chat List -->
          <div class="flex-1 overflow-y-auto">
            <div v-if="isLoading && chatList.length === 0" class="flex items-center justify-center h-full">
              <div class="flex flex-col items-center gap-4 px-6 max-w-sm">
                <div class="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div class="text-center">
                  <div class="text-white text-lg font-semibold mb-2">Syncing your chats</div>
                  <div class="text-[#999] text-sm">Please wait while we load your conversations...</div>
                </div>
              </div>
            </div>

            <div v-else-if="error" class="flex items-center justify-center h-full">
              <div class="text-red-500">{{ error }}</div>
            </div>

            <div v-else-if="filteredChats.length === 0" class="flex items-center justify-center h-full">
              <div class="text-[#999]">No chats found</div>
            </div>

            <div v-else class="divide-y divide-[#333]">
              <ChatListItem
                v-for="chat in filteredChats"
                :key="getChatKey(chat)"
                :chat="chat"
                :selected="getChatKey(selectedChat) === getChatKey(chat)"
                :folder-name="getFolderName(chat.folder_id)"
                :is-typing="typingStates.get(String(chat.group_id)) || false"
                @click="handleChatClick(chat)"
              />
            </div>
          </div>
        </div>

        <!-- Right Side - Chat Messages Area -->
        <div class="flex-1 flex flex-col bg-[#1a1a1a] min-w-0 overflow-hidden">
          <div v-if="!selectedChat" class="flex-1 flex items-center justify-center">
            <div class="text-center text-[#999]">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="mx-auto mb-4 opacity-50"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <p>Select a chat to view messages</p>
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col min-w-0 overflow-hidden">
            <!-- Chat Header -->
            <div class="px-6 py-4 border-b border-[#333] shrink-0 flex items-center gap-4 min-w-0">
              <img
                :src="`https://pictures.sdc.com/photos/${selectedChat.primary_photo}`"
                :alt="selectedChat.account_id"
                class="w-10 h-10 rounded-full object-cover shrink-0"
              />
              <div class="flex-1 min-w-0">
                <h3 class="text-white font-semibold truncate">{{ selectedChat.account_id }}</h3>
                <p v-if="selectedChat.online === 1" class="text-xs text-green-500">Online</p>
                <p v-else class="text-xs text-[#999]">Offline</p>
              </div>
            </div>

            <!-- Messages Area -->
            <div 
              ref="messagesContainer"
              @click="openDropdownMessageId = null"
              class="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4 min-w-0 relative"
            >
              <!-- Syncing Notice (sticky centered overlay) -->
              <div 
                v-if="isSyncing" 
                class="sticky top-6 z-10 flex justify-center mb-4"
              >
                <div class="px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg flex items-center gap-2">
                  <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span class="text-white text-sm font-medium">Syncing..</span>
                </div>
              </div>

              <!-- Loading Indicator -->
              <div v-if="isLoadingMessages && messages.length === 0" class="flex justify-center py-8">
                <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>

              <!-- Messages List -->
              <div v-else-if="messages.length > 0" class="space-y-4 min-w-0">
                <div
                  v-for="(message, index) in messages"
                  :key="message.message_id > 0 ? `msg_${message.message_id}` : `opt_${message.extra1 || index}_${message.date2}`"
                  :class="[
                    'flex gap-3 min-w-0 w-full group',
                    isOwnMessage(message) ? 'flex-row-reverse' : 'flex-row'
                  ]"
                >
                  <!-- Avatar (only for other user) -->
                  <img
                    v-if="!isOwnMessage(message)"
                    :src="`https://pictures.sdc.com/photos/${selectedChat.primary_photo}`"
                    :alt="message.account_id"
                    class="w-8 h-8 rounded-full object-cover shrink-0"
                  />

                  <!-- Message Content -->
                  <div
                    :class="[
                      'flex flex-col gap-1 min-w-0 relative',
                      isOwnMessage(message) ? 'items-end ml-auto max-w-[70%]' : 'items-start max-w-[70%]'
                    ]"
                  >
                    <!-- Quoted Message -->
                    <div
                      v-if="message.is_quote && message.q_message"
                      :class="[
                        'px-3 py-2 rounded-lg text-sm border-l-2 min-w-0 w-full',
                        isOwnMessage(message)
                          ? 'bg-[#2a2a2a] border-blue-500 text-[#ccc]'
                          : 'bg-[#0f0f0f] border-[#444] text-[#999]'
                      ]"
                    >
                      <div class="font-semibold text-xs mb-1 truncate">
                        {{ message.q_account_id }}
                      </div>
                      <div class="text-xs line-clamp-2 wrap-break-word">{{ message.q_message }}</div>
                    </div>

                    <!-- Message Bubble -->
                    <div
                      :class="[
                        'px-4 py-2 rounded-lg min-w-0 w-full',
                        isOwnMessage(message)
                          ? 'bg-blue-500 text-white'
                          : 'bg-[#2a2a2a] text-white'
                      ]"
                    >
                      <p class="whitespace-pre-wrap wrap-break-word overflow-wrap-anywhere">{{ message.message }}</p>
                    </div>

                    <!-- Message Meta -->
                    <div class="flex items-center gap-2 text-xs text-[#666] shrink-0">
                      <span class="whitespace-nowrap">{{ formatMessageDate(message) }}</span>
                      <span v-if="isOwnMessage(message)" class="relative inline-flex items-center shrink-0 ml-1" :class="message.seen === 1 ? 'text-blue-400' : 'text-[#666]'">
                        <!-- Single checkmark for sent messages -->
                        <svg v-if="message.seen !== 1" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
                        </svg>
                        <!-- Double checkmark for seen messages (overlapping) -->
                        <template v-else>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="absolute left-0">
                            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
                          </svg>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="ml-[-6px]">
                            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
                          </svg>
                        </template>
                      </span>
                    </div>
                    
                    <!-- Dropdown Button for own messages (positioned absolutely to the left of message bubble) -->
                    <div v-if="isOwnMessage(message)" class="absolute -left-8 top-0">
                      <button
                        :ref="el => { if (el) dropdownButtonRefs.set(message.message_id, el as HTMLElement); }"
                        @click.stop="openDropdownMessageId = openDropdownMessageId === message.message_id ? null : message.message_id"
                        :class="[
                          'p-1.5 rounded hover:bg-[#2a2a2a] transition-opacity',
                          openDropdownMessageId === message.message_id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        ]"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] hover:text-white">
                          <circle cx="12" cy="12" r="1"></circle>
                          <circle cx="12" cy="5" r="1"></circle>
                          <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                      </button>
                      
                      <!-- Custom Dropdown Menu -->
                      <div
                        v-if="openDropdownMessageId === message.message_id"
                        class="absolute z-[1000003] top-full right-full mr-2 mt-1 w-32 rounded-md shadow-lg bg-[#1a1a1a] border border-[#333] py-1"
                        @click.stop
                      >
                        <button
                          @click.stop="handleCopyMessage(message)"
                          class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                          Copy
                        </button>
                        <button
                          @click.stop="handleQuoteMessage(message)"
                          class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
                            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
                          </svg>
                          Citaat
                        </button>
                        <button
                          @click.stop="handleDeleteMessage(message)"
                          class="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Dropdown Button for other messages (placed last in DOM, appears on right) -->
                  <div v-if="!isOwnMessage(message)" class="relative shrink-0 self-start mt-1">
                    <button
                      :ref="el => { if (el) dropdownButtonRefs.set(message.message_id, el as HTMLElement); }"
                      @click.stop="openDropdownMessageId = openDropdownMessageId === message.message_id ? null : message.message_id"
                      :class="[
                        'p-1.5 rounded hover:bg-[#2a2a2a] transition-opacity',
                        openDropdownMessageId === message.message_id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      ]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] hover:text-white">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                      </svg>
                    </button>
                    
                    <!-- Custom Dropdown Menu -->
                    <div
                      v-if="openDropdownMessageId === message.message_id"
                      class="absolute z-[1000003] top-full left-0 mt-1 w-32 rounded-md shadow-lg bg-[#1a1a1a] border border-[#333] py-1"
                      @click.stop
                    >
                      <button
                        @click.stop="handleCopyMessage(message)"
                        class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                      </button>
                      <button
                        @click.stop="handleQuoteMessage(message)"
                        class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
                          <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
                        </svg>
                        Citaat
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else class="flex items-center justify-center h-full">
                <div class="text-center text-[#999]">
                  <p>No messages yet</p>
                  <p class="text-sm mt-2">Start the conversation!</p>
                </div>
              </div>

              <!-- Typing Indicator -->
              <div 
                v-if="selectedChat && typingStates.get(String(selectedChat.group_id))" 
                class="flex gap-3 min-w-0"
              >
                <img
                  :src="`https://pictures.sdc.com/photos/${selectedChat.primary_photo}`"
                  :alt="selectedChat.account_id"
                  class="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div class="flex flex-col gap-1 min-w-0 max-w-[70%] items-start">
                  <div class="px-4 py-2 rounded-lg bg-[#2a2a2a] text-white">
                    <div class="flex gap-1">
                      <span class="w-2 h-2 bg-[#999] rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                      <span class="w-2 h-2 bg-[#999] rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                      <span class="w-2 h-2 bg-[#999] rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Message Input -->
            <div class="px-6 py-4 border-t border-[#333] shrink-0">
              <!-- Quoted Message Indicator -->
              <div v-if="quotedMessage" class="mb-2 px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded-lg flex items-start gap-2">
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-[#999] mb-1">Quoting {{ quotedMessage.account_id }}</div>
                  <div class="text-sm text-white line-clamp-2">{{ quotedMessage.message }}</div>
                </div>
                <button
                  @click="cancelQuote"
                  class="p-1 hover:bg-[#2a2a2a] rounded transition-colors shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999]">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model="messageInput"
                  @input="selectedChat && handleMessageInput(selectedChat)"
                  @keydown.enter.prevent="handleSendMessage"
                  @click="openDropdownMessageId = null"
                  type="text"
                  placeholder="Type a message..."
                  :disabled="!selectedChat || !isWebSocketConnected"
                  class="flex-1 px-4 py-2 bg-[#0f0f0f] border border-[#333] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  @click="handleSendMessage"
                  :disabled="!selectedChat || !messageInput.trim() || !isWebSocketConnected"
                  class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


