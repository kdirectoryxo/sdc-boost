<script lang="ts" setup>
import { ref } from 'vue';
import type { MessengerFolder } from '@/lib/sdc-api-types';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import Dropdown from '@/components/ui/Dropdown.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import FolderEditDialog from '@/components/chat/FolderEditDialog.vue';
import DroppableFolderItem from '@/components/chat/DroppableFolderItem.vue';
import { useChatFolders } from '@/lib/composables/chat/useChatFolders';
import { confirm } from '@/lib/confirm';
import { toast } from '@/lib/toast';

const collapsed = ref(false);

function toggleCollapsed() {
  collapsed.value = !collapsed.value;
}

interface Props {
  folders: MessengerFolder[];
  selectedFolderId: number | null;
  showArchives: boolean;
  getTotalUnreadCount: () => number;
  getInboxUnreadCount: () => number;
  getFolderUnreadCount: (folderId: number) => number;
  /** Hub page: connection + sync/settings in this sidebar (no chat dialog header). */
  showHubToolbar?: boolean;
  isWebSocketConnected?: boolean;
  isSyncingMessages?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showHubToolbar: false,
  isWebSocketConnected: true,
  isSyncingMessages: false,
});

const emit = defineEmits<{
  'select-folder': [folderId: number | null];
  'select-archives': [];
  'sync-all-chats': [];
  'open-settings': [];
}>();

function handleHubSync() {
  emit('sync-all-chats');
}

function handleHubSettings() {
  emit('open-settings');
}

const { updateFolderName, createFolder, deleteFolder, moveChatToFolder } = useChatFolders();

const editingFolder = ref<MessengerFolder | null>(null);
const showEditDialog = ref(false);
const folderDropdownOpen = ref<Record<number, boolean>>({});
const folderEditError = ref<string | null>(null);

function handleSelectAll() {
  emit('select-folder', null);
}

function handleSelectInbox(folderId: number | null) {
  emit('select-folder', 0);
}

function handleSelectFolder(folderId: number | null) {
  if (folderId === null) {
    emit('select-folder', 0); // Inbox
  } else {
    emit('select-folder', folderId);
  }
}

function handleSelectArchives() {
  emit('select-archives');
}

function getDropdownOpen(folderId: number): boolean {
  return folderDropdownOpen.value[folderId] || false;
}

function setDropdownOpen(folderId: number, value: boolean): void {
  folderDropdownOpen.value[folderId] = value;
}

function handleEditFolder(folder: MessengerFolder) {
  editingFolder.value = folder;
  folderEditError.value = null;
  showEditDialog.value = true;
  setDropdownOpen(folder.id, false);
}

function handleNewFolder() {
  editingFolder.value = null;
  folderEditError.value = null;
  showEditDialog.value = true;
}

async function handleDeleteFolder(folder: MessengerFolder) {
  const confirmed = await confirm.confirm(
    `Are you sure you want to delete the folder "${folder.name}"?`,
    {
      confirmText: 'Delete',
      cancelText: 'Cancel',
    }
  );

  if (confirmed) {
    try {
      await deleteFolder(folder.id);
      // If the deleted folder was selected, reset selection
      if (props.selectedFolderId === folder.id) {
        emit('select-folder', null);
      }
      toast.success('Folder deleted successfully');
    } catch (error) {
      console.error('Failed to delete folder:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete folder');
    }
  }
}

async function handleDialogSave(newName: string) {
  folderEditError.value = null;
  
  try {
    if (editingFolder.value) {
      // Edit mode
      await updateFolderName(editingFolder.value.id, newName);
    } else {
      // Create mode
      await createFolder(newName);
    }
    // Success - close dialog
    showEditDialog.value = false;
    editingFolder.value = null;
    folderEditError.value = null;
  } catch (error) {
    console.error('Failed to save folder:', error);
    // Set error message - dialog will display it
    folderEditError.value = error instanceof Error ? error.message : 'Failed to save folder';
  }
}

// Drop handler for moving chat to folder
async function handleChatDrop(payload: any, targetFolderId: number | null): Promise<boolean> {
  const chat = payload.items?.[0]?.data?.chat as MessengerChatItem | undefined;
  
  if (!chat) {
    console.error('No chat data in drop payload');
    return false;
  }
  
  const currentFolderId = chat.folder_id ?? null;
  
  // If already in the target folder, do nothing
  if (currentFolderId === targetFolderId) {
    return true;
  }
  
  // If chat is in a different folder, ask for confirmation
  if (currentFolderId !== null && targetFolderId !== null) {
    const targetFolder = props.folders.find(f => f.id === targetFolderId);
    const currentFolder = props.folders.find(f => f.id === currentFolderId);
    
    const confirmed = await confirm.confirm(
      `Move chat from "${currentFolder?.name || 'folder'}" to "${targetFolder?.name || 'folder'}"?`,
      {
        confirmText: 'Move',
        cancelText: 'Cancel',
      }
    );
    
    if (!confirmed) {
      return false;
    }
  }
  
  try {
    await moveChatToFolder(chat.group_id, targetFolderId);
    
    // Focus the target folder after moving
    if (targetFolderId === null) {
      emit('select-folder', 0); // Select inbox
    } else {
      emit('select-folder', targetFolderId);
    }
    
    const folderName = targetFolderId === null ? 'Inbox' : props.folders.find(f => f.id === targetFolderId)?.name || 'folder';
    toast.success(`Chat moved to ${folderName}`);
    return true;
  } catch (error) {
    console.error('Failed to move chat to folder:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to move chat to folder');
    return false;
  }
}

</script>

<template>
  <div
    :class="[
      'flex h-full min-h-0 shrink-0 flex-col border-r border-white/[0.06] bg-sidebar transition-[width] duration-200',
      collapsed ? 'w-12' : 'w-[200px]',
    ]"
  >
    <!-- Header -->
    <div class="flex shrink-0 items-center border-b border-white/[0.06]" :class="collapsed ? 'justify-center p-2' : 'justify-between px-4 py-3'">
      <h3 v-if="!collapsed" class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Folders</h3>
      <button
        type="button"
        @click="toggleCollapsed"
        class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-white"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-transform duration-200"
          :class="collapsed ? 'rotate-180' : ''"
        >
          <path d="M11 17l-5-5 5-5" /><path d="M18 17l-5-5 5-5" />
        </svg>
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <!-- All Chats -->
      <Tooltip text="All Chats" position="right" :delay="200">
        <button
          @click="handleSelectAll"
          :class="[
            'w-full text-left flex items-center hover:bg-background transition-colors',
            collapsed ? 'justify-center px-0 py-2.5 relative' : 'justify-between px-4 py-3',
            selectedFolderId === null && !showArchives ? 'bg-background border-l-2 border-blue-500' : '',
          ]"
        >
          <div :class="['flex items-center', collapsed ? 'justify-center' : 'gap-2']">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-muted-foreground">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span v-if="!collapsed" class="text-white text-sm">All Chats</span>
          </div>
          <span
            v-if="!collapsed && getTotalUnreadCount() > 0"
            class="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center"
          >
            {{ getTotalUnreadCount() > 99 ? '99+' : getTotalUnreadCount() }}
          </span>
          <span
            v-if="collapsed && getTotalUnreadCount() > 0"
            class="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
          >
            {{ getTotalUnreadCount() > 9 ? '9+' : getTotalUnreadCount() }}
          </span>
        </button>
      </Tooltip>

      <!-- Inbox (no folder) -->
      <Tooltip text="Inbox" position="right" :delay="200">
        <DroppableFolderItem
          :folder-id="null"
          folder-name="Inbox"
          :selected="selectedFolderId === 0 && !showArchives"
          :unread-count="getInboxUnreadCount()"
          icon="inbox"
          :collapsed="collapsed"
          @click="handleSelectInbox"
          @drop="handleChatDrop"
        />
      </Tooltip>

      <!-- Folder List -->
      <template v-for="folder in folders" :key="`folder-${folder.id}`">
        <div class="border-t border-white/[0.06] group">
          <div class="relative flex items-center w-full">
            <Tooltip :text="folder.name" position="right" :delay="200">
              <DroppableFolderItem
                :folder-id="folder.id"
                :folder-name="folder.name"
                :selected="selectedFolderId === folder.id && !showArchives"
                :unread-count="getFolderUnreadCount(folder.id)"
                icon="folder"
                :collapsed="collapsed"
                @click="handleSelectFolder"
                @drop="handleChatDrop"
                class="flex-1 min-w-0"
              />
            </Tooltip>
            <div v-if="!collapsed" class="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Dropdown
                :modelValue="getDropdownOpen(folder.id)"
                @update:modelValue="(val) => setDropdownOpen(folder.id, val)"
                placement="bottom"
                alignment="end"
                width="w-40"
                offset="mt-1"
              >
                <template #trigger="{ toggle }">
                  <button
                    @click.stop="toggle()"
                    class="p-0 rounded transition-colors flex items-center justify-center group/btn"
                    title="Folder settings"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-muted-foreground group-hover/btn:text-white transition-colors"
                    >
                      <circle cx="12" cy="12" r="1"></circle>
                      <circle cx="12" cy="5" r="1"></circle>
                      <circle cx="12" cy="19" r="1"></circle>
                    </svg>
                  </button>
                </template>
                <template #content="{ close }">
                  <div class="py-1">
                    <button
                      @click="handleEditFolder(folder); close()"
                      class="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/[0.08] transition-colors flex items-center gap-2"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="text-muted-foreground"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      <span>Edit</span>
                    </button>
                    <button
                      @click="handleDeleteFolder(folder); close()"
                      class="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/[0.08] transition-colors flex items-center gap-2"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="text-red-400"
                      >
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </template>
              </Dropdown>
            </div>
          </div>
        </div>
      </template>

      <!-- New Folder Button -->
      <div class="border-t border-white/[0.06]">
        <Tooltip text="New Folder" position="right" :delay="200">
          <button
            @click="handleNewFolder"
            :class="[
              'w-full flex items-center hover:bg-background transition-colors group/new-folder',
              collapsed ? 'justify-center px-0 py-2.5' : 'text-left px-4 py-2.5 gap-2',
            ]"
            title="New folder"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="shrink-0 text-white/40 group-hover/new-folder:text-muted-foreground transition-colors"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span v-if="!collapsed" class="text-white/40 text-sm group-hover/new-folder:text-muted-foreground transition-colors">New Folder</span>
          </button>
        </Tooltip>
      </div>

      <!-- Divider before Archives -->
      <div class="border-t border-white/[0.06] my-2"></div>

      <!-- Archives -->
      <Tooltip text="Archives" position="right" :delay="200">
        <button
          @click="handleSelectArchives"
          :class="[
            'w-full text-left flex items-center hover:bg-background transition-colors',
            collapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-4 py-3',
            showArchives ? 'bg-background border-l-2 border-blue-500' : '',
          ]"
        >
          <div :class="['flex items-center', collapsed ? 'justify-center' : 'gap-2']">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-muted-foreground">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span v-if="!collapsed" class="text-white text-sm">Archives</span>
          </div>
        </button>
      </Tooltip>
    </div>

    <!-- Hub: connection + sync / settings -->
    <div
      v-if="showHubToolbar"
      class="flex shrink-0 flex-col gap-1 border-t border-white/[0.06] px-2 py-2"
    >
      <Tooltip :text="isWebSocketConnected ? 'Live' : 'Offline'" position="right" :delay="200">
        <div :class="['flex min-w-0 items-center rounded-md py-1.5', collapsed ? 'justify-center px-0' : 'gap-2 px-2']">
          <div
            :class="[
              'h-2 w-2 shrink-0 rounded-full',
              isWebSocketConnected ? 'bg-green-500' : 'bg-red-500',
            ]"
            :title="isWebSocketConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'"
          />
          <span v-if="!collapsed" class="truncate text-xs text-white/40">
            {{ isWebSocketConnected ? 'Live' : 'Offline' }}
          </span>
        </div>
      </Tooltip>
      <Tooltip :text="isSyncingMessages ? 'Syncing…' : 'Refresh'" position="right" :delay="200">
        <button
          type="button"
          @click="handleHubSync"
          :disabled="isSyncingMessages"
          :class="[
            'flex w-full items-center rounded-md py-1.5 transition-colors hover:bg-white/[0.08]',
            collapsed ? 'justify-center px-0' : 'gap-2 px-2',
            isSyncingMessages ? 'cursor-not-allowed opacity-50' : '',
          ]"
          :title="isSyncingMessages ? 'Syncing messages...' : 'Sync messages for unsynced chats'"
        >
          <svg
            v-if="!isSyncingMessages"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="shrink-0 text-muted-foreground"
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
          </svg>
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
            class="shrink-0 animate-spin text-blue-500"
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
          </svg>
          <span v-if="!collapsed" class="text-xs text-white/40">{{ isSyncingMessages ? 'Syncing…' : 'Refresh' }}</span>
        </button>
      </Tooltip>
      <Tooltip text="Settings" position="right" :delay="200">
        <button
          type="button"
          @click="handleHubSettings"
          :class="[
            'flex w-full items-center rounded-md py-1.5 transition-colors hover:bg-white/[0.08]',
            collapsed ? 'justify-center px-0' : 'gap-2 px-2',
          ]"
          title="Settings"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="shrink-0 text-muted-foreground"
          >
            <path
              d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
            ></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span v-if="!collapsed" class="text-xs text-white/40">Settings</span>
        </button>
      </Tooltip>
    </div>

    <!-- Folder Edit Dialog -->
    <FolderEditDialog
      v-model="showEditDialog"
      :folder="editingFolder"
      :error-message="folderEditError"
      @save="handleDialogSave"
    />
  </div>
</template>


