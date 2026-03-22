<script lang="ts" setup>
import { RefreshCw, Settings, X } from 'lucide-vue-next';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { Button } from '@/lib/view-router/ui/button';
import { Badge } from '@/lib/view-router/ui/badge';

interface Props {
  isWebSocketConnected: boolean;
  isSyncingMessages: boolean;
  selectedChat?: MessengerChatItem | null;
  fullProfileSyncDone?: boolean;
  /** When false (e.g. hub page), hide the close control; navigation uses shell/breadcrumb. */
  showClose?: boolean;
}

withDefaults(defineProps<Props>(), {
  fullProfileSyncDone: false,
  showClose: true,
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
  emit('sync-all-chats');
}

function handleOpenSettings() {
  emit('open-settings');
}
</script>

<template>
  <div class="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-4">
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <h2 class="shrink-0 text-xl font-semibold text-white">Chats</h2>
      <div class="flex shrink-0 items-center gap-2">
        <Badge
          variant="outline"
          class="border-transparent px-0 font-normal text-xs text-white/40"
          :title="isWebSocketConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'"
        >
          <span
            class="mr-1.5 inline-block size-2 rounded-full"
            :class="isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'"
          />
          {{ isWebSocketConnected ? 'Live' : 'Offline' }}
        </Badge>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        :disabled="isSyncingMessages"
        :title="isSyncingMessages ? 'Syncing messages...' : 'Sync messages for unsynced chats'"
        @click="handleSyncMessages"
      >
        <RefreshCw
          class="size-5 text-muted-foreground"
          :class="isSyncingMessages ? 'animate-spin text-blue-500' : ''"
        />
      </Button>
      <Button variant="ghost" size="icon" title="Settings" @click="handleOpenSettings">
        <Settings class="size-5 text-muted-foreground" />
      </Button>
      <Button v-if="showClose" variant="ghost" size="icon" title="Close" @click="handleClose">
        <X class="size-5 text-muted-foreground" />
      </Button>
    </div>
  </div>
</template>
