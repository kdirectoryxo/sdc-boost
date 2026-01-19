<script lang="ts" setup>
import { ref, computed } from 'vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import TagBadge from '@/components/ui/TagBadge.vue';
import type { MessengerChatItem, MessengerMessage } from '@/lib/sdc-api-types';
import ChatMessageItem from '@/components/chat/ChatMessageItem.vue';
import { useChatPin } from '@/lib/composables/chat/useChatPin';
import { useChatProfile, getAgeColorClass, isGender2Real } from '@/lib/composables/chat/useChatProfile';
import { useChatFolders } from '@/lib/composables/chat/useChatFolders';
import { confirm } from '@/lib/confirm';
import { toast } from '@/lib/toast';

interface Props {
  selectedChat: MessengerChatItem | null;
  messages: MessengerMessage[];
  filteredMessages: MessengerMessage[];
  isLoadingMessages: boolean;
  isSyncing: boolean;
  messageError: string | null;
  isSearchActive: boolean;
  messageSearchResults: number[];
  currentSearchIndex: number;
  typingStates: Map<string, boolean>;
  openDropdownMessageId: number | null;
  messageSearchQuery?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:openDropdownMessageId': [value: number | null];
  'open-profile': [userId: number];
  'open-profile-dialog': [userId: number];
  'open-group-dialog': [groupId: string];
  'quote-message': [message: MessengerMessage];
  'copy-message': [message: MessengerMessage];
  'delete-message': [message: MessengerMessage];
  'scroll-to-quoted': [message: MessengerMessage];
  'open-lightbox': [message: MessengerMessage, imageIndex: number, event?: Event];
  'open-gallery': [message: MessengerMessage];
  'open-tags': [];
  'open-ai-chat': [];
  'respond-with-ai': [message: MessengerMessage];
  'open-folder-dialog': [chat: MessengerChatItem];
}>();

const messagesContainer = ref<HTMLElement | null>(null);
const { togglePinChat, toggleMarkUnread, deleteChat } = useChatPin();
const { removeChatFromFolder } = useChatFolders();
const openHeaderDropdown = ref<boolean>(false);

defineExpose({
  messagesContainer
});

const isBroadcast = computed(() => {
  return props.selectedChat?.broadcast || props.selectedChat?.type === 100;
});

// Check if this is a group
const isGroup = computed(() => {
  if (!props.selectedChat) return false;
  return props.selectedChat.group_type === 1 || typeof props.selectedChat.group_id === 'string';
});

// Name color based on gender (same logic as ChatListItem)
const nameColor = computed(() => {
  if (!props.selectedChat) return 'text-white';
  if (props.selectedChat.broadcast || props.selectedChat.type === 100) {
    return 'text-yellow-400'; // Yellow for broadcasts
  } else if (props.selectedChat.gender1 === 1 && props.selectedChat.gender2 === 2) {
    return 'text-pink-400'; // Pink for couples with female
  }
  return 'text-purple-400'; // Purple default
});

function handleContainerClick() {
  emit('update:openDropdownMessageId', null);
}

function handleTogglePin() {
  if (props.selectedChat) {
    togglePinChat(props.selectedChat);
    openHeaderDropdown.value = false;
  }
}

function handleToggleMarkUnread() {
  if (props.selectedChat) {
    const isUnread = props.selectedChat.unread_counter > 0;
    toggleMarkUnread(props.selectedChat, !isUnread);
    openHeaderDropdown.value = false;
  }
}

function handleHeaderDropdownToggle(open: boolean) {
  openHeaderDropdown.value = open;
}

async function handleDeleteChat() {
  if (props.selectedChat) {
    await deleteChat(props.selectedChat);
    openHeaderDropdown.value = false;
  }
}

function handleMoveToFolder(close: () => void) {
  if (!props.selectedChat) {
    close();
    return;
  }
  emit('open-folder-dialog', props.selectedChat);
  close();
}

async function handleRemoveFromFolder(close: () => void) {
  if (!props.selectedChat || !props.selectedChat.folder_id) {
    close();
    return;
  }

  const confirmed = await confirm.confirm(
    'Are you sure you want to remove this chat from its folder?',
    {
      confirmText: 'Remove',
      cancelText: 'Cancel',
    }
  );

  if (confirmed) {
    try {
      await removeChatFromFolder(props.selectedChat.group_id, props.selectedChat.folder_id);
      toast.success('Chat removed from folder');
    } catch (error) {
      console.error('Failed to remove chat from folder:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove chat from folder');
    }
  }
  close();
}

function handleOpenAIChat() {
  emit('open-ai-chat');
}

// Get tags from selected chat (tags are merged from metadata)
const chatTags = computed(() => {
  if (!props.selectedChat) return [];
  return (props.selectedChat as any).tags || [];
});

// Fetch profile data for selected chat (skip for broadcasts)
const profileDbId = computed(() => {
  if (!props.selectedChat || isBroadcast.value || props.selectedChat.db_id <= 0) {
    return null;
  }
  return props.selectedChat.db_id;
});

const { profileData } = useChatProfile(profileDbId);

// Computed values for ages and distances
const displayAges = computed(() => {
  if (!profileData.value) return null;
  const ages: Array<{ age: number; colorClass: string }> = [];
  
  if (profileData.value.g1_age) {
    ages.push({
      age: profileData.value.g1_age,
      colorClass: getAgeColorClass(profileData.value.gender1),
    });
  }
  
  if (profileData.value.g2_age && isGender2Real(profileData.value.g2_age, profileData.value.g2_nick)) {
    ages.push({
      age: profileData.value.g2_age,
      colorClass: getAgeColorClass(profileData.value.gender2),
    });
  }
  
  return ages.length > 0 ? ages : null;
});

const displayDistance = computed(() => {
  if (!profileData.value) return null;
  
  // Prefer location_how_far, fallback to location_how_far2
  const distance = profileData.value.location_how_far 
    ?? (profileData.value.location_how_far2 ? Number(profileData.value.location_how_far2) : undefined);
  
  if (distance !== undefined && distance !== null) {
    return `${distance} km`;
  }
  
  return null;
});
</script>

<template>
  <div v-if="!selectedChat" class="flex-1 flex items-center justify-center">
    <div class="text-center text-[#999]">
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="mx-auto mb-4 opacity-50"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <p>Select a chat to view messages</p>
    </div>
  </div>
  <div v-else class="flex-1 flex flex-col min-w-0 overflow-hidden">
    <!-- Chat Header -->
    <div class="px-4 py-3 border-b border-[#333] shrink-0 min-w-0 relative z-50">
      <div class="flex items-center gap-3 flex-wrap">
        <!-- Profile Info -->
        <div class="flex items-center gap-3 min-w-0 flex-1 basis-[200px]">
          <img
            v-if="!isGroup || (selectedChat.primary_photo && selectedChat.primary_photo !== '/thumbnail/' && selectedChat.primary_photo.trim() !== '')"
            :src="`https://pictures.sdc.com/photos/${selectedChat.primary_photo}`"
            :alt="isGroup ? selectedChat.group_name : selectedChat.account_id"
            @click="isGroup ? emit('open-group-dialog', String(selectedChat.group_id)) : emit('open-profile-dialog', selectedChat.db_id)"
            class="w-9 h-9 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            :title="isGroup ? 'Click to view group' : 'Click to view profile'"
          />
          <img
            v-else-if="isGroup"
            src="https://www.sdc.com/react/assets/group.8481d87a.svg"
            :alt="selectedChat.group_name"
            @click="emit('open-group-dialog', String(selectedChat.group_id))"
            class="w-9 h-9 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity bg-[#333] p-1.5"
            title="Click to view group"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h3
                @click="isGroup ? emit('open-group-dialog', String(selectedChat.group_id)) : emit('open-profile-dialog', selectedChat.db_id)"
                :class="['font-semibold truncate cursor-pointer hover:text-blue-400 transition-colors text-sm', nameColor]"
                :title="isGroup ? 'Click to view group' : 'Click to view profile'"
              >
                {{ isGroup ? selectedChat.group_name : selectedChat.account_id }}
              </h3>
              <!-- Ages -->
              <div v-if="displayAges" class="flex items-center gap-1 shrink-0">
                <span
                  v-for="(ageInfo, index) in displayAges"
                  :key="index"
                  :class="['text-xs font-medium', ageInfo.colorClass]"
                >
                  {{ ageInfo.age }}
                </span>
              </div>
              <!-- Distance -->
              <span v-if="displayDistance" class="text-xs text-[#999] shrink-0">
                {{ displayDistance }}
              </span>
              <!-- Tags -->
              <div v-if="chatTags.length > 0" class="flex items-center gap-1 shrink-0">
                <TagBadge
                  v-for="(tag, index) in chatTags"
                  :key="index"
                  :text="tag.text"
                  :color="tag.color"
                />
              </div>
            </div>
            <p v-if="selectedChat.online === 1 && !isBroadcast && !isGroup" class="text-[11px] text-green-500">Online</p>
            <p v-else-if="!isBroadcast && !isGroup" class="text-[11px] text-[#999]">Offline</p>
            <p v-else-if="isGroup" class="text-[11px] text-blue-400">👥 Group</p>
            <p v-else class="text-[11px] text-yellow-400">📢 Broadcast</p>
          </div>
        </div>
        
        <!-- Actions -->
        <div v-if="!isBroadcast" class="flex items-center gap-1.5 flex-wrap justify-end">
          <slot name="message-search" />
          
          <!-- AI & Menu buttons grouped -->
          <div class="flex items-center gap-1 shrink-0">
            <!-- AI Chat Button -->
            <button
              @click="handleOpenAIChat"
              class="p-1.5 rounded hover:bg-[#2a2a2a] transition-colors"
              title="AI Chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] hover:text-white">
                <path d="M12 3v3m0 12v3m9-9h-3m-12 0H3m15.364 6.364l-2.121-2.121M6.757 6.757L4.636 4.636m14.728 0l-2.121 2.121M6.757 17.243l-2.121 2.121"></path>
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="5" r="1"></circle>
                <circle cx="5" cy="19" r="1"></circle>
                <circle cx="19" cy="19" r="1"></circle>
                <circle cx="5" cy="5" r="1"></circle>
              </svg>
            </button>
            
            <!-- Dropdown Menu -->
            <div @click.stop class="relative z-50">
          <Dropdown
            :model-value="openHeaderDropdown"
            @update:model-value="handleHeaderDropdownToggle"
            placement="bottom"
            alignment="end"
            width="w-48"
            offset="mt-1"
            :z-index="50"
          >
            <template #trigger="{ isOpen, toggle }">
              <button
                @click.stop="toggle"
                class="p-1.5 rounded hover:bg-[#2a2a2a] transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] hover:text-white">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
            </template>
            <template #content="{ close }">
              <div
                class="w-48 rounded-md shadow-lg bg-[#1a1a1a] border border-[#333] py-1"
                @click.stop
              >
                <button
                  @click.stop="handleTogglePin(); close()"
                  class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="17" x2="12" y2="22"></line>
                    <path d="M5 17h14l-1-7H6l-1 7z"></path>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  {{ selectedChat?.pin_chat === 1 ? 'Unpin chat' : 'Pin chat' }}
                </button>
                <button
                  @click.stop="handleToggleMarkUnread(); close()"
                  class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {{ selectedChat?.unread_counter > 0 ? 'Mark as read' : 'Mark as unread' }}
                </button>
                <button
                  @click.stop="$emit('open-tags'); close()"
                  class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                  </svg>
                  Tags
                </button>
                <div class="border-t border-[#333] my-1"></div>
                <button
                  v-if="!selectedChat?.folder_id"
                  @click.stop="handleMoveToFolder(close)"
                  class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    <path d="M12 11v6"></path>
                    <path d="M9 14l3-3 3 3"></path>
                  </svg>
                  Move to folder
                </button>
                <button
                  v-if="selectedChat?.folder_id"
                  @click.stop="handleRemoveFromFolder(close)"
                  class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    <path d="M12 11v6"></path>
                    <path d="M9 14l3 3 3-3"></path>
                  </svg>
                  Remove from folder
                </button>
                <div class="border-t border-[#333] my-1"></div>
                <button
                  @click.stop="handleDeleteChat(); close()"
                  class="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  Delete
                </button>
              </div>
            </template>
            </Dropdown>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Broadcast Content -->
    <div 
      v-if="isBroadcast"
      ref="messagesContainer"
      class="flex-1 overflow-y-auto overflow-x-hidden p-6 min-w-0 relative bg-white"
    >
      <div v-if="selectedChat?.body" class="max-w-4xl mx-auto">
        <!-- Broadcast Subject -->
        <h2 v-if="selectedChat.subject" class="text-2xl font-bold text-gray-900 mb-4">
          {{ selectedChat.subject }}
        </h2>
        
        <!-- Broadcast Body HTML -->
        <div 
          class="broadcast-content prose max-w-none"
          v-html="selectedChat.body"
        ></div>
      </div>
      <div v-else class="flex items-center justify-center h-full">
        <div class="text-center text-gray-500">
          <p>No broadcast content available</p>
        </div>
      </div>
    </div>

    <!-- Messages Area (for regular chats) -->
    <div 
      v-else
      ref="messagesContainer"
      @click="handleContainerClick"
      class="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4 min-w-0 relative z-0"
    >
      <!-- Syncing Notice (sticky centered overlay) -->
      <div 
        v-if="isSyncing" 
        class="sticky top-6 z-10 flex justify-center mb-4"
      >
        <div class="px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg flex items-center gap-2">
          <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-white text-sm font-medium">Syncing..</span>
        </div>
      </div>

      <!-- Loading Indicator -->
      <div v-if="isLoadingMessages && messages.length === 0 && !messageError" class="flex justify-center py-8">
        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <!-- Error Message (e.g., blocked chat) -->
      <div v-else-if="messageError" class="flex flex-col items-center justify-center py-12 px-6">
        <div class="text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="mx-auto mb-4 text-red-500"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p class="text-red-500 text-lg font-semibold mb-2">{{ messageError }}</p>
          <p class="text-[#999] text-sm">This chat cannot be accessed</p>
        </div>
      </div>

      <!-- Messages List -->
      <div v-else-if="messages.length > 0" class="space-y-4 min-w-0">
        <ChatMessageItem
          v-for="(message, index) in filteredMessages"
          :key="message.message_id > 0 ? `msg_${message.message_id}` : `opt_${message.extra1 || index}_${message.date2}`"
          :message="message"
          :index="index"
          :selected-chat="selectedChat"
          :is-search-active="isSearchActive"
          :is-highlighted="isSearchActive && messageSearchResults[currentSearchIndex] === message.message_id"
          :open-dropdown-message-id="openDropdownMessageId"
          :message-search-query="messageSearchQuery"
          @update:open-dropdown-message-id="(value: number | null) => emit('update:openDropdownMessageId', value)"
          @quote-message="(message: MessengerMessage) => emit('quote-message', message)"
          @copy-message="(message: MessengerMessage) => emit('copy-message', message)"
          @delete-message="(message: MessengerMessage) => emit('delete-message', message)"
          @scroll-to-quoted="(message: MessengerMessage) => emit('scroll-to-quoted', message)"
          @open-lightbox="(message: MessengerMessage, imageIndex: number, event?: Event) => emit('open-lightbox', message, imageIndex, event)"
          @open-gallery="(message: MessengerMessage) => emit('open-gallery', message)"
          @open-profile-dialog="(userId: number) => emit('open-profile-dialog', userId)"
          @respond-with-ai="(message: MessengerMessage) => emit('respond-with-ai', message)"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="flex items-center justify-center h-full">
        <div class="text-center text-[#999]">
          <p v-if="isSearchActive && messages.length > 0">No messages match your search</p>
          <template v-else>
            <p>No messages yet</p>
            <p class="text-sm mt-2">Start the conversation!</p>
          </template>
        </div>
      </div>

      <!-- Typing Indicator -->
      <div 
        v-if="selectedChat && typingStates.get(String(selectedChat.group_id))" 
        class="flex gap-3 min-w-0"
      >
        <img
          :src="`https://pictures.sdc.com/photos/${selectedChat.primary_photo}`"
          :alt="selectedChat.account_id"
          class="w-8 h-8 rounded-full object-cover shrink-0"
        />
        <div class="flex flex-col gap-1 min-w-0 max-w-[70%] items-start">
          <div class="px-4 py-2 rounded-lg bg-[#2a2a2a] text-white">
            <div class="flex gap-1">
              <span class="w-2 h-2 bg-[#999] rounded-full animate-bounce" style="animation-delay: 0ms"></span>
              <span class="w-2 h-2 bg-[#999] rounded-full animate-bounce" style="animation-delay: 150ms"></span>
              <span class="w-2 h-2 bg-[#999] rounded-full animate-bounce" style="animation-delay: 300ms"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Message Input (only show for non-broadcast chats) -->
    <div v-if="!isBroadcast">
      <slot name="message-input" />
    </div>
  </div>
</template>

<style scoped>
.broadcast-content {
  color: #1f2937;
  line-height: 1.6;
}

.broadcast-content :deep(h1),
.broadcast-content :deep(h2),
.broadcast-content :deep(h3),
.broadcast-content :deep(h4),
.broadcast-content :deep(h5),
.broadcast-content :deep(h6) {
  color: #111827;
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}

.broadcast-content :deep(h1) {
  font-size: 2em;
}

.broadcast-content :deep(h2) {
  font-size: 1.5em;
}

.broadcast-content :deep(h3) {
  font-size: 1.25em;
}

.broadcast-content :deep(p) {
  margin-bottom: 1em;
  color: #1f2937;
}

.broadcast-content :deep(strong) {
  color: #111827;
  font-weight: 600;
}

.broadcast-content :deep(em) {
  font-style: italic;
}

.broadcast-content :deep(u) {
  text-decoration: underline;
}

.broadcast-content :deep(a) {
  color: #2563eb;
  text-decoration: underline;
  transition: color 0.2s;
}

.broadcast-content :deep(a:hover) {
  color: #1d4ed8;
}

.broadcast-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1em 0;
}

.broadcast-content :deep(ul),
.broadcast-content :deep(ol) {
  margin: 1em 0;
  padding-left: 2em;
  color: #1f2937;
}

.broadcast-content :deep(li) {
  margin-bottom: 0.5em;
}

.broadcast-content :deep(.ql-align-center) {
  text-align: center;
}

.broadcast-content :deep(.ql-indent-1) {
  padding-left: 1em;
}
</style>