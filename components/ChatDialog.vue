<script lang="ts" setup>
import { ref, watch, toRef } from 'vue';
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
import { openProfileInNewTab } from '@/lib/composables/chat/utils';
import ChatDialogHeader from '@/components/chat/ChatDialogHeader.vue';
import ChatFoldersSidebar from '@/components/chat/ChatFoldersSidebar.vue';
import ChatListSidebar from '@/components/chat/ChatListSidebar.vue';
import ChatMessagesArea from '@/components/chat/ChatMessagesArea.vue';
import ChatMessageInput from '@/components/chat/ChatMessageInput.vue';
import GalleryModal from '@/components/chat/GalleryModal.vue';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'close': [];
}>();

// Use composables
const {
  folders,
  selectedChat,
  selectedFolderId,
  showArchives,
} = useChatState();

const {
  getFolderName,
  getFolderUnreadCount,
  getInboxUnreadCount,
  getTotalUnreadCount,
  handleSelectFolder,
  handleSelectArchives,
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
  isFilterDropdownOpen,
  filteredChats,
  hasActiveFilters,
  activeFilterCount,
  clearAllFilters,
  clearChatSearch,
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

const {
  isWebSocketConnected,
  typingStates,
} = useChatWebSocket();

const {
  isLoading,
  error,
  isSyncingMessages,
  syncMessagesForCurrentFolder,
} = useChatSync();

const { handleChatClick } = useChatSelection();

// Initialize dialog lifecycle (handles mounting, URL watching, etc.)
useChatDialogLifecycle(
  toRef(props, 'modelValue'),
  () => {
    typingManager.stopTyping();
    emit('update:modelValue', false);
    emit('close');
  }
);

function handleClose() {
  typingManager.stopTyping();
  emit('update:modelValue', false);
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
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    style="pointer-events: auto; z-index: 999999; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
    @click.self="handleClose"
  >
    <div
      class="w-[95vw] h-[95vh] md:w-[90vw] md:h-[90vh] bg-[#1a1a1a] rounded-lg shadow-2xl flex flex-col overflow-hidden"
      @click.stop
    >
      <!-- Header -->
      <ChatDialogHeader
        :is-web-socket-connected="isWebSocketConnected"
        :is-syncing-messages="isSyncingMessages"
        @close="handleClose"
        @sync-messages="syncMessagesForCurrentFolder"
      />

      <!-- Main Content -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Left Sidebar - Folders -->
        <ChatFoldersSidebar
          :folders="folders"
          :selected-folder-id="selectedFolderId"
          :show-archives="showArchives"
          :get-total-unread-count="getTotalUnreadCount"
          :get-inbox-unread-count="getInboxUnreadCount"
          :get-folder-unread-count="getFolderUnreadCount"
          @select-folder="handleSelectFolder"
          @select-archives="handleSelectArchives"
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
          :is-filter-dropdown-open="isFilterDropdownOpen"
          :has-active-filters="hasActiveFilters"
          :active-filter-count="activeFilterCount"
          :get-folder-name="getFolderName"
          @update:search-query="searchQuery = $event"
          @update:filter-unread="filterUnread = $event"
          @update:filter-pinned="filterPinned = $event"
          @update:filter-online="filterOnline = $event"
          @update:filter-last-message-by-me="filterLastMessageByMe = $event"
          @update:filter-last-message-by-other="filterLastMessageByOther = $event"
          @update:filter-only-my-messages="filterOnlyMyMessages = $event"
          @update:filter-blocked="filterBlocked = $event"
          @update:is-filter-dropdown-open="isFilterDropdownOpen = $event"
          @chat-click="handleChatClick"
          @clear-filters="clearAllFilters"
          @clear-search="clearChatSearch"
        />

        <!-- Right Side - Chat Messages Area -->
        <div class="flex-1 flex flex-col bg-[#1a1a1a] min-w-0 overflow-hidden">
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
            @open-profile="openProfileInNewTab"
            @quote-message="handleQuoteMessageWrapper"
            @copy-message="handleCopyMessageWrapper"
            @delete-message="handleDeleteMessageWrapper"
            @scroll-to-quoted="scrollToQuotedMessage"
            @open-lightbox="openLightbox"
            @open-gallery="handleOpenGallery"
          >
            <template #message-search>
              <div class="flex items-center gap-2 shrink-0">
                <div class="relative flex items-center gap-1 bg-[#0f0f0f] border border-[#333] rounded-lg px-2 py-1.5 min-w-[200px]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#666] shrink-0">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                  <input
                    v-model="messageSearchQuery"
                    @keydown="handleSearchKeydown"
                    @input="currentSearchIndex = -1"
                    type="text"
                    placeholder="Search messages..."
                    class="flex-1 bg-transparent text-white text-sm placeholder-[#666] focus:outline-none min-w-0"
                  />
                  <button
                    v-if="isSearchActive"
                    @click="clearSearch"
                    class="p-0.5 hover:bg-[#2a2a2a] rounded transition-colors shrink-0"
                    title="Clear search"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] hover:text-white">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                
                <!-- Search Navigation -->
                <div v-if="isSearchActive && messageSearchResults.length > 0" class="flex items-center gap-1 bg-[#0f0f0f] border border-[#333] rounded-lg px-2 py-1 shrink-0">
                  <button
                    @click="navigateToPreviousResult"
                    class="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
                    title="Previous result (↑)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] hover:text-white">
                      <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                  </button>
                  <span class="text-xs text-[#666] px-1 min-w-[50px] text-center">
                    {{ currentSearchIndex + 1 }} / {{ messageSearchResults.length }}
                  </span>
                  <button
                    @click="navigateToNextResult"
                    class="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
                    title="Next result (↓ or Enter)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] hover:text-white">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
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
                @handle-message-input="selectedChat && handleInputTyping(selectedChat)"
              />
            </template>
          </ChatMessagesArea>
        </div>
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
  />
</template>
