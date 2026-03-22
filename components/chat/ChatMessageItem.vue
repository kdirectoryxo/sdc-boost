<script lang="ts" setup>
import { computed } from 'vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/lib/view-router/ui/dropdown-menu';
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
  'open-profile-dialog': [userId: number];
  'respond-with-ai': [message: MessengerMessage];
}>();

const parsedMessage = computed(() => parseImageMessage(props.message.message));
const parsedVideoMessage = computed(() => parseVideoMessage(props.message.message));
const videoUrls = computed(() => parseVideoUrls(props.message.url_videos));
const galleryMessage = computed(() => parseGalleryMessage(props.message.message));
const imageDbId = computed(() => getImageDbId(props.message));
const quotedGalleryMessage = computed(() => {
  if (props.message.is_quote && props.message.q_message) {
    return parseGalleryMessage(props.message.q_message);
  }
  return null;
});
const quotedImageMessage = computed(() => {
  if (props.message.is_quote && props.message.q_message) {
    return parseImageMessage(props.message.q_message);
  }
  return { imageIds: [], text: '' };
});

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
    errorDiv.className = 'p-4 text-center text-muted-foreground text-sm';
    errorDiv.textContent = 'Video unavailable';
    container.appendChild(errorDiv);
  }
}

const messageId = computed(() => {
  return props.message.message_id > 0 
    ? `message-${props.message.message_id}`
    : `message-opt_${props.index}_${props.message.date2}`;
});

// Check if this is a group chat
const isGroupChat = computed(() => {
  if (!props.selectedChat) return false;
  return props.selectedChat.group_type === 1 || typeof props.selectedChat.group_id === 'string';
});

// Name color based on gender (same logic as ChatMessagesArea)
const senderNameColor = computed(() => {
  if (props.message.gender1 === 1 && props.message.gender2 === 2) {
    return 'text-pink-400'; // Pink for couples with female
  }
  return 'text-purple-400'; // Purple default
});

function handleOpenProfile() {
  if (props.message.db_id && props.message.db_id > 0) {
    emit('open-profile-dialog', props.message.db_id);
  }
}

function handleRespondWithAI() {
  emit('respond-with-ai', props.message);
  emit('update:open-dropdown-message-id', null);
}

// Check if this is a system join message (sender === 2, message is just a db_id)
const isSystemJoinMessage = computed(() => {
  if (props.message.sender !== 2) return false;
  // Check if message is just a number (db_id)
  const messageText = props.message.message.trim();
  return /^\d+$/.test(messageText);
});
</script>

<template>
  <!-- System Join Message (centered, different styling) -->
  <div
    v-if="isSystemJoinMessage"
    :id="messageId"
    :data-message-id="message.message_id"
    class="flex justify-center items-center py-2"
  >
    <div class="px-4 py-1.5 bg-background border border-white/[0.06] rounded-full">
      <span class="text-xs text-muted-foreground">
        <span
          @click.stop="handleOpenProfile"
          :class="['font-semibold cursor-pointer hover:text-blue-400 transition-colors', senderNameColor]"
          :title="`Click to view ${message.account_id}'s profile`"
        >
          {{ message.account_id }}
        </span>
        <span class="text-white/40"> doet mee met de groep</span>
      </span>
    </div>
  </div>

  <!-- Regular Message -->
  <div
    v-else
    :id="messageId"
    :data-message-id="message.message_id"
    :class="[
      'flex gap-3 min-w-0 w-full group',
      isOwnMessage(message) ? 'flex-row-reverse' : 'flex-row',
      isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background rounded-lg p-1' : ''
    ]"
  >
    <!-- Avatar (only for other user, hidden in group chats) -->
    <img
      v-if="!isOwnMessage(message) && selectedChat && !isGroupChat"
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
      <!-- Sender Name (only in group chats, only for other users) -->
      <div
        v-if="isGroupChat && !isOwnMessage(message)"
        class="px-1 mb-0.5"
      >
        <span
          @click.stop="handleOpenProfile"
          :class="['text-xs font-semibold cursor-pointer hover:text-blue-400 transition-colors', senderNameColor]"
          :title="`Click to view ${message.account_id}'s profile`"
        >
          {{ message.account_id }}
        </span>
      </div>
      
      <!-- Quoted Message -->
      <div
        v-if="message.is_quote && message.q_message"
        @click.stop="handleScrollToQuoted"
        :class="[
          'px-3 py-2 rounded-lg text-sm border-l-2 min-w-0 w-full cursor-pointer transition-colors',
          isOwnMessage(message)
            ? 'bg-secondary border-blue-500 text-white/80 hover:bg-white/[0.08]'
            : 'bg-sidebar border-white/[0.08] text-muted-foreground hover:bg-background'
        ]"
      >
        <div class="font-semibold text-xs mb-1 truncate">
          {{ message.q_account_id }}
        </div>
        <!-- Quoted Album -->
        <div v-if="quotedGalleryMessage" class="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 opacity-70">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <div class="text-xs line-clamp-2 wrap-break-word min-w-0">
            <template v-if="quotedGalleryMessage.albums && quotedGalleryMessage.albums.length > 1">
              {{ quotedGalleryMessage.albums[0].name }} +{{ quotedGalleryMessage.albums.length - 1 }} more
            </template>
            <template v-else>
              {{ quotedGalleryMessage.galleryName }}
            </template>
          </div>
        </div>
        <!-- Quoted Image -->
        <div v-else-if="quotedImageMessage.imageIds.length > 0" class="space-y-1">
          <div class="flex gap-1.5">
            <img
              v-for="(imageId, idx) in quotedImageMessage.imageIds.slice(0, 2)"
              :key="idx"
              :src="getImageUrl(imageId, message.q_db_id || undefined)"
              :alt="`Quoted image ${idx + 1}`"
              class="w-12 h-12 rounded object-cover shrink-0"
              @error="(e) => { (e.target as HTMLImageElement).style.display = 'none'; }"
            />
            <div v-if="quotedImageMessage.imageIds.length > 2" class="w-12 h-12 rounded bg-background flex items-center justify-center text-xs text-muted-foreground shrink-0">
              +{{ quotedImageMessage.imageIds.length - 2 }}
            </div>
          </div>
          <div v-if="quotedImageMessage.text" class="text-xs line-clamp-1 wrap-break-word text-muted-foreground">
            {{ quotedImageMessage.text }}
          </div>
        </div>
        <!-- Quoted Regular Message -->
        <div v-else class="text-xs line-clamp-2 wrap-break-word">{{ message.q_message }}</div>
      </div>

      <!-- Message Bubble -->
      <div
        :class="[
          'px-4 py-2 rounded-lg min-w-0 w-full',
          isOwnMessage(message)
            ? 'bg-blue-500 text-white'
            : 'bg-secondary text-white'
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
                class="relative bg-sidebar rounded-lg overflow-hidden w-full"
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
      <div class="flex items-center gap-2 text-xs text-white/40 shrink-0">
        <span class="whitespace-nowrap">{{ formatMessageDate(message) }}</span>
        <span v-if="isOwnMessage(message)" class="relative inline-flex items-center shrink-0 ml-1" :class="message.seen === 1 ? 'text-blue-400' : 'text-white/40'">
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
        <DropdownMenu
          :open="openDropdownMessageId === message.message_id"
          @update:open="handleDropdownToggle"
        >
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              @click.stop
              :class="[
                'p-1.5 rounded hover:bg-secondary transition-opacity outline-none',
                openDropdownMessageId === message.message_id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              ]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground hover:text-white">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="left"
            align="start"
            :side-offset="8"
            class="w-32 border border-white/[0.06] bg-background p-0 shadow-lg z-[9999999]"
          >
            <DropdownMenuItem class="cursor-pointer text-white focus:bg-secondary" @click="handleCopy">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer text-white focus:bg-secondary" @click="handleQuote">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
              </svg>
              Citaat
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              class="cursor-pointer focus:bg-secondary"
              @click="handleDelete"
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
    
    <!-- Dropdown Button for other messages (placed last in DOM, appears on right) -->
    <div v-if="!isOwnMessage(message)" class="relative shrink-0 self-start mt-1 z-50">
      <DropdownMenu
        :open="openDropdownMessageId === message.message_id"
        @update:open="handleDropdownToggle"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            @click.stop
            :class="[
              'p-1.5 rounded hover:bg-secondary transition-opacity outline-none',
              openDropdownMessageId === message.message_id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            ]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground hover:text-white">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="start"
          :side-offset="4"
          class="w-44 border border-white/[0.06] bg-background p-0 shadow-lg z-[9999999]"
        >
          <DropdownMenuItem class="cursor-pointer text-white focus:bg-secondary" @click="handleCopy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </DropdownMenuItem>
          <DropdownMenuItem class="cursor-pointer text-white focus:bg-secondary" @click="handleQuote">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
            </svg>
            Citaat
          </DropdownMenuItem>
          <DropdownMenuItem class="cursor-pointer text-white focus:bg-secondary" @click="handleRespondWithAI">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <path d="M12 3v3m0 12v3m9-9h-3m-12 0H3m15.364 6.364l-2.121-2.121M6.757 6.757L4.636 4.636m14.728 0l-2.121 2.121M6.757 17.243l-2.121 2.121"></path>
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="5" r="1"></circle>
              <circle cx="5" cy="19" r="1"></circle>
              <circle cx="19" cy="19" r="1"></circle>
              <circle cx="5" cy="5" r="1"></circle>
            </svg>
            Respond with AI
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>

