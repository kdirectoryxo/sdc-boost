<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue';
import { X } from 'lucide-vue-next';
import type { Album } from '@/lib/sdc-api-types';
import { loadAlbums } from '@/lib/sdc-api';
import { getCurrentDBId } from '@/lib/sdc-api/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/lib/view-router/ui/dialog';
import { Button } from '@/lib/view-router/ui/button';
import { ScrollArea } from '@/lib/view-router/ui/scroll-area';
import { Spinner } from '@/lib/view-router/ui/spinner';
import { cn } from '@/lib/utils';
import {
  CHAT_NESTED_DIALOG_OVERLAY_CLASS,
  CHAT_NESTED_DIALOG_CONTENT_CLASS,
} from '@/lib/chat-ui/nested-dialog-classes';

interface Props {
  visible: boolean;
  dbId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  select: [albums: Album[]];
}>();

const albums = ref<Album[]>([]);
const selectedAlbums = ref<Set<string>>(new Set());
const isLoading = ref(false);
const error = ref<string | null>(null);

async function fetchAlbums() {
  const dbId = props.dbId || getCurrentDBId();
  if (!dbId) {
    error.value = 'Cannot load albums - user ID not found';
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    const response = await loadAlbums(dbId);
    if (response.info.code === 200) {
      albums.value = response.info.albums || [];
    } else {
      error.value = response.info.message || 'Failed to load albums';
    }
  } catch (err) {
    console.error('[AlbumSelectionModal] Failed to fetch albums:', err);
    error.value = 'Failed to load albums';
  } finally {
    isLoading.value = false;
  }
}

function toggleAlbum(albumId: string) {
  if (selectedAlbums.value.has(albumId)) {
    selectedAlbums.value.delete(albumId);
  } else {
    selectedAlbums.value.add(albumId);
  }
}

function handleSelect() {
  const selected = albums.value.filter((album) => selectedAlbums.value.has(album.id));
  if (selected.length > 0) {
    emit('select', selected);
    handleClose();
  }
}

function handleClose() {
  emit('close');
}

function onOpenChange(open: boolean) {
  if (!open) {
    handleClose();
  }
}

watch(
  () => props.visible,
  (newValue) => {
    if (newValue) {
      selectedAlbums.value.clear();
      albums.value = [];
      error.value = null;
      fetchAlbums();
    }
  },
);

onMounted(() => {
  if (props.visible) {
    fetchAlbums();
  }
});
</script>

<template>
  <Dialog :open="visible" @update:open="onOpenChange">
    <DialogContent
      :show-close-button="false"
      :overlay-class="CHAT_NESTED_DIALOG_OVERLAY_CLASS"
      :class="
        cn(
          CHAT_NESTED_DIALOG_CONTENT_CLASS,
          '!flex !h-[80vh] !max-h-[80vh] !w-[90vw] !max-w-md flex-col overflow-hidden rounded-lg border border-white/[0.06] bg-background p-0 shadow-2xl',
        )
      "
    >
      <DialogHeader class="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-white/[0.06] px-6 py-4 text-left">
        <DialogTitle class="text-lg font-semibold text-white">Select Albums</DialogTitle>
        <Button variant="ghost" size="icon" title="Close" @click="handleClose">
          <X class="size-5 text-muted-foreground" />
        </Button>
      </DialogHeader>

      <ScrollArea class="min-h-0 flex-1">
        <div class="p-6">
          <div v-if="isLoading" class="flex min-h-[200px] items-center justify-center">
            <div class="flex flex-col items-center gap-4">
              <Spinner class="!size-12 text-blue-500" />
              <div class="text-muted-foreground">Loading albums...</div>
            </div>
          </div>

          <div v-else-if="error" class="flex min-h-[200px] flex-col items-center justify-center text-center">
            <div class="mb-2 text-lg font-semibold text-red-500">{{ error }}</div>
            <Button @click="fetchAlbums">Retry</Button>
          </div>

          <div v-else-if="albums.length > 0" class="space-y-2">
            <div
              v-for="album in albums"
              :key="album.id"
              :class="[
                'cursor-pointer rounded-lg border px-4 py-3 transition-colors',
                selectedAlbums.has(album.id)
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-white/[0.06] bg-sidebar hover:bg-background',
              ]"
              @click="toggleAlbum(album.id)"
            >
              <div class="flex items-center gap-3">
                <div
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2"
                  :class="selectedAlbums.has(album.id) ? 'border-blue-500 bg-blue-500' : 'border-white/[0.14]'"
                >
                  <svg
                    v-if="selectedAlbums.has(album.id)"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-white"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="truncate font-medium text-white">{{ album.name }}</div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    {{ album.counter_images }} {{ parseInt(album.counter_images) === 1 ? 'image' : 'images' }}
                    <span v-if="parseInt(album.counter_videos) > 0">
                      · {{ album.counter_videos }}
                      {{ parseInt(album.counter_videos) === 1 ? 'video' : 'videos' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="flex min-h-[200px] items-center justify-center text-muted-foreground">
            <p>No albums found</p>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="shrink-0 flex-row items-center justify-between border-t border-white/[0.06] px-6 py-4 sm:justify-between">
        <div class="text-sm text-muted-foreground">
          {{ selectedAlbums.size }} {{ selectedAlbums.size === 1 ? 'album' : 'albums' }} selected
        </div>
        <div class="flex gap-3">
          <Button variant="secondary" @click="handleClose">Cancel</Button>
          <Button :disabled="selectedAlbums.size === 0" @click="handleSelect">Select</Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
