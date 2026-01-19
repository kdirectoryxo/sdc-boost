<script lang="ts" setup>
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
	'open-settings': [];
}>();

function handleClose() {
  emit('close');
}

function handleSyncMessages() {
  console.log('handleSyncMessages');
  emit('sync-all-chats');
}

function handleOpenSettings() {
  emit('open-settings');
}
</script>

<template>
  <div class="flex items-center justify-between px-6 py-4 border-b border-[#333] shrink-0">
    <div class="flex items-center gap-3 flex-1 min-w-0">
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
      <!-- Settings Button -->
      <button
        @click="handleOpenSettings"
        class="p-2 hover:bg-[#333] rounded-md transition-colors"
        title="Settings"
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
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
          <circle cx="12" cy="12" r="3"></circle>
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


