<script lang="ts" setup>
import { computed, ref } from 'vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import TagBadge from '@/components/ui/TagBadge.vue';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { parseGalleryMessage } from '@/lib/composables/chat/utils';
import { useChatPin } from '@/lib/composables/chat/useChatPin';

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
}>();

const { togglePinChat, toggleMarkUnread } = useChatPin();
const openDropdownId = ref<number | null>(null);

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

function handleClick() {
  emit('click', props.chat);
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
  openDropdownId.value = open ? props.chat.group_id : null;
}

function handleOpenTags(close: () => void) {
  emit('open-tags', props.chat);
  close();
}

// Get tags from chat (tags are merged from metadata)
const chatTags = computed(() => {
  return (props.chat as any).tags || [];
});
</script>

<template>
  <div
    :class="[
      'px-4 py-3 cursor-pointer transition-colors hover:bg-[#1a1a1a] group relative',
      selected ? 'bg-[#1a1a1a]' : '',
      openDropdownId === chat.group_id ? 'z-50' : 'z-auto'
    ]"
    @click="handleClick"
  >
    <div class="flex items-start gap-3">
      <!-- Avatar -->
      <div class="relative shrink-0">
        <img
          :src="`https://pictures.sdc.com/photos/${chat.primary_photo}`"
          :alt="chat.account_id"
          class="w-12 h-12 rounded-full object-cover"
        />
        <!-- Online Indicator -->
        <div
          v-if="chat.online === 1 && !chat.broadcast"
          class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0f0f0f] rounded-full"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <h3 :class="['font-semibold truncate', nameColor]">
              {{ chat.account_id }}
            </h3>
            <span v-if="folderName" class="px-1.5 py-0.5 bg-[#333] text-[#999] text-xs rounded shrink-0">
              {{ folderName }}
            </span>
            <!-- Tags -->
            <div v-if="chatTags.length > 0" class="flex items-center gap-1 shrink-0">
              <TagBadge
                v-for="(tag, index) in chatTags.slice(0, 2)"
                :key="index"
                :text="tag.text"
                :color="tag.color"
              />
              <span v-if="chatTags.length > 2" class="text-xs text-[#666]">
                +{{ chatTags.length - 2 }}
              </span>
            </div>
          </div>
          <span :class="['text-xs shrink-0 ml-2', chat.unread_counter > 0 ? 'text-red-500' : 'text-[#666]']">
            {{ chat.time_elapsed }}
          </span>
        </div>

        <div class="flex items-center justify-between gap-2">
          <p class="text-sm truncate flex-1" :class="chat.isBlocked ? 'text-red-500' : 'text-[#999]'">
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
            <div @click.stop class="w-4 h-4 flex items-center justify-center relative" :class="{ 'z-51': openDropdownId === chat.group_id }">
              <Dropdown
                :model-value="openDropdownId === chat.group_id"
                @update:model-value="handleDropdownToggle"
                placement="bottom"
                alignment="end"
                width="w-48"
                offset="mt-1"
                :z-index="51"
              >
                <template #trigger="{ isOpen, toggle }">
                  <button
                    @click.stop="toggle"
                    class="p-0 rounded transition-colors flex items-center justify-center group/btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] group-hover/btn:text-white transition-colors">
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
                      {{ chat.pin_chat === 1 ? 'Unpin chat' : 'Pin chat' }}
                    </button>
                    <button
                      @click.stop="handleToggleMarkUnread(); close()"
                      class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      {{ chat.unread_counter > 0 ? 'Mark as read' : 'Mark as unread' }}
                    </button>
                    <button
                      @click.stop="handleOpenTags(close)"
                      class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                        <line x1="7" y1="7" x2="7.01" y2="7"></line>
                      </svg>
                      Tags
                    </button>
                  </div>
                </template>
              </Dropdown>
            </div>

            <!-- Unread Badge -->
            <span
              v-if="chat.unread_counter > 0"
              :class="[
                'h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none',
                chat.unread_counter > 9 ? 'px-1.5 min-w-[20px]' : 'w-5'
              ]"
            >
              {{ chat.unread_counter > 99 ? '99+' : chat.unread_counter }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


