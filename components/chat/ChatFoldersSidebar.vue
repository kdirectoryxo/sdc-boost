<script lang="ts" setup>
import type { MessengerFolder } from '@/lib/sdc-api-types';

interface Props {
  folders: MessengerFolder[];
  selectedFolderId: number | null;
  showArchives: boolean;
  getTotalUnreadCount: () => number;
  getInboxUnreadCount: () => number;
  getFolderUnreadCount: (folderId: number) => number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'select-folder': [folderId: number | null];
  'select-archives': [];
}>();

function handleSelectAll() {
  emit('select-folder', null);
}

function handleSelectInbox() {
  emit('select-folder', 0);
}

function handleSelectFolder(folderId: number) {
  emit('select-folder', folderId);
}

function handleSelectArchives() {
  emit('select-archives');
}
</script>

<template>
  <div class="w-[200px] border-r border-[#333] flex flex-col bg-[#0f0f0f] overflow-y-auto shrink-0">
    <div class="p-4 border-b border-[#333] shrink-0">
      <h3 class="text-sm font-semibold text-[#999] uppercase tracking-wide">Folders</h3>
    </div>
    <div class="flex-1 overflow-y-auto">
      <!-- All Chats -->
      <button
        @click="handleSelectAll"
        :class="[
          'w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#1a1a1a] transition-colors',
          selectedFolderId === null && !showArchives ? 'bg-[#1a1a1a] border-l-2 border-blue-500' : ''
        ]"
      >
        <div class="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999]">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="text-white text-sm">All Chats</span>
        </div>
        <span v-if="getTotalUnreadCount() > 0" class="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
          {{ getTotalUnreadCount() > 99 ? '99+' : getTotalUnreadCount() }}
        </span>
      </button>

      <!-- Inbox (no folder) -->
      <button
        @click="handleSelectInbox"
        :class="[
          'w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#1a1a1a] transition-colors',
          selectedFolderId === 0 && !showArchives ? 'bg-[#1a1a1a] border-l-2 border-blue-500' : ''
        ]"
      >
        <div class="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999]">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span class="text-white text-sm">Inbox</span>
        </div>
        <span v-if="getInboxUnreadCount() > 0" class="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
          {{ getInboxUnreadCount() > 99 ? '99+' : getInboxUnreadCount() }}
        </span>
      </button>

      <!-- Folder List -->
      <div v-for="folder in folders" :key="folder.id" class="border-t border-[#333]">
        <button
          @click="handleSelectFolder(folder.id)"
          :class="[
            'w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#1a1a1a] transition-colors',
            selectedFolderId === folder.id && !showArchives ? 'bg-[#1a1a1a] border-l-2 border-blue-500' : ''
          ]"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] shrink-0">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="text-white text-sm truncate">{{ folder.name }}</span>
          </div>
          <span v-if="getFolderUnreadCount(folder.id) > 0" class="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center shrink-0 ml-2">
            {{ getFolderUnreadCount(folder.id) > 99 ? '99+' : getFolderUnreadCount(folder.id) }}
          </span>
        </button>
      </div>

      <!-- Divider before Archives -->
      <div class="border-t border-[#333] my-2"></div>

      <!-- Archives -->
      <button
        @click="handleSelectArchives"
        :class="[
          'w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#1a1a1a] transition-colors',
          showArchives ? 'bg-[#1a1a1a] border-l-2 border-blue-500' : ''
        ]"
      >
        <div class="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999]">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span class="text-white text-sm">Archives</span>
        </div>
      </button>
    </div>
  </div>
</template>

