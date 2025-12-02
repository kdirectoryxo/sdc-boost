<script lang="ts" setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { getMessengerLatest } from '@/lib/sdc-api';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import ChatListItem from '@/components/ChatListItem.vue';
import { websocketManager } from '@/lib/websocket-manager';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'close': [];
}>();

const chatList = ref<MessengerChatItem[]>([]);
const isLoading = ref(false);
const isLoadingMore = ref(false);
const error = ref<string | null>(null);
const searchQuery = ref('');
const selectedChat = ref<MessengerChatItem | null>(null);
const currentPage = ref(0);
const hasMore = ref(false);
const urlMore = ref<string | null>(null);
const searchTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

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
    const aTime = new Date(a.date_time || '1900-01-01').getTime();
    const bTime = new Date(b.date_time || '1900-01-01').getTime();
    return bTime - aTime;
  });
}

// Helper function to deduplicate chats by group_id
function deduplicateChats(chats: MessengerChatItem[]): MessengerChatItem[] {
  const seen = new Map<number, MessengerChatItem>();
  for (const chat of chats) {
    const groupId = chat.group_id;
    if (!seen.has(groupId)) {
      seen.set(groupId, chat);
    } else {
      // Keep the one with more recent date_time
      const existing = seen.get(groupId)!;
      const existingTime = new Date(existing.date_time || '1900-01-01').getTime();
      const newTime = new Date(chat.date_time || '1900-01-01').getTime();
      if (newTime > existingTime) {
        seen.set(groupId, chat);
      }
    }
  }
  return Array.from(seen.values());
}

// Filter chats (no sorting here - data is already sorted)
const filteredChats = computed(() => {
  if (!searchQuery.value.trim()) {
    return chatList.value;
  }

  const query = searchQuery.value.toLowerCase();
  return chatList.value.filter(chat => 
    (chat.account_id && chat.account_id.toLowerCase().includes(query)) ||
    (chat.last_message && chat.last_message.toLowerCase().includes(query)) ||
    (chat.subject && chat.subject.toLowerCase().includes(query))
  );
});

async function fetchChatList(page: number = 0, searchMember: string = '') {
  if (isLoading.value && page === 0) return;
  if (isLoadingMore.value && page > 0) return;

  if (page === 0) {
    isLoading.value = true;
  } else {
    isLoadingMore.value = true;
  }
  error.value = null;

  try {
    const response = await getMessengerLatest(page, searchMember);
    
    let newChats = response.info.chat_list || [];
    
    // Deduplicate and sort new chats
    newChats = deduplicateChats(newChats);
    newChats = sortChats(newChats);
    
    if (page === 0 || searchMember) {
      // Replace list for first page or when searching
      chatList.value = newChats;
    } else {
      // Merge and deduplicate for pagination
      const merged = [...chatList.value, ...newChats];
      chatList.value = sortChats(deduplicateChats(merged));
    }

    urlMore.value = response.info.url_more || null;
    hasMore.value = !!(urlMore.value && urlMore.value !== '-1' && urlMore.value !== '');
    currentPage.value = page;
  } catch (err) {
    console.error('[ChatDialog] Failed to fetch chat list:', err);
    error.value = 'Failed to load chats. Please try again.';
  } finally {
    isLoading.value = false;
    isLoadingMore.value = false;
  }
}

// Watch search query and debounce API calls
watch(searchQuery, (newQuery) => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
  
  searchTimeout.value = setTimeout(() => {
    fetchChatList(0, newQuery);
  }, 300);
});

// Infinite scroll handler
function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
  
  // Load more when within 200px of bottom
  if (scrollBottom < 200 && hasMore.value && !isLoadingMore.value && !searchQuery.value.trim()) {
    const match = urlMore.value?.match(/page=(\d+)/);
    if (match) {
      const nextPage = parseInt(match[1], 10);
      fetchChatList(nextPage);
    }
  }
}

function handleChatClick(chat: MessengerChatItem) {
  selectedChat.value = chat;
  // TODO: Load chat messages
}

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}

// WebSocket event handlers
let unsubscribeSeen: (() => void) | null = null;
let unsubscribeMessage: (() => void) | null = null;
let unsubscribeOnline: (() => void) | null = null;

// Watch for modelValue changes to fetch data when dialog opens
watch(() => props.modelValue, (newValue) => {
  if (newValue && chatList.value.length === 0) {
    fetchChatList(0, '');
  }
  
  // Set up WebSocket listeners when dialog opens
  if (newValue) {
    setupWebSocketListeners();
  } else {
    cleanupWebSocketListeners();
  }
}, { immediate: true });

function setupWebSocketListeners() {
  // Listen for "seen" events (message read receipts)
  unsubscribeSeen = websocketManager.on('seen', (data) => {
    console.log('[ChatDialog] Message seen:', data);
    // Update chat item if it exists
    const chat = chatList.value.find(c => c.group_id === data.group_id);
    if (chat) {
      // Mark as read or update status
      // You can update the chat's message_status here
    }
  });

  // Listen for new messages
  unsubscribeMessage = websocketManager.on('message', (data) => {
    console.log('[ChatDialog] New message:', data);
    // Refresh chat list or update specific chat
    if (!searchQuery.value.trim()) {
      fetchChatList(0, '');
    }
  });

  // Listen for online status changes
  unsubscribeOnline = websocketManager.on('online', (data) => {
    console.log('[ChatDialog] Online status:', data);
    // Update online status for the chat
    const chat = chatList.value.find(c => c.db_id === data.db_id);
    if (chat) {
      chat.online = data.online || 0;
    }
  });
}

function cleanupWebSocketListeners() {
  if (unsubscribeSeen) {
    unsubscribeSeen();
    unsubscribeSeen = null;
  }
  if (unsubscribeMessage) {
    unsubscribeMessage();
    unsubscribeMessage = null;
  }
  if (unsubscribeOnline) {
    unsubscribeOnline();
    unsubscribeOnline = null;
  }
}

onMounted(() => {
  if (props.modelValue && chatList.value.length === 0) {
    fetchChatList(0, '');
  }
  if (props.modelValue) {
    setupWebSocketListeners();
  }
});

onUnmounted(() => {
  cleanupWebSocketListeners();
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
        <h2 class="text-xl font-semibold text-white">Chats</h2>
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
        <!-- Left Sidebar - Chat List -->
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
          <div class="flex-1 overflow-y-auto" @scroll="handleScroll">
            <div v-if="isLoading && chatList.length === 0" class="flex items-center justify-center h-full">
              <div class="flex flex-col items-center gap-3">
                <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div class="text-[#999]">Loading chats...</div>
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
                :key="chat.group_id"
                :chat="chat"
                :selected="selectedChat?.group_id === chat.group_id"
                @click="handleChatClick(chat)"
              />
              
              <!-- Loading more indicator -->
              <div v-if="isLoadingMore" class="flex items-center justify-center py-4">
                <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side - Chat Messages Area -->
        <div class="flex-1 flex flex-col bg-[#1a1a1a]">
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
          <div v-else class="flex-1 flex flex-col">
            <!-- Chat Header -->
            <div class="px-6 py-4 border-b border-[#333] shrink-0 flex items-center gap-4">
              <img
                :src="`https://pictures.sdc.com/photos/${selectedChat.primary_photo}`"
                :alt="selectedChat.account_id"
                class="w-10 h-10 rounded-full object-cover"
              />
              <div class="flex-1">
                <h3 class="text-white font-semibold">{{ selectedChat.account_id }}</h3>
                <p v-if="selectedChat.online === 1" class="text-xs text-green-500">Online</p>
                <p v-else class="text-xs text-[#999]">Offline</p>
              </div>
            </div>

            <!-- Messages Area (Placeholder) -->
            <div class="flex-1 overflow-y-auto p-6">
              <div class="text-center text-[#999]">
                <p>Chat messages will appear here</p>
                <p class="text-sm mt-2">Coming soon...</p>
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


