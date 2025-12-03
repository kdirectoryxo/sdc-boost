<script lang="ts" setup>
import Dropdown from '@/components/ui/Dropdown.vue';
import type { MessengerMessage } from '@/lib/sdc-api-types';

interface Props {
  messageInput: string;
  quotedMessage: MessengerMessage | null;
  uploadedMedia: Array<{ file: File; preview: string; type: 'image' | 'video' }>;
  isUploadDropdownOpen: boolean;
  isUploading: boolean;
  isWebSocketConnected: boolean;
  selectedChat: { group_id: number } | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:messageInput': [value: string];
  'update:isUploadDropdownOpen': [value: boolean];
  'send-message': [];
  'cancel-quote': [];
  'clear-uploaded-media': [];
  'remove-uploaded-media': [index: number];
  'trigger-photo-picker': [];
  'trigger-video-picker': [];
  'handle-message-input': [];
  'open-album-modal': [];
}>();

function handleInput(event: Event) {
  emit('update:messageInput', (event.target as HTMLInputElement).value);
  emit('handle-message-input');
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    emit('send-message');
  }
}
</script>

<template>
  <div class="px-6 py-4 border-t border-[#333] shrink-0">
    <!-- Quoted Message Indicator -->
    <div v-if="quotedMessage" class="mb-2 px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded-lg flex items-start gap-2">
      <div class="flex-1 min-w-0">
        <div class="text-xs text-[#999] mb-1">Quoting {{ quotedMessage.account_id }}</div>
        <div class="text-sm text-white line-clamp-2">{{ quotedMessage.message }}</div>
      </div>
      <button
        @click="$emit('cancel-quote')"
        class="p-1 hover:bg-[#2a2a2a] rounded transition-colors shrink-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999]">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <!-- Uploaded Media Preview -->
    <div v-if="uploadedMedia.length > 0" class="mb-2 px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded-lg">
      <div class="flex items-center justify-between mb-2">
        <div class="text-xs text-[#999]">{{ uploadedMedia.length }} {{ uploadedMedia.length === 1 ? 'file' : 'files' }} ready to send</div>
        <button
          @click="$emit('clear-uploaded-media')"
          class="p-1 hover:bg-[#2a2a2a] rounded transition-colors shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999]">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="grid gap-2" :class="uploadedMedia.length === 1 ? 'grid-cols-1' : 'grid-cols-2'">
        <div
          v-for="(media, index) in uploadedMedia"
          :key="index"
          class="relative group"
        >
          <img
            v-if="media.type === 'image'"
            :src="media.preview"
            alt="Preview"
            class="w-full max-h-[200px] rounded object-cover"
          />
          <video
            v-else
            :src="media.preview"
            class="w-full max-h-[200px] rounded object-cover"
            controls
          />
          <button
            @click="$emit('remove-uploaded-media', index)"
            class="absolute top-1 right-1 p-1 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <input
        :value="messageInput"
        @input="handleInput"
        @keydown="handleKeydown"
        type="text"
        placeholder="Type a message..."
        :disabled="!selectedChat || !isWebSocketConnected || isUploading"
        class="flex-1 px-4 py-2 bg-[#0f0f0f] border border-[#333] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <Dropdown
        :model-value="isUploadDropdownOpen"
        @update:model-value="$emit('update:isUploadDropdownOpen', $event)"
        placement="top"
        alignment="end"
        width="w-48"
        offset="mb-2"
      >
        <template #trigger="{ toggle }">
          <button
            @click.stop="toggle"
            :disabled="!selectedChat || !isWebSocketConnected || isUploading"
            class="p-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-[#333]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </template>
        <template #content="{ close }">
          <div class="py-1">
            <button
              @click="$emit('trigger-photo-picker'); close()"
              class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              Photo's
            </button>
            <button
              @click="$emit('trigger-video-picker'); close()"
              class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
              Video's
            </button>
            <button
              @click="$emit('open-album-modal'); close()"
              class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              SDC Album
            </button>
          </div>
        </template>
      </Dropdown>
      <button
        @click="$emit('send-message')"
        :disabled="!selectedChat || (!messageInput.trim() && uploadedMedia.length === 0) || !isWebSocketConnected || isUploading"
        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="isUploading">Uploading...</span>
        <span v-else>Send</span>
      </button>
    </div>
  </div>
</template>

