<script lang="ts" setup>
import { computed } from 'vue';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { parseGalleryMessage } from '@/lib/composables/chat/utils';

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
}>();

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
  }
  
  return props.chat.last_message || '';
});

function handleClick() {
  emit('click', props.chat);
}
</script>

<template>
  <div
    :class="[
      'px-4 py-3 cursor-pointer transition-colors hover:bg-[#1a1a1a]',
      selected ? 'bg-[#1a1a1a]' : ''
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


