<script lang="ts" setup>
import { useDroppable } from '@vue-dnd-kit/core';

interface Props {
  folderId: number | null; // null for inbox
  folderName: string;
  selected: boolean;
  unreadCount: number;
  icon?: 'inbox' | 'folder';
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'folder',
});

const emit = defineEmits<{
  click: [folderId: number | null];
  drop: [payload: any, folderId: number | null];
}>();

const { elementRef, isOvered } = useDroppable({
  events: {
    onDrop: async (store, payload) => {
      try {
        emit('drop', payload, props.folderId);
        return true;
      } catch (error) {
        console.error('Error in drop handler:', error);
        return false;
      }
    },
  },
});

function handleClick() {
  emit('click', props.folderId);
}
</script>

<template>
  <button
    ref="elementRef"
    @click="handleClick"
    :class="[
      'w-full px-4 py-3 text-left flex items-center justify-between hover:bg-background transition-colors relative',
      selected ? 'bg-background border-l-2 border-blue-500' : '',
      isOvered ? 'bg-blue-500/20 border-l-2 border-blue-500' : ''
    ]"
    style="min-width: 0; max-width: 100%; box-sizing: border-box; width: 100%;"
  >
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <!-- Inbox Icon -->
      <svg
        v-if="icon === 'inbox'"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-muted-foreground shrink-0"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
      <!-- Folder Icon -->
      <svg
        v-else
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-muted-foreground shrink-0"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="text-white text-sm truncate">{{ folderName }}</span>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <span v-if="unreadCount > 0" class="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </div>
  </button>
</template>
