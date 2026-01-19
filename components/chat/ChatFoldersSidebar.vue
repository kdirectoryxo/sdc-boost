<script lang="ts" setup>
import { ref } from 'vue';
import type { MessengerFolder } from '@/lib/sdc-api-types';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import Dropdown from '@/components/ui/Dropdown.vue';
import FolderEditDialog from '@/components/chat/FolderEditDialog.vue';
import DroppableFolderItem from '@/components/chat/DroppableFolderItem.vue';
import { useChatFolders } from '@/lib/composables/chat/useChatFolders';
import { confirm } from '@/lib/confirm';
import { toast } from '@/lib/toast';

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
      <DroppableFolderItem
        :folder-id="null"
        folder-name="Inbox"
        :selected="selectedFolderId === 0 && !showArchives"
        :unread-count="getInboxUnreadCount()"
        icon="inbox"
        @click="handleSelectInbox"
        @drop="handleChatDrop"
      />

      <!-- Folder List -->
      <template v-for="folder in folders" :key="`folder-${folder.id}`">
        <div class="border-t border-[#333] group">
          <div class="relative flex items-center w-full">
            <DroppableFolderItem
              :folder-id="folder.id"
              :folder-name="folder.name"
              :selected="selectedFolderId === folder.id && !showArchives"
              :unread-count="getFolderUnreadCount(folder.id)"
              icon="folder"
              @click="handleSelectFolder"
              @drop="handleChatDrop"
              class="flex-1 min-w-0"
            />
          <!-- Settings Icon - visible on hover -->
          <div class="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
                    class="text-[#999] group-hover/btn:text-white transition-colors"
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
                    class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#333] transition-colors flex items-center gap-2"
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
                      class="text-[#999]"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    <span>Edit</span>
                  </button>
                  <button
                    @click="handleDeleteFolder(folder); close()"
                    class="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#333] transition-colors flex items-center gap-2"
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
      <div class="border-t border-[#333]">
        <button
          @click="handleNewFolder"
          class="w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-[#1a1a1a] transition-colors group/new-folder"
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
            class="text-[#666] group-hover/new-folder:text-[#999] transition-colors"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span class="text-[#666] text-sm group-hover/new-folder:text-[#999] transition-colors">New Folder</span>
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

    <!-- Folder Edit Dialog -->
    <FolderEditDialog
      v-model="showEditDialog"
      :folder="editingFolder"
      :error-message="folderEditError"
      @save="handleDialogSave"
    />
  </div>
</template>


