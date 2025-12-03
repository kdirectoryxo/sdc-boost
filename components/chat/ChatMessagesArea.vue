<script lang="ts" setup>
import { ref } from 'vue';
import type { MessengerChatItem, MessengerMessage } from '@/lib/sdc-api-types';
import ChatMessageItem from '@/components/chat/ChatMessageItem.vue';

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
}>();

const messagesContainer = ref<HTMLElement | null>(null);

defineExpose({
  messagesContainer
});

function handleContainerClick() {
  emit('update:openDropdownMessageId', null);
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
    <div class="px-6 py-4 border-b border-[#333] shrink-0 flex items-center gap-4 min-w-0">
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
        <p v-if="selectedChat.online === 1" class="text-xs text-green-500">Online</p>
        <p v-else class="text-xs text-[#999]">Offline</p>
      </div>
      
      <slot name="message-search" />
    </div>

    <!-- Messages Area -->
    <div 
      ref="messagesContainer"
      @click="handleContainerClick"
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

    <slot name="message-input" />
  </div>
</template>

