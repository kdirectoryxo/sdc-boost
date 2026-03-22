<script lang="ts" setup>
import { ref, watch, toRef, nextTick, computed } from 'vue';
import { Icon } from '@iconify/vue';
import VueEasyLightbox from 'vue-easy-lightbox';
import 'vue-easy-lightbox/dist/external-css/vue-easy-lightbox.css';
import { useChatState } from '@/lib/composables/chat/useChatState';
import { useChatFolders } from '@/lib/composables/chat/useChatFolders';
import { useChatFilters } from '@/lib/composables/chat/useChatFilters';
import { useChatMessages } from '@/lib/composables/chat/useChatMessages';
import { useChatInput } from '@/lib/composables/chat/useChatInput';
import { useChatUI } from '@/lib/composables/chat/useChatUI';
import { useChatWebSocket } from '@/lib/composables/chat/useChatWebSocket';
import { useChatSync } from '@/lib/composables/chat/useChatSync';
import { useChatSelection } from '@/lib/composables/chat/useChatSelection';
import { useChatDialogLifecycle } from '@/lib/composables/chat/useChatDialogLifecycle';
import { useProfileDialogs } from '@/lib/composables/chat/useProfileDialogs';
import { useGroupDialogs } from '@/lib/composables/chat/useGroupDialogs';
import { parseImageMessage, parseVideoMessage, parseGalleryMessage } from '@/lib/composables/chat/utils';
import ChatDialogHeader from '@/components/chat/ChatDialogHeader.vue';
import ChatFoldersSidebar from '@/components/chat/ChatFoldersSidebar.vue';
import ChatListSidebar from '@/components/chat/ChatListSidebar.vue';
import ChatMessagesArea from '@/components/chat/ChatMessagesArea.vue';
import ChatMessageInput from '@/components/chat/ChatMessageInput.vue';
import GalleryModal from '@/components/chat/GalleryModal.vue';
import AlbumSelectionModal from '@/components/chat/AlbumSelectionModal.vue';
import TagDialog from '@/components/chat/TagDialog.vue';
import SyncChoiceDialog from '@/components/chat/SyncChoiceDialog.vue';
import VideoLightbox from '@/components/chat/VideoLightbox.vue';
import NewChatSearchDialog from '@/components/chat/NewChatSearchDialog.vue';
import ProfileDialog from '@/components/chat/ProfileDialog.vue';
import GroupDialog from '@/components/chat/GroupDialog.vue';
import ChatDialogSettings from '@/components/chat/ChatDialogSettings.vue';
import AIChatDialog from '@/components/chat/AIChatDialog.vue';
import FolderSelectionDialog from '@/components/chat/FolderSelectionDialog.vue';
import type { GalleryPhoto, MessengerChatItem, MessengerMessage } from '@/lib/sdc-api-types';
import { startChat } from '@/lib/sdc-api';
import { chatStorage } from '@/lib/chat-storage';
import { syncProfilesForChats, hasFullProfileSyncDone } from '@/lib/profile-sync-service';

const props = withDefaults(
  defineProps<{
    /** Overlay (modal) vs full hub page under SiteHeader. */
    variant?: 'overlay' | 'page';
    /** When false, sync/WebSocket cleanup runs (e.g. modal closed). */
    active: boolean;
  }>(),
  { variant: 'overlay' }
);

const emit = defineEmits<{
  close: [];
}>();

const rootClass = computed(() =>
  props.variant === 'page'
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-background'
    : 'flex h-full min-h-0 flex-col overflow-hidden bg-background'
);

// Use composables
const {
  folders,
  selectedChat,
  selectedFolderId,
  showArchives,
  chatList,
} = useChatState();

const {
  getFolderName,
  getFolderUnreadCount,
  getInboxUnreadCount,
  getTotalUnreadCount,
  handleSelectFolder,
  handleSelectArchives,
  moveChatToFolder,
} = useChatFolders();

const {
  searchQuery,
  filterUnread,
  filterPinned,
  filterOnline,
  filterLastMessageByMe,
  filterLastMessageByOther,
  filterOnlyMyMessages,
  filterBlocked,
  filterCouples,
  filterFemales,
  isFilterDropdownOpen,
  sortByOnline,
  sortByDistance,
  disablePinnedSort,
  isSortDropdownOpen,
  hasActiveSort,
  selectedTagIds,
  filteredChats,
  hasActiveFilters,
  activeFilterCount,
  clearAllFilters,
  clearAllSorts,
  clearChatSearch,
  toggleSortByOnline,
  toggleSortByDistance,
  toggleDisablePinnedSort,
  toggleTagFilter,
} = useChatFilters();

const chatMessagesAreaRef = ref<InstanceType<typeof ChatMessagesArea> | null>(null);

const {
  messages,
  isLoadingMessages,
  isSyncing,
  messageError,
  messagesContainer,
  messageSearchQuery,
  messageSearchResults,
  currentSearchIndex,
  isSearchActive,
  filteredMessages,
  handleDeleteMessageWithError,
  handleCopyMessageWithClose,
  scrollToQuotedMessage,
  navigateToNextResult,
  navigateToPreviousResult,
  clearSearch,
  handleSearchKeydown,
} = useChatMessages();

// Sync the messagesContainer ref from the child component
watch(() => chatMessagesAreaRef.value?.messagesContainer, (newRef) => {
  if (newRef) {
    messagesContainer.value = newRef;
  }
}, { immediate: true });

const {
  messageInput,
  quotedMessage,
  isUploadDropdownOpen,
  uploadedMedia,
  albumModalVisible,
  openAlbumModal,
  closeAlbumModal,
  handleAlbumSelection,
  isUploading,
  typingManager,
  handleMessageInput: handleInputTyping,
  handleSendMessage,
  handleQuoteMessage,
  cancelQuote,
  triggerPhotoPicker,
  triggerVideoPicker,
  removeUploadedMedia,
  clearUploadedMedia,
} = useChatInput();

const {
  openDropdownMessageId,
  lightboxVisible,
  lightboxIndex,
  lightboxImages,
  openLightbox,
  galleryModalVisible,
  galleryName,
  galleryId,
  galleryDbId,
  openGalleryModal,
  closeGalleryModal,
  openLightboxFromGallery,
} = useChatUI();

// Video lightbox state
const videoLightboxVisible = ref(false);
const videoLightboxVideos = ref<GalleryPhoto[]>([]);
const videoLightboxIndex = ref(0);

const {
  isWebSocketConnected,
  typingStates,
} = useChatWebSocket();

const {
  isLoading,
  error,
  isSyncingMessages,
  isRefreshing,
  syncMessagesForCurrentFolder,
  syncUnsyncedChats,
  resyncAllChats,
  resyncNewestChats,
} = useChatSync();

const { handleChatClick } = useChatSelection();

// Initialize dialog lifecycle (handles mounting, URL watching, etc.)
useChatDialogLifecycle(toRef(props, 'active'));

function handleClose() {
  typingManager.stopTyping();
  emit('close');
}

// Handle message operations with error handling and dropdown closing
async function handleDeleteMessageWrapper(message: typeof messages.value[0]) {
  await handleDeleteMessageWithError(message, () => {
    openDropdownMessageId.value = null;
  }).catch(() => {
    error.value = 'Failed to delete message';
  });
}

function handleCopyMessageWrapper(message: typeof messages.value[0]) {
  handleCopyMessageWithClose(message, () => {
    openDropdownMessageId.value = null;
  });
}

function handleQuoteMessageWrapper(message: typeof messages.value[0]) {
  handleQuoteMessage(message);
  openDropdownMessageId.value = null;
}

async function handleSendMessageWrapper() {
  try {
    await handleSendMessage();
  } catch (err) {
    error.value = 'Failed to send message';
  }
}

function handleOpenGallery(message: typeof messages.value[0]) {
  openGalleryModal(message);
}

// Tag dialog state
const isTagDialogOpen = ref(false);
const tagDialogChat = ref<MessengerChatItem | null>(null);

function handleOpenTags(chat?: MessengerChatItem) {
  tagDialogChat.value = chat || selectedChat.value;
  isTagDialogOpen.value = true;
}

function handleTagSave() {
  // Tags are saved in TagDialog, just close the dialog
  // The chat list will automatically update via reactive queries
  isTagDialogOpen.value = false;
}

// Sync choice dialog state
const isSyncChoiceDialogOpen = ref(false);

function handleSyncAllChats() {
  isSyncChoiceDialogOpen.value = true;
}

// Settings dialog state
const isSettingsDialogOpen = ref(false);

function handleOpenSettings() {
  isSettingsDialogOpen.value = true;
}

// AI Chat dialog state
const isAIChatDialogOpen = ref(false);
const aiChatFocusedMessage = ref<MessengerMessage | null>(null);

function handleOpenAIChat() {
  aiChatFocusedMessage.value = null;
  isAIChatDialogOpen.value = true;
}

function handleRespondWithAI(message: MessengerMessage) {
  aiChatFocusedMessage.value = message;
  isAIChatDialogOpen.value = true;
}

// New chat search dialog state
const showNewChatDialog = ref(false);

// Folder selection dialog state
const isFolderDialogOpen = ref(false);
const folderDialogChat = ref<MessengerChatItem | null>(null);

function handleOpenFolderDialog(chat: MessengerChatItem) {
  folderDialogChat.value = chat;
  isFolderDialogOpen.value = true;
}

async function handleFolderSelected(folderId: number | null) {
  const toast = (window as any).__sdcBoostToast;
  if (!folderDialogChat.value) return;
  
  try {
    await moveChatToFolder(folderDialogChat.value.group_id, folderId);
    if (toast) {
      const folderName = folderId === null ? 'Inbox' : folders.value.find(f => f.id === folderId)?.name || 'folder';
      toast.success(`Moved chat to ${folderName}`);
    }
  } catch (err) {
    console.error('[ChatDialog] Failed to move chat to folder:', err);
    if (toast) {
      toast.error('Failed to move chat to folder');
    }
  }
  
  isFolderDialogOpen.value = false;
  folderDialogChat.value = null;
}

// Profile dialogs management
const { profileDialogs, openProfileDialog, closeProfileDialog } = useProfileDialogs();
const { groupDialogs, openGroupDialog, closeGroupDialog } = useGroupDialogs();

// Track full profile sync status
const fullProfileSyncDone = ref(false);

// Load full sync status on mount
watch(
  () => props.active,
  async (isOpen) => {
    if (isOpen) {
      fullProfileSyncDone.value = await hasFullProfileSyncDone();
    }
  },
  { immediate: true }
);

function handleNewChat() {
  console.log('[ChatDialog] handleNewChat called, setting showNewChatDialog to true');
  console.log('[ChatDialog] showNewChatDialog before:', showNewChatDialog.value);
  showNewChatDialog.value = true;
  console.log('[ChatDialog] showNewChatDialog after:', showNewChatDialog.value);
  // Force a re-render check
  nextTick(() => {
    console.log('[ChatDialog] showNewChatDialog in nextTick:', showNewChatDialog.value);
  });
}

async function handleStartChat(dbId: number) {
  const toast = (window as any).__sdcBoostToast;
  
  try {
    // Check if chat already exists with this user
    const existingChat = chatList.value.find(chat => chat.db_id === dbId && !chat.broadcast && chat.type !== 100);
    
    if (existingChat) {
      // Chat already exists, just open it
      await handleChatClick(existingChat);
      showNewChatDialog.value = false;
      if (toast) {
        toast.success('Opened existing chat');
      }
      return;
    }
    
    // Call start chat API
    const response = await startChat(dbId);
    
    if (!response.info.group_id) {
      throw new Error('Failed to create chat: no group_id returned');
    }
    
    // Convert response to MessengerChatItem format
    const chatItem: MessengerChatItem = {
      db_id: response.info.target_db_id || dbId,
      account_id: response.info.account_id || '',
      gender1: response.info.gender1 || 0,
      gender2: response.info.gender2 || 0,
      profile_type: response.info.profile_type || 0,
      unread_counter: 0,
      last_message: '',
      message_status: 0,
      date: new Date().toISOString(),
      date_time: new Date().toISOString(),
      start_chat: 1,
      primary_photo: response.info.primary_photo || '',
      muted: response.info.muted || 0,
      pin_chat: response.info.pin_chat || 0,
      time_elapsed: '',
      isFriend: false,
      online: response.info.online || 0,
      group_type: 0,
      group_id: response.info.group_id,
      blocked_profile: 0,
      extra1: '',
    };
    
    // Store the chat
    await chatStorage.upsertChats([chatItem]);
    
    // Auto-open the chat
    await handleChatClick(chatItem);
    
    // Close the dialog
    showNewChatDialog.value = false;
    
    if (toast) {
      toast.success('Chat started');
    }
  } catch (err: any) {
    console.error('[ChatDialog] Failed to start chat:', err);
    
    if (err.isBlockedChat) {
      if (toast) {
        toast.error('Cannot start chat: ' + (err.message || 'Chat is blocked'));
      }
    } else {
      if (toast) {
        toast.error('Failed to start chat: ' + (err.message || 'Unknown error'));
      }
    }
  }
}

async function handleSyncChoice(choice: 'sync-unsynced' | 'resync-all' | 'resync-newest' | 'sync-profiles' | 'sync-profiles-reset') {
  // Close dialog immediately
  isSyncChoiceDialogOpen.value = false;
  
  try {
    switch (choice) {
      case 'sync-unsynced':
        await syncUnsyncedChats();
        break;
      case 'resync-all':
        await resyncAllChats();
        break;
      case 'resync-newest':
        await resyncNewestChats();
        break;
      case 'sync-profiles':
      case 'sync-profiles-reset': {
        // Get chats based on current folder selection (same logic as message sync)
        let chatsToSync: MessengerChatItem[] = [];
        
        if (showArchives.value) {
          // Archives - get archived chats
          chatsToSync = await chatStorage.searchChats({ showArchives: true });
        } else if (selectedFolderId.value === null) {
          // All chats - get all chats from all folders and inbox (excluding archives)
          chatsToSync = await chatStorage.searchChats({ showArchives: false });
        } else if (selectedFolderId.value === 0) {
          // Inbox - get chats with folder_id === 0 or null (excluding archives)
          chatsToSync = await chatStorage.searchChats({ folderId: 0, showArchives: false });
        } else {
          // Specific folder - get chats for that folder (excluding archives)
          chatsToSync = await chatStorage.searchChats({ folderId: selectedFolderId.value, showArchives: false });
        }
        
        const reset = choice === 'sync-profiles-reset';
        await syncProfilesForChats(chatsToSync, reset);
        // Update full sync status after sync completes
        fullProfileSyncDone.value = await hasFullProfileSyncDone();
        break;
      }
    }
  } catch (err) {
    console.error('[ChatDialog] Failed to sync:', err);
    // Error toasts are handled in the sync functions
  }
}

function handleOpenProfileDialog(userId: number) {
  openProfileDialog(userId);
}

function handleCloseProfileDialog(dialogId: string) {
  closeProfileDialog(dialogId);
}

function handleOpenProfileFromDialog(userId: number) {
  openProfileDialog(userId);
}

function handleOpenGroupDialog(groupId: string) {
  openGroupDialog(groupId);
}

function handleCloseGroupDialog(dialogId: string) {
  closeGroupDialog(dialogId);
}
</script>

<template>
  <div :class="rootClass">
    <!-- Header (overlay / modal only — Hub uses folders sidebar footer) -->
    <ChatDialogHeader
      v-if="variant === 'overlay'"
      :is-web-socket-connected="isWebSocketConnected"
      :is-syncing-messages="isSyncingMessages || isRefreshing"
      :selected-chat="selectedChat"
      :full-profile-sync-done="fullProfileSyncDone"
      :show-close="true"
      @close="handleClose"
      @sync-all-chats="handleSyncAllChats"
      @open-settings="handleOpenSettings"
    />

    <!-- Main Content -->
    <div class="flex min-h-0 flex-1 overflow-hidden">
        <!-- Left Sidebar - Folders -->
        <ChatFoldersSidebar
          :folders="folders"
          :selected-folder-id="selectedFolderId"
          :show-archives="showArchives"
          :get-total-unread-count="getTotalUnreadCount"
          :get-inbox-unread-count="getInboxUnreadCount"
          :get-folder-unread-count="getFolderUnreadCount"
          :show-hub-toolbar="variant === 'page'"
          :is-web-socket-connected="isWebSocketConnected"
          :is-syncing-messages="isSyncingMessages || isRefreshing"
          @select-folder="handleSelectFolder"
          @select-archives="handleSelectArchives"
          @sync-all-chats="handleSyncAllChats"
          @open-settings="handleOpenSettings"
        />

        <!-- Middle Sidebar - Chat List -->
        <ChatListSidebar
          :search-query="searchQuery"
          :is-loading="isLoading"
          :error="error"
          :filtered-chats="filteredChats"
          :selected-chat="selectedChat"
          :typing-states="typingStates"
          :filter-unread="filterUnread"
          :filter-pinned="filterPinned"
          :filter-online="filterOnline"
          :filter-last-message-by-me="filterLastMessageByMe"
          :filter-last-message-by-other="filterLastMessageByOther"
          :filter-only-my-messages="filterOnlyMyMessages"
          :filter-blocked="filterBlocked"
          :filter-couples="filterCouples"
          :filter-females="filterFemales"
          :is-filter-dropdown-open="isFilterDropdownOpen"
          :has-active-filters="hasActiveFilters"
          :active-filter-count="activeFilterCount"
          :sort-by-online="sortByOnline"
          :sort-by-distance="sortByDistance"
          :disable-pinned-sort="disablePinnedSort"
          :is-sort-dropdown-open="isSortDropdownOpen"
          :has-active-sort="hasActiveSort"
          :selected-tag-ids="selectedTagIds"
          :get-folder-name="getFolderName"
          @update:search-query="searchQuery = $event"
          @update:filter-unread="filterUnread = $event"
          @update:filter-pinned="filterPinned = $event"
          @update:filter-online="filterOnline = $event"
          @update:filter-last-message-by-me="filterLastMessageByMe = $event"
          @update:filter-last-message-by-other="filterLastMessageByOther = $event"
          @update:filter-only-my-messages="filterOnlyMyMessages = $event"
          @update:filter-blocked="filterBlocked = $event"
          @update:filter-couples="filterCouples = $event"
          @update:filter-females="filterFemales = $event"
          @update:is-filter-dropdown-open="isFilterDropdownOpen = $event"
          @update:is-sort-dropdown-open="isSortDropdownOpen = $event"
          @toggle-sort-online="toggleSortByOnline"
          @toggle-sort-distance="toggleSortByDistance"
          @toggle-disable-pinned-sort="toggleDisablePinnedSort"
          @toggle-tag-filter="toggleTagFilter"
          @chat-click="handleChatClick"
          @chat-open-tags="handleOpenTags"
          @chat-open-folder-dialog="handleOpenFolderDialog"
          @clear-filters="clearAllFilters"
          @clear-sort="clearAllSorts"
          @clear-search="clearChatSearch"
          @new-chat="handleNewChat"
        />

        <!-- Right Side - Chat Messages Area -->
        <div class="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
          <ChatMessagesArea
            ref="chatMessagesAreaRef"
            :selected-chat="selectedChat"
            :messages="messages"
            :filtered-messages="filteredMessages"
            :is-loading-messages="isLoadingMessages"
            :is-syncing="isSyncing"
            :message-error="messageError"
            :is-search-active="isSearchActive"
            :message-search-results="messageSearchResults"
            :current-search-index="currentSearchIndex"
            :typing-states="typingStates"
            :open-dropdown-message-id="openDropdownMessageId"
            :message-search-query="messageSearchQuery"
            @update:open-dropdown-message-id="openDropdownMessageId = $event"
            @open-profile-dialog="handleOpenProfileDialog"
            @open-group-dialog="handleOpenGroupDialog"
            @quote-message="handleQuoteMessageWrapper"
            @copy-message="handleCopyMessageWrapper"
            @delete-message="handleDeleteMessageWrapper"
            @scroll-to-quoted="scrollToQuotedMessage"
            @open-lightbox="openLightbox"
            @open-gallery="handleOpenGallery"
            @open-tags="handleOpenTags()"
            @open-ai-chat="handleOpenAIChat"
            @respond-with-ai="handleRespondWithAI"
            @open-folder-dialog="handleOpenFolderDialog"
          >
            <template #message-search>
              <div class="flex items-center gap-1.5 shrink-0">
                <div class="relative flex items-center gap-1 bg-sidebar border border-white/[0.06] rounded-md px-2 py-1 min-w-[100px] max-w-[160px]">
                  <Icon icon="mdi:magnify" width="12" height="12" class="text-white/40 shrink-0" />
                  <input
                    v-model="messageSearchQuery"
                    @keydown="handleSearchKeydown"
                    @input="currentSearchIndex = -1"
                    type="text"
                    placeholder="Search..."
                    class="flex-1 bg-transparent text-white text-xs placeholder-white/40 focus:outline-none min-w-0 w-full"
                  />
                  <button
                    v-if="isSearchActive"
                    @click="clearSearch"
                    class="p-0.5 hover:bg-secondary rounded transition-colors shrink-0"
                    title="Clear search"
                  >
                    <Icon icon="mdi:close" width="10" height="10" class="text-muted-foreground hover:text-white" />
                  </button>
                </div>
                
                <!-- Search Navigation -->
                <div v-if="isSearchActive && messageSearchResults.length > 0" class="flex items-center gap-0.5 bg-sidebar border border-white/[0.06] rounded-md px-1.5 py-0.5 shrink-0">
                  <button
                    @click="navigateToPreviousResult"
                    class="p-0.5 hover:bg-secondary rounded transition-colors"
                    title="Previous result (↑)"
                  >
                    <Icon icon="mdi:chevron-up" width="12" height="12" class="text-muted-foreground hover:text-white" />
                  </button>
                  <span class="text-[10px] text-white/40 px-0.5 min-w-[36px] text-center">
                    {{ currentSearchIndex + 1 }}/{{ messageSearchResults.length }}
                  </span>
                  <button
                    @click="navigateToNextResult"
                    class="p-0.5 hover:bg-secondary rounded transition-colors"
                    title="Next result (↓ or Enter)"
                  >
                    <Icon icon="mdi:chevron-down" width="12" height="12" class="text-muted-foreground hover:text-white" />
                  </button>
                </div>
              </div>
            </template>
            
            <template #message-input>
              <ChatMessageInput
                v-model:message-input="messageInput"
                v-model:is-upload-dropdown-open="isUploadDropdownOpen"
                :quoted-message="quotedMessage"
                :uploaded-media="uploadedMedia"
                :is-uploading="isUploading"
                :is-web-socket-connected="isWebSocketConnected"
                :selected-chat="selectedChat"
                @send-message="handleSendMessageWrapper"
                @cancel-quote="cancelQuote"
                @clear-uploaded-media="clearUploadedMedia"
                @remove-uploaded-media="removeUploadedMedia"
                @trigger-photo-picker="triggerPhotoPicker"
                @trigger-video-picker="triggerVideoPicker"
                @open-album-modal="openAlbumModal"
                @handle-message-input="selectedChat && handleInputTyping(selectedChat)"
              />
            </template>
          </ChatMessagesArea>
        </div>
    </div>
  </div>

  <!-- Lightbox Component -->
  <VueEasyLightbox
    v-if="lightboxImages.length > 0"
    :visible="lightboxVisible"
    :imgs="lightboxImages"
    :index="lightboxIndex"
    teleport="body"
    :mask-closable="true"
    :scroll-disabled="true"
    @hide="lightboxVisible = false"
  />
  
  <!-- Gallery Modal -->
  <GalleryModal
    :visible="galleryModalVisible"
    :gallery-name="galleryName"
    :gallery-id="galleryId"
    :db-id="galleryDbId"
    @close="closeGalleryModal"
    @open-lightbox="openLightboxFromGallery"
    @open-video-lightbox="(videos, index) => { videoLightboxVideos = videos; videoLightboxIndex = index; videoLightboxVisible = true; }"
  />
  
  <!-- Video Lightbox -->
  <VideoLightbox
    :visible="videoLightboxVisible"
    :videos="videoLightboxVideos"
    :initial-index="videoLightboxIndex"
    @close="videoLightboxVisible = false"
  />
  
  <!-- New Chat Search Dialog -->
  <NewChatSearchDialog
    :visible="showNewChatDialog"
    @close="showNewChatDialog = false"
    @start-chat="handleStartChat"
  />
  
  <!-- Album Selection Modal -->
  <AlbumSelectionModal
    :visible="albumModalVisible"
    @close="closeAlbumModal"
    @select="handleAlbumSelection"
  />
  
  <!-- Tag Dialog -->
  <TagDialog
    :model-value="isTagDialogOpen"
    :chat="tagDialogChat"
    @update:model-value="isTagDialogOpen = $event"
    @save="handleTagSave"
  />
  
  <!-- Sync Choice Dialog -->
  <SyncChoiceDialog
    :model-value="isSyncChoiceDialogOpen"
    @update:model-value="isSyncChoiceDialogOpen = $event"
    @select="handleSyncChoice"
  />
  
  <!-- Settings Dialog -->
  <ChatDialogSettings
    :model-value="isSettingsDialogOpen"
    @update:model-value="isSettingsDialogOpen = $event"
  />
  
  <!-- Profile Dialogs (stacked) -->
  <ProfileDialog
    v-for="dialog in profileDialogs"
    :key="dialog.id"
    :visible="true"
    :user-id="dialog.userId"
    :stack-level="dialog.stackLevel"
    :dialog-id="dialog.id"
    @close="handleCloseProfileDialog(dialog.id)"
    @open-profile="handleOpenProfileFromDialog"
  />
  
  <!-- Group Dialogs (stacked) -->
  <GroupDialog
    v-for="dialog in groupDialogs"
    :key="dialog.id"
    :visible="true"
    :group-id="dialog.groupId"
    :stack-level="dialog.stackLevel"
    :dialog-id="dialog.id"
    @close="handleCloseGroupDialog(dialog.id)"
    @open-profile="handleOpenProfileFromDialog"
  />
  
  <!-- AI Chat Dialog -->
  <AIChatDialog
    :visible="isAIChatDialogOpen"
    :selected-chat="selectedChat"
    :focused-message="aiChatFocusedMessage"
    @close="isAIChatDialogOpen = false; aiChatFocusedMessage = null"
  />
  
  <!-- Folder Selection Dialog -->
  <FolderSelectionDialog
    v-model="isFolderDialogOpen"
    :current-folder-id="folderDialogChat?.folder_id"
    @select="handleFolderSelected"
  />
</template>
