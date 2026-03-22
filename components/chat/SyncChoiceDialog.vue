<script lang="ts" setup>
import { watch, onUnmounted } from 'vue';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'select': [choice: 'sync-unsynced' | 'resync-all' | 'resync-newest' | 'sync-profiles' | 'sync-profiles-reset'];
}>();

let escapeHandler: ((e: KeyboardEvent) => void) | null = null;

function handleClose() {
  emit('update:modelValue', false);
}

function handleSelect(choice: 'sync-unsynced' | 'resync-all' | 'resync-newest' | 'sync-profiles' | 'sync-profiles-reset') {
  emit('select', choice);
  handleClose();
}

function handleSyncProfiles(event: MouseEvent) {
  const reset = event.shiftKey;
  handleSelect(reset ? 'sync-profiles-reset' : 'sync-profiles');
}

// Close on Escape key
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', escapeHandler);
  } else {
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
      escapeHandler = null;
    }
  }
});

onUnmounted(() => {
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
  }
});
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-[1000000]"
    style="pointer-events: auto; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
    @click.self="handleClose"
  >
    <div
      class="bg-background border border-white/[0.06] rounded-lg shadow-2xl min-w-[400px] max-w-[500px] overflow-hidden"
      @click.stop
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-white/[0.06]">
        <h3 class="text-lg font-semibold text-white">Sync All Chat</h3>
        <p class="text-sm text-muted-foreground mt-1">Choose how you want to sync chats</p>
      </div>

      <!-- Options -->
      <div class="p-4 space-y-2">
        <button
          @click="handleSelect('sync-unsynced')"
          class="w-full px-4 py-3 text-left bg-sidebar hover:bg-secondary active:bg-white/[0.08] active:scale-[0.98] border border-white/[0.06] rounded-lg transition-all duration-150 group cursor-pointer"
        >
          <div class="font-medium text-white mb-1">Sync unsynced</div>
          <div class="text-sm text-muted-foreground">Sync all chats that have no sync date</div>
        </button>

        <button
          @click="handleSelect('resync-all')"
          class="w-full px-4 py-3 text-left bg-sidebar hover:bg-secondary active:bg-white/[0.08] active:scale-[0.98] border border-white/[0.06] rounded-lg transition-all duration-150 group cursor-pointer"
        >
          <div class="font-medium text-white mb-1">Resync all</div>
          <div class="text-sm text-muted-foreground">Force resync all chats (all pages)</div>
        </button>

        <button
          @click="handleSelect('resync-newest')"
          class="w-full px-4 py-3 text-left bg-sidebar hover:bg-secondary active:bg-white/[0.08] active:scale-[0.98] border border-white/[0.06] rounded-lg transition-all duration-150 group cursor-pointer"
        >
          <div class="font-medium text-white mb-1">Resync newest</div>
          <div class="text-sm text-muted-foreground">Force resync first page of all chats</div>
        </button>

        <button
          @click="handleSyncProfiles"
          class="w-full px-4 py-3 text-left bg-sidebar hover:bg-secondary active:bg-white/[0.08] active:scale-[0.98] border border-white/[0.06] rounded-lg transition-all duration-150 group cursor-pointer"
        >
          <div class="font-medium text-white mb-1">Sync Profile Data</div>
          <div class="text-sm text-muted-foreground">Sync profile data for chats (hold Shift to reset and resync all)</div>
        </button>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-white/[0.06] flex justify-end">
        <button
          @click="handleClose"
          class="px-4 py-2 text-sm text-muted-foreground hover:text-white active:text-white/80 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

