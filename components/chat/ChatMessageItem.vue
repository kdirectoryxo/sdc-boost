<script lang="ts" setup>
import { computed } from 'vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import type { MessengerChatItem, MessengerMessage } from '@/lib/sdc-api-types';
import { parseImageMessage, parseVideoMessage, parseVideoUrls, parseGalleryMessage, getImageUrl, getImageDbId, highlightText, formatMessageDate, isOwnMessage } from '@/lib/composables/chat/utils';

interface Props {
  message: MessengerMessage;
  index: number;
  selectedChat: MessengerChatItem | null;
  isSearchActive: boolean;
  isHighlighted: boolean;
  openDropdownMessageId: number | null;
  messageSearchQuery?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:open-dropdown-message-id': [value: number | null];
  'quote-message': [message: MessengerMessage];
  'copy-message': [message: MessengerMessage];
  'delete-message': [message: MessengerMessage];
  'scroll-to-quoted': [message: MessengerMessage];
  'open-lightbox': [message: MessengerMessage, imageIndex: number, event?: Event];
  'open-gallery': [message: MessengerMessage];
}>();

const parsedMessage = computed(() => parseImageMessage(props.message.message));
const parsedVideoMessage = computed(() => parseVideoMessage(props.message.message));
const videoUrls = computed(() => parseVideoUrls(props.message.url_videos));
const galleryMessage = computed(() => parseGalleryMessage(props.message.message));
const imageDbId = computed(() => getImageDbId(props.message));

function handleOpenGallery() {
  emit('open-gallery', props.message);
}

function handleOpenGalleryForAlbum(albumId: string) {
  // Create a modified message with only this album
  const album = galleryMessage.value?.albums?.find(a => a.id === albumId);
  if (!album) return;
  
  // Create a temporary message with just this album
  const singleAlbumMessage: MessengerMessage = {
    ...props.message,
    message: `[7|${JSON.stringify({ id: album.id, name: album.name })}]`
  };
  emit('open-gallery', singleAlbumMessage);
}

function handleDropdownToggle(open: boolean) {
  emit('update:open-dropdown-message-id', open ? props.message.message_id : null);
}

function handleQuote() {
  emit('quote-message', props.message);
  emit('update:open-dropdown-message-id', null);
}

function handleCopy() {
  emit('copy-message', props.message);
  emit('update:open-dropdown-message-id', null);
}

function handleDelete() {
  emit('delete-message', props.message);
  emit('update:open-dropdown-message-id', null);
}

function handleScrollToQuoted() {
  emit('scroll-to-quoted', props.message);
}

function handleOpenLightbox(imageIndex: number, event?: Event) {
  emit('open-lightbox', props.message, imageIndex, event);
}

function handleVideoError(event: Event, videoUrl: string, index: number) {
  const videoElement = event.target as HTMLVideoElement;
  console.error('[ChatMessageItem] Video load error:', videoUrl, event);
  
  // Hide the video element and show an error message
  const container = videoElement.parentElement;
  if (container) {
    videoElement.style.display = 'none';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'p-4 text-center text-[#999] text-sm';
    errorDiv.textContent = 'Video unavailable';
    container.appendChild(errorDiv);
  }
}

const messageId = computed(() => {
  return props.message.message_id > 0 
    ? `message-${props.message.message_id}`
    : `message-opt_${props.index}_${props.message.date2}`;
});
</script>

<template>
  <div
    :id="messageId"
    :data-message-id="message.message_id"
    :class="[
      'flex gap-3 min-w-0 w-full group',
      isOwnMessage(message) ? 'flex-row-reverse' : 'flex-row',
      isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#1a1a1a] rounded-lg p-1' : ''
    ]"
  >
    <!-- Avatar (only for other user) -->
    <img
      v-if="!isOwnMessage(message) && selectedChat"
      :src="`https://pictures.sdc.com/photos/${selectedChat.primary_photo}`"
      :alt="message.account_id"
      class="w-8 h-8 rounded-full object-cover shrink-0"
    />

    <!-- Message Content -->
    <div
      :class="[
        'flex flex-col gap-1 min-w-0 relative',
        isOwnMessage(message) ? 'items-end ml-auto max-w-[70%]' : 'items-start max-w-[70%]'
      ]"
    >
      <!-- Quoted Message -->
      <div
        v-if="message.is_quote && message.q_message"
        @click.stop="handleScrollToQuoted"
        :class="[
          'px-3 py-2 rounded-lg text-sm border-l-2 min-w-0 w-full cursor-pointer transition-colors',
          isOwnMessage(message)
            ? 'bg-[#2a2a2a] border-blue-500 text-[#ccc] hover:bg-[#333]'
            : 'bg-[#0f0f0f] border-[#444] text-[#999] hover:bg-[#1a1a1a]'
        ]"
      >
        <div class="font-semibold text-xs mb-1 truncate">
          {{ message.q_account_id }}
        </div>
        <div class="text-xs line-clamp-2 wrap-break-word">{{ message.q_message }}</div>
      </div>

      <!-- Message Bubble -->
      <div
        :class="[
          'px-4 py-2 rounded-lg min-w-0 w-full',
          isOwnMessage(message)
            ? 'bg-blue-500 text-white'
            : 'bg-[#2a2a2a] text-white'
        ]"
      >
        <!-- Gallery Message -->
        <template v-if="galleryMessage">
          <div v-if="galleryMessage.albums && galleryMessage.albums.length > 1" class="grid gap-2 grid-cols-2">
            <div
              v-for="(album, index) in galleryMessage.albums"
              :key="album.id"
              @click.stop="handleOpenGalleryForAlbum(album.id)"
              class="flex flex-col items-center justify-center cursor-pointer hover:opacity-90 transition-opacity p-3 gap-2 rounded-lg"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <div class="font-semibold text-xs text-center line-clamp-2 wrap-break-word">{{ album.name }}</div>
            </div>
          </div>
          <div
            v-else
            @click.stop="handleOpenGallery()"
            class="flex flex-col items-center justify-center cursor-pointer hover:opacity-90 transition-opacity p-4 gap-3"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <div class="font-semibold text-sm text-center">{{ galleryMessage.galleryName }}</div>
          </div>
        </template>
        <!-- Image Message -->
        <template v-else-if="parsedMessage.imageIds.length > 0">
          <div class="space-y-2">
            <div class="grid gap-2" :class="parsedMessage.imageIds.length === 1 ? 'grid-cols-1' : 'grid-cols-2'">
              <img
                v-for="(imageId, idx) in parsedMessage.imageIds"
                :key="idx"
                :src="getImageUrl(imageId, imageDbId || undefined)"
                :alt="`Image ${idx + 1}`"
                class="max-w-full max-h-[400px] rounded object-cover cursor-pointer hover:opacity-90 transition-opacity"
                @error="(e) => { (e.target as HTMLImageElement).style.display = 'none'; }"
                @click.stop="handleOpenLightbox(idx, $event)"
              />
            </div>
            <p 
              v-if="parsedMessage.text"
              class="whitespace-pre-wrap wrap-break-word overflow-wrap-anywhere"
              v-html="highlightText(parsedMessage.text, messageSearchQuery || '')"
            ></p>
          </div>
        </template>
        <!-- Video Message -->
        <template v-else-if="videoUrls.length > 0">
          <div class="space-y-2">
            <div class="grid gap-2" :class="videoUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'">
              <div
                v-for="(videoUrl, idx) in videoUrls"
                :key="idx"
                class="relative bg-[#0f0f0f] rounded-lg overflow-hidden w-full"
              >
                <video
                  :src="videoUrl"
                  controls
                  crossorigin="use-credentials"
                  preload="metadata"
                  class="w-full h-auto max-h-[400px] rounded"
                  @error="(e) => handleVideoError(e, videoUrl, idx)"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
            <p 
              v-if="parsedVideoMessage.text"
              class="whitespace-pre-wrap wrap-break-word overflow-wrap-anywhere"
              v-html="highlightText(parsedVideoMessage.text, messageSearchQuery || '')"
            ></p>
          </div>
        </template>
        <!-- Regular Message -->
        <p 
          v-else
          class="whitespace-pre-wrap wrap-break-word overflow-wrap-anywhere"
          v-html="highlightText(message.message, messageSearchQuery || '')"
        ></p>
      </div>

      <!-- Message Meta -->
      <div class="flex items-center gap-2 text-xs text-[#666] shrink-0">
        <span class="whitespace-nowrap">{{ formatMessageDate(message) }}</span>
        <span v-if="isOwnMessage(message)" class="relative inline-flex items-center shrink-0 ml-1" :class="message.seen === 1 ? 'text-blue-400' : 'text-[#666]'">
          <!-- Single checkmark for sent messages -->
          <svg v-if="message.seen !== 1" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
          </svg>
          <!-- Double checkmark for seen messages (overlapping) -->
          <template v-else>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="absolute left-0">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
            </svg>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="ml-[-6px]">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
            </svg>
          </template>
        </span>
      </div>
      
      <!-- Dropdown Button for own messages (positioned absolutely to the left of message bubble) -->
      <div v-if="isOwnMessage(message)" class="absolute -left-8 top-0 z-50">
        <Dropdown
          :model-value="openDropdownMessageId === message.message_id"
          @update:model-value="handleDropdownToggle"
          placement="bottom"
          alignment="right-full"
          width="w-32"
          offset="mr-2 mt-1"
          :z-index="9999999"
        >
          <template #trigger="{ isOpen, toggle }">
            <button
              @click.stop="toggle"
              :class="[
                'p-1.5 rounded hover:bg-[#2a2a2a] transition-opacity',
                isOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              ]"
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
              class="w-32 rounded-md shadow-lg bg-[#1a1a1a] border border-[#333] py-1"
              @click.stop
            >
              <button
                @click.stop="handleCopy(); close()"
                class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
              </button>
              <button
                @click.stop="handleQuote(); close()"
                class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
                  <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
                </svg>
                Citaat
              </button>
              <button
                @click.stop="handleDelete(); close()"
                class="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Delete
              </button>
            </div>
          </template>
        </Dropdown>
      </div>
    </div>
    
    <!-- Dropdown Button for other messages (placed last in DOM, appears on right) -->
    <div v-if="!isOwnMessage(message)" class="relative shrink-0 self-start mt-1 z-50">
      <Dropdown
        :model-value="openDropdownMessageId === message.message_id"
        @update:model-value="handleDropdownToggle"
        placement="bottom"
        alignment="start"
        width="w-32"
        offset="mt-1"
        :z-index="9999999"
      >
        <template #trigger="{ isOpen, toggle }">
          <button
            @click.stop="toggle"
            :class="[
              'p-1.5 rounded hover:bg-[#2a2a2a] transition-opacity',
              isOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            ]"
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
            class="w-32 rounded-md shadow-lg bg-[#1a1a1a] border border-[#333] py-1"
            @click.stop
          >
            <button
              @click.stop="handleCopy(); close()"
              class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
            <button
              @click.stop="handleQuote(); close()"
              class="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
              </svg>
              Citaat
            </button>
          </div>
        </template>
      </Dropdown>
    </div>
  </div>
</template>

