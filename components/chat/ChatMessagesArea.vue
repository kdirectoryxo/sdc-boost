<script lang="ts" setup>
import { ref, computed, watch, nextTick } from 'vue';
import { Bot, MessageSquare, MoreVertical } from 'lucide-vue-next';
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaViewport,
} from 'reka-ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/lib/view-router/ui/dropdown-menu';
import { Button } from '@/lib/view-router/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/lib/view-router/ui/avatar';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/lib/view-router/ui/empty';
import { Spinner } from '@/lib/view-router/ui/spinner';
import ScrollBar from '@/lib/view-router/ui/scroll-area/ScrollBar.vue';
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

/** Underlying scroll viewport element — composables expect HTMLElement (scrollTop, querySelector, …) */
const viewportRef = ref<InstanceType<typeof ScrollAreaViewport> | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);

function syncViewportEl(): void {
  const v = viewportRef.value as unknown as { $el?: HTMLElement } | HTMLElement | null | undefined;
  if (!v) {
    messagesContainer.value = null;
    return;
  }
  const el =
    v instanceof HTMLElement ? v : (v as { $el?: HTMLElement }).$el;
  messagesContainer.value = el ?? null;
}

watch(viewportRef, () => nextTick(syncViewportEl), { flush: 'post' });
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

function handleMoveToFolder() {
  if (!props.selectedChat) {
    openHeaderDropdown.value = false;
    return;
  }
  emit('open-folder-dialog', props.selectedChat);
  openHeaderDropdown.value = false;
}

async function handleRemoveFromFolder() {
  if (!props.selectedChat || !props.selectedChat.folder_id) {
    openHeaderDropdown.value = false;
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
  openHeaderDropdown.value = false;
}

function handleOpenAIChat() {
  emit('open-ai-chat');
}

function handleOpenTagsHeader() {
  emit('open-tags');
  openHeaderDropdown.value = false;
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
  <div v-if="!selectedChat" class="flex flex-1 items-center justify-center">
    <Empty class="border-none bg-transparent p-8 md:p-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquare class="size-6" />
        </EmptyMedia>
        <EmptyTitle>Select a chat</EmptyTitle>
        <EmptyDescription>Choose a conversation to view messages.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  </div>
  <div v-else class="flex-1 flex flex-col min-w-0 overflow-hidden">
    <!-- Chat Header -->
    <div class="px-4 py-3 border-b border-white/[0.06] shrink-0 min-w-0 relative z-50">
      <div class="flex items-center gap-3 flex-wrap">
        <!-- Profile Info -->
        <div class="flex min-w-0 flex-1 basis-[200px] items-center gap-3">
          <Avatar
            v-if="!isGroup || (selectedChat.primary_photo && selectedChat.primary_photo !== '/thumbnail/' && selectedChat.primary_photo.trim() !== '')"
            class="size-9 shrink-0 cursor-pointer transition-opacity hover:opacity-80"
            :title="isGroup ? 'Click to view group' : 'Click to view profile'"
            @click="isGroup ? emit('open-group-dialog', String(selectedChat.group_id)) : emit('open-profile-dialog', selectedChat.db_id)"
          >
            <AvatarImage
              :src="`https://pictures.sdc.com/photos/${selectedChat.primary_photo}`"
              :alt="isGroup ? selectedChat.group_name : selectedChat.account_id"
              class="object-cover"
            />
            <AvatarFallback class="text-xs">{{ (isGroup ? (selectedChat.group_name ?? '') : selectedChat.account_id).slice(0, 2) }}</AvatarFallback>
          </Avatar>
          <Avatar
            v-else-if="isGroup"
            class="size-9 shrink-0 cursor-pointer bg-white/[0.06] p-1.5 transition-opacity hover:opacity-80"
            title="Click to view group"
            @click="emit('open-group-dialog', String(selectedChat.group_id))"
          >
            <AvatarImage
              src="https://www.sdc.com/react/assets/group.8481d87a.svg"
              :alt="selectedChat.group_name"
              class="object-cover"
            />
            <AvatarFallback>Gr</AvatarFallback>
          </Avatar>
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
              <span v-if="displayDistance" class="text-xs text-muted-foreground shrink-0">
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
            <p v-else-if="!isBroadcast && !isGroup" class="text-[11px] text-muted-foreground">Offline</p>
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
            <Button variant="ghost" size="icon-sm" title="AI Chat" @click="handleOpenAIChat">
              <Bot class="size-4 text-muted-foreground" />
            </Button>
            
            <!-- Dropdown Menu -->
            <div @click.stop class="relative z-50">
              <DropdownMenu
                :open="openHeaderDropdown"
                @update:open="handleHeaderDropdownToggle"
              >
                <DropdownMenuTrigger as-child>
                  <Button type="button" variant="ghost" size="icon-sm" class="shrink-0" @click.stop>
                    <MoreVertical class="size-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  :side-offset="4"
                  class="w-48 border border-white/[0.06] bg-background p-0 shadow-lg z-[100]"
                >
                  <DropdownMenuItem class="cursor-pointer text-white focus:bg-secondary" @click="handleTogglePin">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                      <line x1="12" y1="17" x2="12" y2="22"></line>
                      <path d="M5 17h14l-1-7H6l-1 7z"></path>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    {{ selectedChat?.pin_chat === 1 ? 'Unpin chat' : 'Pin chat' }}
                  </DropdownMenuItem>
                  <DropdownMenuItem class="cursor-pointer text-white focus:bg-secondary" @click="handleToggleMarkUnread">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    {{ selectedChat?.unread_counter > 0 ? 'Mark as read' : 'Mark as unread' }}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="cursor-pointer text-white focus:bg-secondary"
                    @click="handleOpenTagsHeader"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                      <line x1="7" y1="7" x2="7.01" y2="7"></line>
                    </svg>
                    Tags
                  </DropdownMenuItem>
                  <DropdownMenuSeparator class="bg-white/[0.06]" />
                  <DropdownMenuItem
                    v-if="!selectedChat?.folder_id"
                    class="cursor-pointer text-white focus:bg-secondary"
                    @click="handleMoveToFolder"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      <path d="M12 11v6"></path>
                      <path d="M9 14l3-3 3 3"></path>
                    </svg>
                    Move to folder
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="selectedChat?.folder_id"
                    class="cursor-pointer text-white focus:bg-secondary"
                    @click="handleRemoveFromFolder"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      <path d="M12 11v6"></path>
                      <path d="M9 14l3 3 3-3"></path>
                    </svg>
                    Remove from folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator class="bg-white/[0.06]" />
                  <DropdownMenuItem
                    variant="destructive"
                    class="cursor-pointer focus:bg-secondary"
                    @click="handleDeleteChat"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Broadcast Content -->
    <ScrollAreaRoot
      v-if="isBroadcast"
      class="relative min-h-0 flex-1 min-w-0 bg-white"
    >
      <ScrollAreaViewport
        ref="viewportRef"
        class="size-full max-h-full outline-none"
      >
      <div class="relative min-w-0 p-6">
      <div v-if="selectedChat?.body" class="mx-auto max-w-4xl">
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
      <div v-else class="flex h-full items-center justify-center">
        <div class="text-center text-gray-500">
          <p>No broadcast content available</p>
        </div>
      </div>
      </div>
      </ScrollAreaViewport>
      <ScrollBar />
      <ScrollAreaCorner />
    </ScrollAreaRoot>

    <!-- Messages Area (for regular chats) -->
    <ScrollAreaRoot
      v-else
      class="relative z-0 min-h-0 flex-1 min-w-0"
    >
      <ScrollAreaViewport
        ref="viewportRef"
        class="size-full max-h-full outline-none"
        @click="handleContainerClick"
      >
      <div class="relative z-0 min-w-0 space-y-4 p-6">
      <!-- Syncing Notice (sticky centered overlay) -->
      <div 
        v-if="isSyncing" 
        class="sticky top-6 z-10 flex justify-center mb-4"
      >
        <div class="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-background px-4 py-2 shadow-lg">
          <Spinner class="size-4 text-blue-500" />
          <span class="text-sm font-medium text-white">Syncing..</span>
        </div>
      </div>

      <!-- Loading Indicator -->
      <div v-if="isLoadingMessages && messages.length === 0 && !messageError" class="flex justify-center py-8">
        <Spinner class="size-8 text-blue-500" />
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
          <p class="text-muted-foreground text-sm">This chat cannot be accessed</p>
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
      <div v-else class="flex h-full min-h-[12rem] items-center justify-center">
        <Empty class="border-none bg-transparent p-6">
          <EmptyHeader>
            <EmptyTitle>{{ isSearchActive ? 'No messages match your search' : 'No messages yet' }}</EmptyTitle>
            <EmptyDescription>
              {{ isSearchActive ? 'Try a different search term.' : 'Start the conversation!' }}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>

      <!-- Typing Indicator -->
      <div 
        v-if="selectedChat && typingStates.get(String(selectedChat.group_id))" 
        class="flex min-w-0 gap-3"
      >
        <Avatar class="size-8 shrink-0">
          <AvatarImage
            :src="`https://pictures.sdc.com/photos/${selectedChat.primary_photo}`"
            :alt="selectedChat.account_id"
            class="object-cover"
          />
          <AvatarFallback class="text-xs">{{ selectedChat.account_id.slice(0, 2) }}</AvatarFallback>
        </Avatar>
        <div class="flex flex-col gap-1 min-w-0 max-w-[70%] items-start">
          <div class="px-4 py-2 rounded-lg bg-secondary text-white">
            <div class="flex gap-1">
              <span class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0ms"></span>
              <span class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 150ms"></span>
              <span class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 300ms"></span>
            </div>
          </div>
        </div>
      </div>
      </div>
      </ScrollAreaViewport>
      <ScrollBar />
      <ScrollAreaCorner />
    </ScrollAreaRoot>

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