<script lang="ts" setup>
interface Props {
  isWebSocketConnected: boolean;
  isSyncingMessages: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  syncMessages: [];
}>();

function handleClose() {
  emit('close');
}

function handleSyncMessages() {
  emit('syncMessages');
}
</script>

<template>
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

