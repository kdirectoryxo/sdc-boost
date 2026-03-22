<script lang="ts" setup>
import { computed, ref, markRaw, nextTick } from 'vue';
import { useDraggable } from '@vue-dnd-kit/core';
import { MoreVertical } from 'lucide-vue-next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/lib/view-router/ui/dropdown-menu';
import { Button } from '@/lib/view-router/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/lib/view-router/ui/avatar';
import { Badge } from '@/lib/view-router/ui/badge';
import TagBadge from '@/components/ui/TagBadge.vue';
import ChatDragPreview from '@/components/chat/ChatDragPreview.vue';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { parseGalleryMessage } from '@/lib/composables/chat/utils';
import { useChatPin } from '@/lib/composables/chat/useChatPin';
import { useChatProfile, getAgeColorClass, formatLocation, isGender2Real } from '@/lib/composables/chat/useChatProfile';
import { useChatFolders } from '@/lib/composables/chat/useChatFolders';
import { confirm } from '@/lib/confirm';
import { toast } from '@/lib/toast';

interface Props {
  chat: MessengerChatItem;
  selected?: boolean;
  folderName?: string;
  isTyping?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  isTyping: false,
});

const emit = defineEmits<{
  click: [chat: MessengerChatItem];
  'open-tags': [chat: MessengerChatItem];
  'open-folder-dialog': [chat: MessengerChatItem];
}>();

const { togglePinChat, toggleMarkUnread, deleteChat } = useChatPin();
const { removeChatFromFolder } = useChatFolders();
const openDropdownId = ref<number | string | null>(null);

// Drag threshold tracking - prevents accidental drags when clicking
const dragStartPosition = ref<{ x: number; y: number } | null>(null);
const dragThreshold = 10; // pixels - must move this far before drag starts
const dragDelay = 200; // milliseconds - hold time before drag starts (for click and hold)
const isDragEnabled = ref(false); // Only enable drag after threshold is met
const dragTimeout = ref<number | null>(null);

// Drag and drop setup with custom preview
// Disabled by default, will be enabled when threshold is met
const { elementRef, isDragging, handleDragStart } = useDraggable({
  id: `chat-${props.chat.group_id}`,
  data: { chat: props.chat },
  container: markRaw(ChatDragPreview),
  disabled: computed(() => !isDragEnabled.value),
});

// Check if this is a group
const isGroup = computed(() => {
  return props.chat.group_type === 1 || typeof props.chat.group_id === 'string';
});

// Fetch profile data for ages and distances (skip for broadcasts and groups)
const shouldFetchProfile = computed(() => {
  return !props.chat.broadcast && props.chat.type !== 100 && props.chat.db_id > 0 && !isGroup.value;
});

const { profileData } = useChatProfile(computed(() => shouldFetchProfile.value ? props.chat.db_id : null));

const nameColor = computed(() => {
  if (props.chat.broadcast || props.chat.type === 100) {
    return 'text-yellow-400'; // Yellow for broadcasts
  } else if (props.chat.gender1 === 1 && props.chat.gender2 === 2) {
    return 'text-pink-400'; // Pink for couples with female
  }
  return 'text-purple-400'; // Purple default
});

/**
 * Strip HTML tags and extract plain text from HTML string
 */
function stripHtml(html: string): string {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

const displayMessage = computed(() => {
  // Show blocked status if chat is blocked
  if (props.chat.isBlocked) {
    return 'Geblokkeerd';
  }
  
  if (props.chat.broadcast || props.chat.type === 100) {
    // For broadcasts, show body (stripped of HTML) instead of subject
    if (props.chat.body) {
      const plainText = stripHtml(props.chat.body);
      // Truncate to reasonable length for preview
      return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;
    }
    // Fallback to subject if body is not available
    return props.chat.subject || '';
  }
  
  // Check if it's a gallery message
  if (props.chat.last_message) {
    const galleryData = parseGalleryMessage(props.chat.last_message);
    if (galleryData) {
      return `🖼️ ${galleryData.galleryName}`;
    }
    
    // Check if it's an image message (type 6)
    if (props.chat.last_message.startsWith('[6|') && props.chat.last_message.includes('|')) {
      return '📷 Image';
    }
    
    // Check if it's a video message (type 8)
    if (props.chat.last_message.startsWith('[8|') && props.chat.last_message.includes('|')) {
      return '🎥 Video';
    }
  }
  
  return props.chat.last_message || '';
});

function handleClick(e: MouseEvent) {
  // Don't trigger click if we're currently dragging
  if (isDragging.value) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  emit('click', props.chat);
}

function handlePointerDown(e: PointerEvent) {
  // Reset drag enabled state
  isDragEnabled.value = false;
  
  // Clear any existing timeout
  if (dragTimeout.value !== null) {
    clearTimeout(dragTimeout.value);
    dragTimeout.value = null;
  }
  
  // Store initial position
  dragStartPosition.value = { x: e.clientX, y: e.clientY };
  const originalEvent = e;
  let currentPointerPos = { x: e.clientX, y: e.clientY };
  
  // Set up pointer move handler
  const handlePointerMove = (moveEvent: PointerEvent) => {
    if (!dragStartPosition.value) return;
    
    // Update current pointer position
    currentPointerPos = { x: moveEvent.clientX, y: moveEvent.clientY };
    
    const deltaX = Math.abs(moveEvent.clientX - dragStartPosition.value.x);
    const deltaY = Math.abs(moveEvent.clientY - dragStartPosition.value.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // If moved beyond threshold, enable dragging and start it
    if (distance > dragThreshold && !isDragEnabled.value) {
      // Clear the delay timeout since we're moving
      if (dragTimeout.value !== null) {
        clearTimeout(dragTimeout.value);
        dragTimeout.value = null;
      }
      
      isDragEnabled.value = true;
      // Now that dragging is enabled, trigger the drag start
      // Use nextTick to ensure the disabled state has updated
      nextTick(() => {
        handleDragStart(originalEvent);
      });
    }
  };
  
  // Set up pointer up handler to clean up
  const handlePointerUp = () => {
    // Clean up listeners and reset state
    dragStartPosition.value = null;
    isDragEnabled.value = false;
    if (dragTimeout.value !== null) {
      clearTimeout(dragTimeout.value);
      dragTimeout.value = null;
    }
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
  };
  
  // Set up delay timeout for click and hold
  dragTimeout.value = window.setTimeout(() => {
    // After delay, if still holding and haven't moved much, enable drag
    if (dragStartPosition.value && !isDragEnabled.value) {
      const startPos = dragStartPosition.value;
      // Check if pointer hasn't moved much (within tolerance)
      const deltaX = Math.abs(currentPointerPos.x - startPos.x);
      const deltaY = Math.abs(currentPointerPos.y - startPos.y);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // If still near the start position, enable drag for click and hold
      if (distance < dragThreshold) {
        isDragEnabled.value = true;
        nextTick(() => {
          handleDragStart(originalEvent);
        });
      }
    }
    dragTimeout.value = null;
  }, dragDelay);
  
  // Add listeners
  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp, { once: true });
}

function handleTogglePin() {
  togglePinChat(props.chat);
  openDropdownId.value = null;
}

function handleToggleMarkUnread() {
  const isUnread = props.chat.unread_counter > 0;
  toggleMarkUnread(props.chat, !isUnread);
  openDropdownId.value = null;
}

function handleDropdownToggle(open: boolean) {
  openDropdownId.value = open ? (props.chat.group_id as number | string) : null;
}

function handleOpenTags() {
  emit('open-tags', props.chat);
  openDropdownId.value = null;
}

async function handleDeleteChat() {
  await deleteChat(props.chat);
  openDropdownId.value = null;
}

function handleMoveToFolder() {
  emit('open-folder-dialog', props.chat);
  openDropdownId.value = null;
}

async function handleRemoveFromFolder() {
  if (!props.chat.folder_id) {
    openDropdownId.value = null;
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
      await removeChatFromFolder(props.chat.group_id, props.chat.folder_id);
      toast.success('Chat removed from folder');
    } catch (error) {
      console.error('Failed to remove chat from folder:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove chat from folder');
    }
  }
  openDropdownId.value = null;
}

// Get tags from chat (tags are merged from metadata)
const chatTags = computed(() => {
  return (props.chat as any).tags || [];
});

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
  <div
      ref="elementRef"
      :class="[
        'px-4 py-3 cursor-pointer transition-colors hover:bg-card group relative',
        selected ? 'bg-card' : '',
        openDropdownId === (chat.group_id as number | string) ? 'z-50' : 'z-auto',
        isDragging ? 'opacity-30 cursor-grabbing' : 'cursor-grab'
      ]"
      style="touch-action: none; user-select: none;"
    @click="handleClick"
    @pointerdown.stop="handlePointerDown"
  >
    <div class="flex items-start gap-3">
      <!-- Avatar -->
      <div class="relative shrink-0">
        <Avatar
          v-if="!isGroup || (chat.primary_photo && chat.primary_photo !== '/thumbnail/' && chat.primary_photo.trim() !== '')"
          class="size-12"
        >
          <AvatarImage
            :src="`https://pictures.sdc.com/photos/${chat.primary_photo}`"
            :alt="isGroup ? chat.group_name : chat.account_id"
            class="object-cover"
          />
          <AvatarFallback class="text-xs">{{ (isGroup ? (chat.group_name ?? '') : chat.account_id).slice(0, 2) }}</AvatarFallback>
        </Avatar>
        <Avatar v-else-if="isGroup" class="size-12 bg-white/[0.06] p-2">
          <AvatarImage
            src="https://www.sdc.com/react/assets/group.8481d87a.svg"
            :alt="chat.group_name"
            class="object-cover"
          />
          <AvatarFallback>Gr</AvatarFallback>
        </Avatar>
        <!-- Online Indicator -->
        <div
          v-if="chat.online === 1 && !chat.broadcast && !isGroup"
          class="absolute right-0 bottom-0 size-3 rounded-full border-2 border-background bg-green-500"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <h3 :class="['font-semibold truncate', nameColor]">
              {{ isGroup ? chat.group_name : chat.account_id }}
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
            <Badge v-if="folderName" variant="secondary" class="shrink-0 px-1.5 py-0 text-xs font-normal text-muted-foreground">
              {{ folderName }}
            </Badge>
            <!-- Tags -->
            <div v-if="chatTags.length > 0" class="flex items-center gap-1 shrink-0">
              <TagBadge
                v-for="(tag, index) in chatTags.slice(0, 2)"
                :key="index"
                :text="tag.text"
                :color="tag.color"
              />
              <span v-if="chatTags.length > 2" class="text-xs text-white/40">
                +{{ chatTags.length - 2 }}
              </span>
            </div>
          </div>
          <span :class="['text-xs shrink-0 ml-2', chat.unread_counter > 0 ? 'text-red-500' : 'text-white/40']">
            {{ chat.time_elapsed }}
          </span>
        </div>

        <div class="flex items-center justify-between gap-2">
          <p class="text-sm truncate flex-1" :class="chat.isBlocked ? 'text-red-500' : 'text-muted-foreground'">
            <span v-if="chat.broadcast || chat.type === 100" class="inline-block mr-1">📢</span>
            <span v-if="isTyping" class="italic text-blue-400">typing...</span>
            <span v-else>{{ displayMessage }}</span>
          </p>
          
          <div class="flex items-center gap-2 shrink-0">
            <!-- Pin Indicator -->
            <svg
              v-if="chat.pin_chat === 1"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-blue-400"
            >
              <line x1="12" y1="17" x2="12" y2="22"></line>
              <path d="M5 17h14l-1-7H6l-1 7z"></path>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>

            <!-- Dropdown Menu -->
            <div @click.stop class="w-4 h-4 flex items-center justify-center relative" :class="{ 'z-51': openDropdownId === (chat.group_id as number | string) }">
              <DropdownMenu
                :open="openDropdownId === (chat.group_id as number | string)"
                @update:open="handleDropdownToggle"
              >
                <DropdownMenuTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    class="group/btn shrink-0"
                    @click.stop
                  >
                    <MoreVertical class="size-4 text-muted-foreground transition-colors group-hover/btn:text-white" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  class="w-48 border border-white/[0.06] bg-background p-0 shadow-lg z-[100]"
                  align="end"
                  :side-offset="4"
                >
                  <DropdownMenuItem class="cursor-pointer text-white focus:bg-secondary" @click="handleTogglePin">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                      <line x1="12" y1="17" x2="12" y2="22"></line>
                      <path d="M5 17h14l-1-7H6l-1 7z"></path>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    {{ chat.pin_chat === 1 ? 'Unpin chat' : 'Pin chat' }}
                  </DropdownMenuItem>
                  <DropdownMenuItem class="cursor-pointer text-white focus:bg-secondary" @click="handleToggleMarkUnread">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    {{ chat.unread_counter > 0 ? 'Mark as read' : 'Mark as unread' }}
                  </DropdownMenuItem>
                  <DropdownMenuItem class="cursor-pointer text-white focus:bg-secondary" @click="handleOpenTags">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                      <line x1="7" y1="7" x2="7.01" y2="7"></line>
                    </svg>
                    Tags
                  </DropdownMenuItem>
                  <DropdownMenuSeparator class="bg-white/[0.06]" />
                  <DropdownMenuItem
                    v-if="!chat.folder_id"
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
                    v-if="chat.folder_id"
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

            <!-- Unread Badge -->
            <Badge
              v-if="chat.unread_counter > 0"
              variant="destructive"
              :class="[
                'inline-flex shrink-0 items-center justify-center rounded-full border-0 font-bold tabular-nums leading-none text-xs',
                chat.unread_counter > 99
                  ? 'h-5 min-w-[30px] px-1'
                  : chat.unread_counter > 9
                    ? 'h-5 min-w-[22px] px-1'
                    : 'size-5 px-0',
              ]"
            >
              {{ chat.unread_counter > 99 ? '99+' : chat.unread_counter }}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


