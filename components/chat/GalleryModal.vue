<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue';
import type { GalleryPhoto } from '@/lib/sdc-api-types';
import { getGalleryPhotos } from '@/lib/sdc-api';
import { getGalleryPassword, setGalleryPassword, clearGalleryPassword } from '@/lib/storage';

interface Props {
  visible: boolean;
  galleryName: string;
  galleryId: string;
  dbId: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'close': [];
  'open-lightbox': [photos: string[], imageIndex: number];
  'open-video-lightbox': [videos: GalleryPhoto[], videoIndex: number];
}>();

const photos = ref<GalleryPhoto[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const showPasswordInput = ref(false);
const password = ref('');
const passwordError = ref<string | null>(null);
const isPasswordProtected = ref(false);
const failedThumbnails = ref<Set<string>>(new Set());


async function fetchPhotos(providedPassword?: string, isRetry: boolean = false) {
  if (!props.galleryId || !props.dbId) return;
  
  isLoading.value = true;
  error.value = null;
  passwordError.value = null;
  
  // Determine which password to use
<<<<<<< HEAD
=======
  // Priority: providedPassword > stored password
>>>>>>> 3555192 (chore: update package version to 1.1.6 and add profilev2.json)
  let passwordToUse: string | undefined;
  if (providedPassword !== undefined) {
    // Use provided password (from user input or retry)
    passwordToUse = providedPassword;
  } else if (!isRetry) {
    // Try to load stored password first
    const storedPassword = await getGalleryPassword(props.galleryId, String(props.dbId));
    if (storedPassword) {
      passwordToUse = storedPassword;
    }
  }
  
  try {
    const response = await getGalleryPhotos(props.galleryId, String(props.dbId), passwordToUse);
    
    if (response.info.code === 200) {
      // Success - save password if it was provided
      if (passwordToUse) {
        await setGalleryPassword(props.galleryId, String(props.dbId), passwordToUse);
      }
      photos.value = response.info.data || [];
      showPasswordInput.value = false;
      password.value = '';
    } else if (response.info.code === 403 && response.info.message === 'Invalid password') {
      // Invalid password - mark as password-protected and ask again
      isPasswordProtected.value = true;
      if (passwordToUse && !providedPassword) {
        // Stored password was invalid, clear it
        await clearGalleryPassword(props.galleryId, String(props.dbId));
      }
      showPasswordInput.value = true;
      if (providedPassword) {
        passwordError.value = 'Invalid password. Please try again.';
      }
      isLoading.value = false;
    } else {
      error.value = response.info.message || 'Failed to load gallery photos';
      showPasswordInput.value = false;
    }
  } catch (err) {
    console.error('[GalleryModal] Failed to fetch photos:', err);
    // Network error or other failure - if we had a password or know it's password-protected, ask again
    if (passwordToUse || isPasswordProtected.value) {
      // Clear stored password if we had one (it might have been invalid or network issue)
      if (passwordToUse) {
        await clearGalleryPassword(props.galleryId, String(props.dbId));
      }
      // If we had a stored password, it means the gallery is password-protected
      // Show password input to ask again
      isPasswordProtected.value = true;
      showPasswordInput.value = true;
    } else {
      // No password and not known to be password-protected - show generic error
      error.value = 'Failed to load gallery photos';
    }
  } finally {
    isLoading.value = false;
  }
}

function handlePasswordSubmit() {
  if (!password.value.trim()) {
    passwordError.value = 'Please enter a password';
    return;
  }
  
  passwordError.value = null;
  fetchPhotos(password.value);
}

function handlePasswordKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    handlePasswordSubmit();
  }
}

function handleClose() {
  emit('close');
}

function handleImageClick(index: number) {
  const photo = photos.value[index];
  
  // If it's a video, don't open lightbox
  if (photo.type === 'vt') {
    return;
  }
  
  // Filter out videos and get only photos for lightbox
  const photoItems = photos.value.filter(p => p.type !== 'vt');
  const imageUrls = photoItems.map(p => p.filename);
  
  // Find the index in the filtered array
  const photoIndex = photoItems.findIndex(p => p.id === photo.id);
  
  if (photoIndex >= 0) {
    emit('open-lightbox', imageUrls, photoIndex);
  }
}

function handleVideoClick(index: number) {
  const video = photos.value[index];
  if (!video || video.type !== 'vt') return;
  
  // Get all videos
  const videoItems = photos.value.filter(p => p.type === 'vt');
  const videoIndex = videoItems.findIndex(p => p.id === video.id);
  
  if (videoIndex >= 0) {
    emit('open-video-lightbox', videoItems, videoIndex);
  }
}

function handleThumbnailError(event: Event, photo: GalleryPhoto) {
  const img = event.target as HTMLImageElement;
  const src = img.src;
  
  // Mark this thumbnail as failed
  failedThumbnails.value.add(src);
  
  // Hide the broken image
  img.style.display = 'none';
  
  // Try alternative thumbnail URL if available
  if (src.includes('_thumbnail.0000001.png') && photo.thumbnail) {
    const altSrc = photo.thumbnail.replace('_thumbnail.0000001.png', '_thumbnail.png');
    if (!failedThumbnails.value.has(altSrc)) {
      img.src = altSrc;
      img.style.display = 'block';
    }
  }
}

watch(() => props.visible, async (newValue) => {
  if (newValue) {
    // Reset state when opening
    showPasswordInput.value = false;
    password.value = '';
    passwordError.value = null;
    error.value = null;
    photos.value = [];
    isPasswordProtected.value = false;
<<<<<<< HEAD
    // Try to fetch with stored password first
=======
    // Try to fetch with stored password or no password
>>>>>>> 3555192 (chore: update package version to 1.1.6 and add profilev2.json)
    await fetchPhotos();
  }
});

onMounted(() => {
  if (props.visible) {
    fetchPhotos();
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
      class="w-[90vw] h-[90vh] bg-[#1a1a1a] rounded-lg shadow-2xl flex flex-col overflow-hidden"
      @click.stop
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[#333] shrink-0 flex items-center justify-between">
        <h2 class="text-white text-lg font-semibold">{{ galleryName }}</h2>
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
        <!-- Password Input State -->
        <div v-if="showPasswordInput" class="flex flex-col items-center justify-center h-full gap-4">
          <h3 class="text-white text-lg font-semibold">This gallery is password protected</h3>
          <div class="flex flex-col items-center gap-3 w-full max-w-sm">
            <input
              v-model="password"
              @keydown="handlePasswordKeydown"
              type="password"
              placeholder="Enter password"
              class="w-full px-4 py-2 bg-[#0f0f0f] border border-[#333] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-blue-500 transition-colors text-center"
              autofocus
            />
            <p v-if="passwordError" class="text-red-500 text-sm">{{ passwordError }}</p>
            <div class="flex gap-3 w-full">
              <button
                @click="handlePasswordSubmit"
                class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Submit
              </button>
              <button
                @click="handleClose"
                class="px-4 py-2 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#333] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-else-if="isLoading" class="flex items-center justify-center h-full">
          <div class="flex flex-col items-center gap-4">
            <div class="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-[#999]">Loading gallery...</div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="text-red-500 text-lg font-semibold mb-2">{{ error }}</div>
            <button
              @click="fetchPhotos(undefined, true)"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>

        <!-- Gallery Grid -->
        <div v-else-if="photos.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <!-- Photo Items -->
          <div
            v-for="(photo, index) in photos"
            :key="photo.id"
            @click="photo.type === 'vt' ? handleVideoClick(index) : handleImageClick(index)"
            class="relative aspect-square bg-[#0f0f0f] rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
          >
            <!-- Video Thumbnail -->
            <template v-if="photo.type === 'vt'">
              <img
                v-if="photo.thumbnail"
                :src="photo.thumbnail"
                :alt="photo.photoname || 'Video thumbnail'"
                class="w-full h-full object-contain"
                crossorigin="use-credentials"
                @error="(e) => handleThumbnailError(e, photo)"
                @load="(e) => { (e.target as HTMLImageElement).style.display = 'block'; }"
              />
              <div v-else class="w-full h-full flex items-center justify-center bg-[#0f0f0f]">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#666]">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </div>
              
              <!-- Fallback for failed thumbnails -->
              <div
                v-if="photo.thumbnail && failedThumbnails.has(photo.thumbnail)"
                class="absolute inset-0 flex flex-col items-center justify-center bg-[#0f0f0f] text-[#666]"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-1">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span class="text-xs">Video</span>
              </div>
              
              <!-- Play Icon Overlay -->
              <div 
                v-if="!photo.thumbnail || !failedThumbnails.has(photo.thumbnail)"
                class="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors"
              >
                <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </div>
              </div>
              
              <!-- Fullscreen Button -->
              <button
                @click.stop="handleVideoClick(index)"
                class="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                title="Open video lightbox"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
              </button>
            </template>
            
            <!-- Photo Items -->
            <template v-else>
              <img
                :src="photo.filename"
                :alt="photo.photoname"
                class="w-full h-full object-cover"
                @error="(e) => { (e.target as HTMLImageElement).style.display = 'none'; }"
              />
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
            </template>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex items-center justify-center h-full">
          <div class="text-center text-[#999]">
            <p>No photos in this gallery</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

