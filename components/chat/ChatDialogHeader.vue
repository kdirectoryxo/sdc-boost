<script lang="ts" setup>
import { computed } from 'vue';
import TagBadge from '@/components/ui/TagBadge.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import type { MessengerChatItem } from '@/lib/sdc-api-types';

interface Props {
  isWebSocketConnected: boolean;
  isSyncingMessages: boolean;
  selectedChat?: MessengerChatItem | null;
  fullProfileSyncDone?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  fullProfileSyncDone: false,
});

const emit = defineEmits<{
  close: [];
  'sync-all-chats': [];
}>();

// Get tags from selected chat (tags are merged from metadata)
const chatTags = computed(() => {
  if (!props.selectedChat) return [];
  return (props.selectedChat as any).tags || [];
});

function handleClose() {
  emit('close');
}

function handleSyncMessages() {
  console.log('handleSyncMessages');
  emit('sync-all-chats');
}
</script>

<template>
  <div class="flex items-center justify-between px-6 py-4 border-b border-[#333] shrink-0">
    <div class="flex items-center gap-3 flex-1 min-w-0">
      <!-- Full Profile Sync Indicator -->
      <Tooltip 
        v-if="props.fullProfileSyncDone" 
        text="Auto profile sync enabled - new chats will automatically sync profiles"
        position="bottom"
        align="start"
      >
        <div class="flex items-center justify-center w-5 h-5 shrink-0">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-blue-500"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
          </svg>
        </div>
      </Tooltip>
      <h2 class="text-xl font-semibold text-white shrink-0">Chats</h2>
      <!-- WebSocket Connection Status -->
      <div class="flex items-center gap-2 shrink-0">
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
      <!-- Tags -->
      <div v-if="chatTags.length > 0" class="flex items-center gap-1 shrink-0 ml-2">
        <TagBadge
          v-for="(tag, index) in chatTags"
          :key="index"
          :text="tag.text"
          :color="tag.color"
        />
      </div>
    </div>
    <div class="flex items-center gap-2">
      <!-- Sync Messages Button -->
      <button
        @click="handleSyncMessages"
        :disabled="isSyncingMessages"
        :class="[
          'p-2 hover:bg-[#333] rounded-md transition-colors',
          isSyncingMessages ? 'opacity-50 cursor-not-allowed' : ''
        ]"
        :title="isSyncingMessages ? 'Syncing messages...' : 'Sync messages for unsynced chats'"
      >
        <svg
          v-if="!isSyncingMessages"
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
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
        </svg>
        <svg
          v-else
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-blue-500 animate-spin"
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
        </svg>
      </button>
      <!-- Close Button -->
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
  </div>
</template>


