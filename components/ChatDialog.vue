<script lang="ts" setup>
import { ref, onMounted, computed, watch, onUnmounted, nextTick } from 'vue';
import { getMessengerFolders, syncAllChats, syncInboxChats, syncFolderChats, getMessengerChatDetails } from '@/lib/sdc-api';
import type { MessengerChatItem, MessengerFolder, MessengerMessage } from '@/lib/sdc-api-types';
import ChatListItem from '@/components/ChatListItem.vue';
import { websocketManager } from '@/lib/websocket-manager';
import { chatStorage } from '@/lib/chat-storage';
import { folderStorage } from '@/lib/folder-storage';
import { messageStorage } from '@/lib/message-storage';
import { typingStateManager } from '@/lib/websocket-handlers';
import { getCurrentDBId } from '@/lib/sdc-api/utils';

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
const messagesContainer = ref<HTMLElement | null>(null);

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
 */
async function fetchInboxChats(): Promise<void> {
  if (isRefreshing.value) return;
  
  isRefreshing.value = true;
  error.value = null;

  try {
    await syncInboxChats();
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
 * @param folderId The folder ID to sync chats for
 */
async function fetchFolderChats(folderId: number): Promise<void> {
  if (isRefreshing.value) return;
  
  isRefreshing.value = true;
  error.value = null;

  try {
    await syncFolderChats(folderId);
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
 */
async function fetchAllChats(): Promise<void> {
  if (isRefreshing.value) return;
  
  isRefreshing.value = true;
  error.value = null;

  try {
    await syncAllChats();
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
 */
function getInboxUnreadCount(): number {
  return chatList.value
    .filter(chat => !chat.folder_id || chat.folder_id === 0)
    .reduce((sum, chat) => sum + chat.unread_counter, 0);
}

/**
 * Get total unread count across all chats
 */
function getTotalUnreadCount(): number {
  return chatList.value
    .reduce((sum, chat) => sum + chat.unread_counter, 0);
}

// Search is now client-side only, no need for debounced API calls

/**
 * Load messages for a chat
 * On first load: fetches all history and stores it (shows loading)
 * On subsequent loads: loads from storage immediately, then fetches only latest page (no loading)
 */
async function loadMessages(chat: MessengerChatItem): Promise<void> {
  if (isLoadingMessages.value) return;
  
  error.value = null;

  try {
    // Check if chat has been fetched before
    const hasBeenFetched = await messageStorage.hasChatBeenFetched(chat.group_id);
    const storedMessages = await messageStorage.getMessages(chat.group_id);
    
    if (hasBeenFetched && storedMessages.length > 0) {
      // Chat has been fetched before - load from storage immediately (no loading indicator)
      messages.value = storedMessages;
      
      // Scroll to bottom immediately
      await nextTick();
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
      
      // Fetch new messages in background without blocking
      const latestMessageId = await messageStorage.getLatestMessageId(chat.group_id);
      fetchNewMessagesOnly(chat, latestMessageId).catch(console.error);
    } else if (hasBeenFetched && storedMessages.length === 0) {
      // Chat marked as fetched but no messages - fetch all again
      isLoadingMessages.value = true;
      await fetchAllMessages(chat);
      
      await nextTick();
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
      isLoadingMessages.value = false;
    } else {
      // First time loading this chat - fetch all history (show loading)
      isLoadingMessages.value = true;
      await fetchAllMessages(chat);
      
      // Scroll to bottom after loading
      await nextTick();
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
      isLoadingMessages.value = false;
    }
  } catch (err) {
    console.error('[ChatDialog] Failed to load messages:', err);
    error.value = 'Failed to load messages';
    isLoadingMessages.value = false;
  }
}

/**
 * Fetch all messages for a chat (full history)
 * Fetches all pages until there are no more messages
 * Updates DB and displays messages progressively as each page loads
 */
async function fetchAllMessages(chat: MessengerChatItem): Promise<void> {
  console.log(`[ChatDialog] Fetching all messages for chat ${chat.group_id}...`);
  let page = 0;
  let hasMore = true;
  const allMessages: MessengerMessage[] = [];

  while (hasMore) {
    try {
      const response = await getMessengerChatDetails(
        chat.db_id,
        chat.group_id,
        chat.group_type || 0,
        page
      );

      if (response.info.code === '200') {
        const pageMessages = response.info.message_list || [];
        
        if (pageMessages.length === 0) {
          hasMore = false;
          break;
        }

        // Store messages immediately after each page
        await messageStorage.upsertMessages(chat.group_id, pageMessages);
        
        // Add messages to collection (they come in reverse chronological order from API)
        allMessages.push(...pageMessages);
        
        // Update displayed messages progressively (sort by date2 ascending)
        const sortedMessages = [...allMessages].sort((a, b) => a.date2 - b.date2);
        messages.value = sortedMessages;
        
        // Scroll to bottom after each page to show latest messages
        await nextTick();
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        }
        
        // Check if there are more pages
        const urlMore = response.info.url_more;
        if (!urlMore || urlMore === '-1' || urlMore === '') {
          hasMore = false;
        } else {
          // Extract next page number from url_more
          const match = urlMore.match(/page=(\d+)/);
          if (match) {
            const nextPage = parseInt(match[1], 10);
            if (nextPage > page) {
              page = nextPage;
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.error(`[ChatDialog] Failed to fetch page ${page}:`, err);
      hasMore = false;
    }
  }

  // Mark chat as fetched and fully synced after all pages are loaded
  if (allMessages.length > 0) {
    await messageStorage.markChatFetched(chat.group_id);
    console.log(`[ChatDialog] Loaded ${allMessages.length} messages for chat ${chat.group_id}`);
  }
}

/**
 * Refresh latest page (page 0) in background
 * Used when WebSocket message is received to get any updates
 */
async function refreshLatestPage(chat: MessengerChatItem): Promise<void> {
  try {
    const response = await getMessengerChatDetails(
      chat.db_id,
      chat.group_id,
      chat.group_type || 0,
      0
    );

    if (response.info.code === '200') {
      const pageMessages = response.info.message_list || [];
      
      if (pageMessages.length > 0) {
        // Store messages
        await messageStorage.upsertMessages(chat.group_id, pageMessages);
        
        // Reload messages from storage to get updated list
        const storedMessages = await messageStorage.getMessages(chat.group_id);
        messages.value = storedMessages;
        
        // Scroll to bottom to show new messages
        await nextTick();
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        }
      }
    }
  } catch (err) {
    console.error('[ChatDialog] Failed to refresh latest page:', err);
  }
}

/**
 * Fetch only new messages (for already fetched chats)
 * Only fetches page 0 (latest page) which contains the newest messages
 */
async function fetchNewMessagesOnly(chat: MessengerChatItem, latestMessageId: number | null): Promise<void> {
  console.log(`[ChatDialog] Fetching new messages for chat ${chat.group_id}...`);
  
  if (latestMessageId === null) {
    // No stored messages - this shouldn't happen if chat is fetched, but handle it
    console.warn(`[ChatDialog] Chat ${chat.group_id} marked as fetched but has no messages. Fetching all.`);
    await fetchAllMessages(chat);
    return;
  }

  try {
    // Only fetch page 0 (latest page)
    const response = await getMessengerChatDetails(
      chat.db_id,
      chat.group_id,
      chat.group_type || 0,
      0
    );

    if (response.info.code === '200') {
      const pageMessages = response.info.message_list || [];
      
      if (pageMessages.length === 0) {
        return;
      }

      // Filter to only include messages newer than what we have
      const newMessages = pageMessages.filter(msg => msg.message_id > latestMessageId);
      
      if (newMessages.length > 0) {
        // Store new messages
        await messageStorage.upsertMessages(chat.group_id, newMessages);
        
        // Add to current messages list (sorted by date2)
        messages.value = [...messages.value, ...newMessages].sort((a, b) => a.date2 - b.date2);
        
        // Scroll to bottom to show new messages
        await nextTick();
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        }
        
        console.log(`[ChatDialog] Added ${newMessages.length} new messages for chat ${chat.group_id}`);
      }
    }
  } catch (err) {
    console.error('[ChatDialog] Failed to fetch new messages:', err);
    throw err;
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


async function handleChatClick(chat: MessengerChatItem) {
  selectedChat.value = chat;
  messages.value = [];
  await loadMessages(chat);
}

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}

// Track if initial load is complete to avoid refetching on mount
const isInitialLoad = ref(true);

// Custom event listeners for WebSocket events
let typingUnsubscribe: (() => void) | null = null;

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

let connectionCheckInterval: ReturnType<typeof setInterval> | null = null;

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

  // Listen for new message events
  const handleNewMessage = async (event: Event) => {
    const customEvent = event as CustomEvent;
    const { chat, groupId, message } = customEvent.detail;
    if (chat) {
      // Update chat in list if it exists
      const index = chatList.value.findIndex(c => String(c.group_id) === String(groupId));
      if (index !== -1) {
        chatList.value[index] = chat;
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
      refreshLatestPage(selectedChat.value).catch(console.error);
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
  if (typingUnsubscribe) {
    typingUnsubscribe();
    typingUnsubscribe = null;
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
              <span v-if="getTotalUnreadCount() > 0" class="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
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
              <span v-if="getInboxUnreadCount() > 0" class="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
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
                <span v-if="getFolderUnreadCount(folder.id) > 0" class="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center shrink-0 ml-2">
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
              class="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4 min-w-0"
            >
              <!-- Loading Indicator -->
              <div v-if="isLoadingMessages && messages.length === 0" class="flex justify-center py-8">
                <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>

              <!-- Messages List -->
              <div v-else-if="messages.length > 0" class="space-y-4 min-w-0">
                <div
                  v-for="message in messages"
                  :key="message.message_id"
                  :class="[
                    'flex gap-3 min-w-0 w-full',
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
                      'flex flex-col gap-1 min-w-0',
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
                      <span v-if="isOwnMessage(message) && message.seen === 1" class="text-blue-400 shrink-0">
                        ✓✓
                      </span>
                      <span v-else-if="isOwnMessage(message)" class="text-[#666] shrink-0">
                        ✓
                      </span>
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
            </div>

            <!-- Message Input (Placeholder) -->
            <div class="px-6 py-4 border-t border-[#333] shrink-0">
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  disabled
                  class="flex-1 px-4 py-2 bg-[#0f0f0f] border border-[#333] rounded-lg text-white placeholder-[#666] focus:outline-none"
                />
                <button
                  disabled
                  class="px-4 py-2 bg-blue-500 text-white rounded-lg opacity-50 cursor-not-allowed"
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


