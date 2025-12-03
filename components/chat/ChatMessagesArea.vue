<script lang="ts" setup>
import { ref, computed } from 'vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import type { MessengerChatItem, MessengerMessage } from '@/lib/sdc-api-types';
import ChatMessageItem from '@/components/chat/ChatMessageItem.vue';
import { useChatPin } from '@/lib/composables/chat/useChatPin';

interface Props {
  selectedChat: MessengerChatItem | null;
  messages: MessengerMessage[];
  filteredMessages: MessengerMessage[];
  isLoadingMessages: boolean;
  isSyncing: boolean;
  messageError: string | null;
  isSearchActive: boolean;
  messageSearchResults: number[];
  currentSearchIndex: number;
  typingStates: Map<string, boolean>;
  openDropdownMessageId: number | null;
  messageSearchQuery?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:openDropdownMessageId': [value: number | null];
  'open-profile': [userId: number];
  'quote-message': [message: MessengerMessage];
  'copy-message': [message: MessengerMessage];
  'delete-message': [message: MessengerMessage];
  'scroll-to-quoted': [message: MessengerMessage];
  'open-lightbox': [message: MessengerMessage, imageIndex: number, event?: Event];
  'open-gallery': [message: MessengerMessage];
}>();

const messagesContainer = ref<HTMLElement | null>(null);
const { togglePinChat } = useChatPin();
const openHeaderDropdown = ref<boolean>(false);

defineExpose({
  messagesContainer
});

const isBroadcast = computed(() => {
  return props.selectedChat?.broadcast || props.selectedChat?.type === 100;
});

function handleContainerClick() {
  emit('update:openDropdownMessageId', null);
}

function handleTogglePin() {
  if (props.selectedChat) {
    togglePinChat(props.selectedChat);
    openHeaderDropdown.value = false;
  }
}

function handleHeaderDropdownToggle(open: boolean) {
  openHeaderDropdown.value = open;
}
</script>

<template>
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
    <div class="px-6 py-4 border-b border-[#333] shrink-0 flex items-center gap-4 min-w-0 relative z-50">
      <img
        :src="`https://pictures.sdc.com/photos/${selectedChat.primary_photo}`"
        :alt="selectedChat.account_id"
        @click="emit('open-profile', selectedChat.db_id)"
        class="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
        title="Click to view profile in new tab"
      />
      <div class="flex-1 min-w-0">
        <h3
          @click="emit('open-profile', selectedChat.db_id)"
          class="text-white font-semibold truncate cursor-pointer hover:text-blue-400 transition-colors"
          title="Click to view profile in new tab"
        >
          {{ selectedChat.account_id }}
        </h3>
        <p v-if="selectedChat.online === 1 && !isBroadcast" class="text-xs text-green-500">Online</p>
        <p v-else-if="!isBroadcast" class="text-xs text-[#999]">Offline</p>
        <p v-else class="text-xs text-yellow-400">📢 Broadcast</p>
      </div>
      
      <div v-if="!isBroadcast" class="flex items-center gap-2">
        <slot name="message-search" />
        
        <!-- Dropdown Menu -->
        <div @click.stop class="relative z-50">
          <Dropdown
            :model-value="openHeaderDropdown"
            @update:model-value="handleHeaderDropdownToggle"
            placement="bottom"
            alignment="end"
            width="w-32"
            offset="mt-1"
            :z-index="50"
          >
            <template #trigger="{ isOpen, toggle }">
              <button
                @click.stop="toggle"
                class="p-1.5 rounded hover:bg-[#2a2a2a] transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] hover:text-white">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
            </template>
            <template #content="{ close }">
              <div
                class="w-32 rounded-md shadow-lg bg-[#1a1a1a] border border-[#333] py-1"
                @click.stop
              >
                <button
                  @click.stop="handleTogglePin(); close()"
                  class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="17" x2="12" y2="22"></line>
                    <path d="M5 17h14l-1-7H6l-1 7z"></path>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  {{ selectedChat?.pin_chat === 1 ? 'Unpin chat' : 'Pin chat' }}
                </button>
              </div>
            </template>
          </Dropdown>
        </div>
      </div>
    </div>

    <!-- Broadcast Content -->
    <div 
      v-if="isBroadcast"
      ref="messagesContainer"
      class="flex-1 overflow-y-auto overflow-x-hidden p-6 min-w-0 relative bg-white"
    >
      <div v-if="selectedChat?.body" class="max-w-4xl mx-auto">
        <!-- Broadcast Subject -->
        <h2 v-if="selectedChat.subject" class="text-2xl font-bold text-gray-900 mb-4">
          {{ selectedChat.subject }}
        </h2>
        
        <!-- Broadcast Body HTML -->
        <div 
          class="broadcast-content prose max-w-none"
          v-html="selectedChat.body"
        ></div>
      </div>
      <div v-else class="flex items-center justify-center h-full">
        <div class="text-center text-gray-500">
          <p>No broadcast content available</p>
        </div>
      </div>
    </div>

    <!-- Messages Area (for regular chats) -->
    <div 
      v-else
      ref="messagesContainer"
      @click="handleContainerClick"
      class="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4 min-w-0 relative z-0"
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
      <div v-if="isLoadingMessages && messages.length === 0 && !messageError" class="flex justify-center py-8">
        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <!-- Error Message (e.g., blocked chat) -->
      <div v-else-if="messageError" class="flex flex-col items-center justify-center py-12 px-6">
        <div class="text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="mx-auto mb-4 text-red-500"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p class="text-red-500 text-lg font-semibold mb-2">{{ messageError }}</p>
          <p class="text-[#999] text-sm">This chat cannot be accessed</p>
        </div>
      </div>

      <!-- Messages List -->
      <div v-else-if="messages.length > 0" class="space-y-4 min-w-0">
        <ChatMessageItem
          v-for="(message, index) in filteredMessages"
          :key="message.message_id > 0 ? `msg_${message.message_id}` : `opt_${message.extra1 || index}_${message.date2}`"
          :message="message"
          :index="index"
          :selected-chat="selectedChat"
          :is-search-active="isSearchActive"
          :is-highlighted="isSearchActive && messageSearchResults[currentSearchIndex] === message.message_id"
          :open-dropdown-message-id="openDropdownMessageId"
          :message-search-query="messageSearchQuery"
          @update:open-dropdown-message-id="(value: number | null) => emit('update:openDropdownMessageId', value)"
          @quote-message="(message: MessengerMessage) => emit('quote-message', message)"
          @copy-message="(message: MessengerMessage) => emit('copy-message', message)"
          @delete-message="(message: MessengerMessage) => emit('delete-message', message)"
          @scroll-to-quoted="(message: MessengerMessage) => emit('scroll-to-quoted', message)"
          @open-lightbox="(message: MessengerMessage, imageIndex: number, event?: Event) => emit('open-lightbox', message, imageIndex, event)"
          @open-gallery="(message: MessengerMessage) => emit('open-gallery', message)"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="flex items-center justify-center h-full">
        <div class="text-center text-[#999]">
          <p v-if="isSearchActive && messages.length > 0">No messages match your search</p>
          <template v-else>
            <p>No messages yet</p>
            <p class="text-sm mt-2">Start the conversation!</p>
          </template>
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

    <!-- Message Input (only show for non-broadcast chats) -->
    <div v-if="!isBroadcast">
      <slot name="message-input" />
    </div>
  </div>
</template>

<style scoped>
.broadcast-content {
  color: #1f2937;
  line-height: 1.6;
}

.broadcast-content :deep(h1),
.broadcast-content :deep(h2),
.broadcast-content :deep(h3),
.broadcast-content :deep(h4),
.broadcast-content :deep(h5),
.broadcast-content :deep(h6) {
  color: #111827;
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}

.broadcast-content :deep(h1) {
  font-size: 2em;
}

.broadcast-content :deep(h2) {
  font-size: 1.5em;
}

.broadcast-content :deep(h3) {
  font-size: 1.25em;
}

.broadcast-content :deep(p) {
  margin-bottom: 1em;
  color: #1f2937;
}

.broadcast-content :deep(strong) {
  color: #111827;
  font-weight: 600;
}

.broadcast-content :deep(em) {
  font-style: italic;
}

.broadcast-content :deep(u) {
  text-decoration: underline;
}

.broadcast-content :deep(a) {
  color: #2563eb;
  text-decoration: underline;
  transition: color 0.2s;
}

.broadcast-content :deep(a:hover) {
  color: #1d4ed8;
}

.broadcast-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1em 0;
}

.broadcast-content :deep(ul),
.broadcast-content :deep(ol) {
  margin: 1em 0;
  padding-left: 2em;
  color: #1f2937;
}

.broadcast-content :deep(li) {
  margin-bottom: 0.5em;
}

.broadcast-content :deep(.ql-align-center) {
  text-align: center;
}

.broadcast-content :deep(.ql-indent-1) {
  padding-left: 1em;
}
</style>

