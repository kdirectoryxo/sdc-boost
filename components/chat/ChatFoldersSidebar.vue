<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useChatFoldersSidebarCollapsed } from '@/lib/composables/chat/useChatFoldersSidebarCollapsed';
import type { MessengerFolder } from '@/lib/sdc-api-types';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { ChevronLeft, MoreVertical, Plus, RefreshCw, Settings } from 'lucide-vue-next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/lib/view-router/ui/dropdown-menu';
import { Button } from '@/lib/view-router/ui/button';
import { ScrollArea } from '@/lib/view-router/ui/scroll-area';
import { Badge } from '@/lib/view-router/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/lib/view-router/ui/tooltip';
import FolderEditDialog from '@/components/chat/FolderEditDialog.vue';
import DroppableFolderItem from '@/components/chat/DroppableFolderItem.vue';
import { useChatFolders } from '@/lib/composables/chat/useChatFolders';
import { confirm } from '@/lib/confirm';
import { toast } from '@/lib/toast';

const { collapsed } = useChatFoldersSidebarCollapsed();

/** Labels are visible when expanded — tooltips only needed in collapsed (icon) mode. */
const folderTooltipsDisabled = computed(() => !collapsed.value);

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

function handleEditFolder(folder: MessengerFolder) {
  editingFolder.value = folder;
  folderEditError.value = null;
  showEditDialog.value = true;
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
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        class="text-muted-foreground hover:bg-white/[0.08] hover:text-white"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="toggleCollapsed"
      >
        <ChevronLeft class="size-4 transition-transform duration-200" :class="collapsed ? 'rotate-180' : ''" />
      </Button>
    </div>

    <TooltipProvider :delay-duration="200">
    <ScrollArea class="min-h-0 flex-1">
      <!-- All Chats -->
      <Tooltip :disabled="folderTooltipsDisabled">
        <TooltipTrigger as-child>
          <button
            @click="handleSelectAll"
            :class="[
              'w-full text-left flex items-center hover:bg-background transition-colors',
              collapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-4 py-3',
              selectedFolderId === null && !showArchives ? 'bg-background border-l-2 border-blue-500' : '',
            ]"
          >
            <div :class="['flex items-center', collapsed ? 'justify-center' : 'gap-2']">
              <span :class="collapsed ? 'relative inline-flex' : 'contents'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-muted-foreground">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <Badge
                  v-if="collapsed && getTotalUnreadCount() > 0"
                  variant="destructive"
                  :class="[
                    'pointer-events-none absolute -right-2.5 -top-2.5 z-10 inline-flex items-center justify-center border-0 p-0 font-bold tabular-nums leading-none text-white shadow-sm',
                    getTotalUnreadCount() > 9 ? 'min-h-[15px] min-w-[15px] px-0.5 text-[9px]' : 'size-[15px] text-[9px]',
                  ]"
                >
                  {{ getTotalUnreadCount() > 9 ? '9+' : getTotalUnreadCount() }}
                </Badge>
              </span>
              <span v-if="!collapsed" class="text-white text-sm">All Chats</span>
            </div>
            <Badge
              v-if="!collapsed && getTotalUnreadCount() > 0"
              variant="destructive"
              :class="[
                'inline-flex shrink-0 items-center justify-center border-0 text-xs font-bold tabular-nums leading-none',
                getTotalUnreadCount() > 99
                  ? 'h-5 min-w-[30px] px-1'
                  : getTotalUnreadCount() > 9
                    ? 'h-5 min-w-[22px] px-1.5'
                    : 'size-5 px-0',
              ]"
            >
              {{ getTotalUnreadCount() > 99 ? '99+' : getTotalUnreadCount() }}
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" :side-offset="4">
          All Chats
        </TooltipContent>
      </Tooltip>

      <!-- Inbox (no folder) -->
      <Tooltip :disabled="folderTooltipsDisabled">
        <TooltipTrigger as-child>
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
        </TooltipTrigger>
        <TooltipContent side="right" :side-offset="4">
          Inbox
        </TooltipContent>
      </Tooltip>

      <!-- Folder List -->
      <template v-for="folder in folders" :key="`folder-${folder.id}`">
        <div class="border-t border-white/[0.06] group">
          <div class="relative flex items-center w-full">
            <Tooltip :disabled="folderTooltipsDisabled">
              <TooltipTrigger as-child>
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
              </TooltipTrigger>
              <TooltipContent side="right" :side-offset="4">
                {{ folder.name }}
              </TooltipContent>
            </Tooltip>
            <div v-if="!collapsed" class="absolute right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    class="group/btn"
                    title="Folder settings"
                    @click.stop
                  >
                    <MoreVertical class="size-4 text-muted-foreground transition-colors group-hover/btn:text-white" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent class="w-40" align="end" side="bottom" :side-offset="4">
                  <DropdownMenuItem class="cursor-pointer" @click="handleEditFolder(folder)">
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
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    class="cursor-pointer"
                    @click="handleDeleteFolder(folder)"
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
                    >
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </template>

      <!-- New Folder Button -->
      <div class="border-t border-white/[0.06]">
        <Tooltip :disabled="folderTooltipsDisabled">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              :class="[
                'group/new-folder h-auto w-full rounded-none py-2.5 hover:bg-background',
                collapsed ? 'justify-center px-0' : 'justify-start gap-2 px-4 text-left',
              ]"
              title="New folder"
              @click="handleNewFolder"
            >
              <Plus class="size-4 shrink-0 text-white/40 transition-colors group-hover/new-folder:text-muted-foreground" />
              <span v-if="!collapsed" class="text-sm text-white/40 transition-colors group-hover/new-folder:text-muted-foreground">New Folder</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" :side-offset="4">
            New Folder
          </TooltipContent>
        </Tooltip>
      </div>

      <!-- Divider before Archives -->
      <div class="border-t border-white/[0.06] my-2"></div>

      <!-- Archives -->
      <Tooltip :disabled="folderTooltipsDisabled">
        <TooltipTrigger as-child>
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
        </TooltipTrigger>
        <TooltipContent side="right" :side-offset="4">
          Archives
        </TooltipContent>
      </Tooltip>
    </ScrollArea>

    <!-- Hub: connection + sync / settings -->
    <div
      v-if="showHubToolbar"
      class="flex shrink-0 flex-col gap-1 border-t border-white/[0.06] px-2 py-2"
    >
      <Tooltip :disabled="folderTooltipsDisabled">
        <TooltipTrigger as-child>
          <div :class="['flex min-w-0 items-center rounded-md py-1.5', collapsed ? 'justify-center px-0' : 'gap-2 px-2']">
            <div
              :class="[
                'h-2 w-2 shrink-0 rounded-full',
                isWebSocketConnected ? 'bg-green-500' : 'bg-red-500',
              ]"
            />
            <span v-if="!collapsed" class="truncate text-xs text-white/40">
              {{ isWebSocketConnected ? 'Live' : 'Offline' }}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" :side-offset="4">
          {{ isWebSocketConnected ? 'Live' : 'Offline' }}
        </TooltipContent>
      </Tooltip>
      <Tooltip :disabled="folderTooltipsDisabled">
        <TooltipTrigger as-child>
          <Button
            type="button"
            variant="ghost"
            :disabled="isSyncingMessages"
            :class="[
              'h-auto w-full justify-start rounded-md py-1.5 hover:bg-white/[0.08]',
              collapsed ? 'justify-center px-0' : 'gap-2 px-2',
            ]"
            :title="isSyncingMessages ? 'Syncing messages...' : 'Sync messages for unsynced chats'"
            @click="handleHubSync"
          >
            <RefreshCw
              class="size-4 shrink-0 text-muted-foreground"
              :class="isSyncingMessages ? 'animate-spin text-blue-500' : ''"
            />
            <span v-if="!collapsed" class="text-xs text-white/40">{{ isSyncingMessages ? 'Syncing…' : 'Refresh' }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" :side-offset="4">
          {{ isSyncingMessages ? 'Syncing…' : 'Refresh' }}
        </TooltipContent>
      </Tooltip>
      <Tooltip :disabled="folderTooltipsDisabled">
        <TooltipTrigger as-child>
          <Button
            type="button"
            variant="ghost"
            :class="[
              'h-auto w-full justify-start rounded-md py-1.5 hover:bg-white/[0.08]',
              collapsed ? 'justify-center px-0' : 'gap-2 px-2',
            ]"
            title="Settings"
            @click="handleHubSettings"
          >
            <Settings class="size-4 shrink-0 text-muted-foreground" />
            <span v-if="!collapsed" class="text-xs text-white/40">Settings</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" :side-offset="4">
          Settings
        </TooltipContent>
      </Tooltip>
    </div>

    </TooltipProvider>

    <!-- Folder Edit Dialog -->
    <FolderEditDialog
      v-model="showEditDialog"
      :folder="editingFolder"
      :error-message="folderEditError"
      @save="handleDialogSave"
    />
  </div>
</template>


