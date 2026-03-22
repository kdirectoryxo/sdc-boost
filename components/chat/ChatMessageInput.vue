<script lang="ts" setup>
import { computed } from 'vue';
import { Plus, X } from 'lucide-vue-next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/lib/view-router/ui/dropdown-menu';
import { Button } from '@/lib/view-router/ui/button';
import { Input } from '@/lib/view-router/ui/input';
import { Card, CardContent } from '@/lib/view-router/ui/card';
import type { MessengerMessage } from '@/lib/sdc-api-types';
import { parseImageMessage, parseGalleryMessage, getImageUrl } from '@/lib/composables/chat/utils';

interface Props {
  messageInput: string;
  quotedMessage: MessengerMessage | null;
  uploadedMedia: Array<{ file: File; preview: string; type: 'image' | 'video' }>;
  isUploadDropdownOpen: boolean;
  isUploading: boolean;
  isWebSocketConnected: boolean;
  selectedChat: { group_id: number } | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:messageInput': [value: string];
  'update:isUploadDropdownOpen': [value: boolean];
  'send-message': [];
  'cancel-quote': [];
  'clear-uploaded-media': [];
  'remove-uploaded-media': [index: number];
  'trigger-photo-picker': [];
  'trigger-video-picker': [];
  'handle-message-input': [];
  'open-album-modal': [];
}>();

function onMessageInput(v: string | number) {
  emit('update:messageInput', String(v));
  emit('handle-message-input');
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    emit('send-message');
  }
}

// Parse quoted message to detect images and albums
const quotedImageMessage = computed(() => {
  if (props.quotedMessage?.message) {
    return parseImageMessage(props.quotedMessage.message);
  }
  return { imageIds: [], text: '' };
});

const quotedGalleryMessage = computed(() => {
  if (props.quotedMessage?.message) {
    return parseGalleryMessage(props.quotedMessage.message);
  }
  return null;
});
</script>

<template>
  <div class="px-6 py-4 border-t border-white/[0.06] shrink-0">
    <!-- Quoted Message Indicator -->
    <Card v-if="quotedMessage" class="mb-2 border-white/[0.06] bg-sidebar">
      <CardContent class="flex items-start gap-2 p-3">
      <div class="flex-1 min-w-0">
        <div class="text-xs text-muted-foreground mb-1">Quoting {{ quotedMessage.account_id }}</div>
        <!-- Quoted Album -->
        <div v-if="quotedGalleryMessage" class="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 opacity-70 text-muted-foreground">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <div class="text-sm text-white line-clamp-2 wrap-break-word min-w-0">
            <template v-if="quotedGalleryMessage.albums && quotedGalleryMessage.albums.length > 1">
              {{ quotedGalleryMessage.albums[0].name }} +{{ quotedGalleryMessage.albums.length - 1 }} more
            </template>
            <template v-else>
              {{ quotedGalleryMessage.galleryName }}
            </template>
          </div>
        </div>
        <!-- Quoted Image -->
        <div v-else-if="quotedImageMessage.imageIds.length > 0" class="flex items-center gap-2">
          <div class="flex gap-1.5 shrink-0">
            <img
              v-for="(imageId, idx) in quotedImageMessage.imageIds.slice(0, 2)"
              :key="idx"
              :src="getImageUrl(imageId, quotedMessage.db_id || undefined)"
              :alt="`Quoted image ${idx + 1}`"
              class="w-10 h-10 rounded object-cover"
              @error="(e) => { (e.target as HTMLImageElement).style.display = 'none'; }"
            />
            <div v-if="quotedImageMessage.imageIds.length > 2" class="w-10 h-10 rounded bg-background flex items-center justify-center text-xs text-muted-foreground">
              +{{ quotedImageMessage.imageIds.length - 2 }}
            </div>
          </div>
          <div v-if="quotedImageMessage.text" class="text-sm text-white line-clamp-1 wrap-break-word min-w-0">
            {{ quotedImageMessage.text }}
          </div>
        </div>
        <!-- Quoted Regular Message -->
        <div v-else class="text-sm text-white line-clamp-2">{{ quotedMessage.message }}</div>
      </div>
      <Button variant="ghost" size="icon-sm" class="shrink-0" @click="$emit('cancel-quote')">
        <X class="size-4 text-muted-foreground" />
      </Button>
      </CardContent>
    </Card>
    <!-- Uploaded Media Preview -->
    <Card v-if="uploadedMedia.length > 0" class="mb-2 border-white/[0.06] bg-sidebar">
      <CardContent class="p-3">
      <div class="mb-2 flex items-center justify-between">
        <div class="text-xs text-muted-foreground">{{ uploadedMedia.length }} {{ uploadedMedia.length === 1 ? 'file' : 'files' }} ready to send</div>
        <Button variant="ghost" size="icon-sm" class="shrink-0" @click="$emit('clear-uploaded-media')">
          <X class="size-4 text-muted-foreground" />
        </Button>
      </div>
      <div class="grid gap-2" :class="uploadedMedia.length === 1 ? 'grid-cols-1' : 'grid-cols-2'">
        <div
          v-for="(media, index) in uploadedMedia"
          :key="index"
          class="relative group"
        >
          <img
            v-if="media.type === 'image'"
            :src="media.preview"
            alt="Preview"
            class="w-full max-h-[200px] rounded object-cover"
          />
          <video
            v-else
            :src="media.preview"
            class="w-full max-h-[200px] rounded object-cover"
            controls
          />
          <Button
            variant="secondary"
            size="icon-sm"
            class="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100"
            @click="$emit('remove-uploaded-media', index)"
          >
            <X class="size-3.5 text-white" />
          </Button>
        </div>
      </div>
      </CardContent>
    </Card>
    <div class="flex items-center gap-2">
      <Input
        :model-value="messageInput"
        type="text"
        placeholder="Type a message..."
        :disabled="!selectedChat || !isWebSocketConnected || isUploading"
        class="flex-1 border-white/[0.06] bg-sidebar text-white placeholder:text-white/40"
        @update:model-value="onMessageInput"
        @keydown="handleKeydown"
      />
      <DropdownMenu
        :open="isUploadDropdownOpen"
        @update:open="$emit('update:isUploadDropdownOpen', $event)"
      >
        <DropdownMenuTrigger as-child>
          <Button
            type="button"
            variant="outline"
            size="icon"
            :disabled="!selectedChat || !isWebSocketConnected || isUploading"
            @click.stop
          >
            <Plus class="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          :side-offset="8"
          class="w-48 border border-white/[0.06] bg-background p-0 shadow-lg"
        >
          <DropdownMenuItem
            class="cursor-pointer text-white focus:bg-secondary"
            @click="$emit('trigger-photo-picker')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            Photo's
          </DropdownMenuItem>
          <DropdownMenuItem
            class="cursor-pointer text-white focus:bg-secondary"
            @click="$emit('trigger-video-picker')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            Video's
          </DropdownMenuItem>
          <DropdownMenuItem
            class="cursor-pointer text-white focus:bg-secondary"
            @click="$emit('open-album-modal')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            SDC Album
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        :disabled="!selectedChat || (!messageInput.trim() && uploadedMedia.length === 0) || !isWebSocketConnected || isUploading"
        @click="$emit('send-message')"
      >
        <span v-if="isUploading">Uploading...</span>
        <span v-else>Send</span>
      </Button>
    </div>
  </div>
</template>

