<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue';
import type { Album } from '@/lib/sdc-api-types';
import { loadAlbums } from '@/lib/sdc-api';
import { getCurrentDBId } from '@/lib/sdc-api/utils';

interface Props {
  visible: boolean;
  dbId?: string; // Optional, defaults to current user's db_id
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'close': [];
  'select': [albums: Album[]];
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
  const selected = albums.value.filter(album => selectedAlbums.value.has(album.id));
  if (selected.length > 0) {
    emit('select', selected);
    handleClose();
  }
}

function handleClose() {
  emit('close');
}

watch(() => props.visible, (newValue) => {
  if (newValue) {
    selectedAlbums.value.clear();
    albums.value = [];
    error.value = null;
    fetchAlbums();
  }
});

onMounted(() => {
  if (props.visible) {
    fetchAlbums();
  }
});
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    style="pointer-events: auto; z-index: 10000000; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
    @click.self="handleClose"
  >
    <div
      class="w-[90vw] max-w-md h-[80vh] bg-[#1a1a1a] rounded-lg shadow-2xl flex flex-col overflow-hidden"
      @click.stop
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[#333] shrink-0 flex items-center justify-between">
        <h2 class="text-white text-lg font-semibold">Select Albums</h2>
        <button
          @click="handleClose"
          class="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
          title="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] hover:text-white">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Loading State -->
        <div v-if="isLoading" class="flex items-center justify-center h-full">
          <div class="flex flex-col items-center gap-4">
            <div class="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-[#999]">Loading albums...</div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="text-red-500 text-lg font-semibold mb-2">{{ error }}</div>
            <button
              @click="fetchAlbums"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>

        <!-- Albums List -->
        <div v-else-if="albums.length > 0" class="space-y-2">
          <div
            v-for="album in albums"
            :key="album.id"
            @click="toggleAlbum(album.id)"
            :class="[
              'px-4 py-3 rounded-lg border cursor-pointer transition-colors',
              selectedAlbums.has(album.id)
                ? 'bg-blue-500/20 border-blue-500'
                : 'bg-[#0f0f0f] border-[#333] hover:bg-[#1a1a1a]'
            ]"
          >
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-5 h-5 border-2 rounded shrink-0" :class="selectedAlbums.has(album.id) ? 'border-blue-500 bg-blue-500' : 'border-[#666]'">
                <svg v-if="selectedAlbums.has(album.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-white font-medium truncate">{{ album.name }}</div>
                <div class="text-xs text-[#999] mt-1">
                  {{ album.counter_images }} {{ parseInt(album.counter_images) === 1 ? 'image' : 'images' }}
                  <span v-if="parseInt(album.counter_videos) > 0">
                    · {{ album.counter_videos }} {{ parseInt(album.counter_videos) === 1 ? 'video' : 'videos' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex items-center justify-center h-full">
          <div class="text-center text-[#999]">
            <p>No albums found</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-[#333] shrink-0 flex items-center justify-between">
        <div class="text-sm text-[#999]">
          {{ selectedAlbums.size }} {{ selectedAlbums.size === 1 ? 'album' : 'albums' }} selected
        </div>
        <div class="flex gap-3">
          <button
            @click="handleClose"
            class="px-4 py-2 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleSelect"
            :disabled="selectedAlbums.size === 0"
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  </div>
</template>


