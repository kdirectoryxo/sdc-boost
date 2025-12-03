<script lang="ts" setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue';
import Hls from 'hls.js';
import type { GalleryPhoto } from '@/lib/sdc-api-types';

interface Props {
  visible: boolean;
  videos: GalleryPhoto[];
  initialIndex: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'close': [];
}>();

const currentIndex = ref(props.initialIndex);
const videoPlayerRef = ref<HTMLVideoElement | null>(null);
const hlsInstance = ref<Hls | null>(null);

const currentVideo = computed(() => props.videos[currentIndex.value]);
const currentVideoUrl = computed(() => currentVideo.value?.filename || null);

function isHLS(url: string): boolean {
  return url.includes('.m3u8');
}

function canPlayHLS(): boolean {
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

async function loadVideo() {
  if (!videoPlayerRef.value || !currentVideoUrl.value) return;
  
  const video = videoPlayerRef.value;
  const url = currentVideoUrl.value;
  
  // Clean up any existing HLS instance
  if (hlsInstance.value) {
    hlsInstance.value.destroy();
    hlsInstance.value = null;
  }
  
  // Pause and reset video
  video.pause();
  video.currentTime = 0;
  video.src = '';
  
  // Check if it's an HLS stream
  if (isHLS(url)) {
    // Check if browser supports HLS natively (Safari)
    if (canPlayHLS()) {
      // Use native HLS support
      video.src = url;
    } else if (Hls.isSupported()) {
      // Use hls.js for browsers that don't support HLS natively
      const hls = new Hls({
        xhrSetup: (xhr, url) => {
          xhr.withCredentials = true; // Include credentials for authenticated requests
        },
      });
      
      hls.loadSource(url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Video is ready to play
        video.play().catch(err => {
          console.error('[VideoLightbox] Failed to autoplay video:', err);
        });
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('[VideoLightbox] HLS error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[VideoLightbox] Fatal network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[VideoLightbox] Fatal media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('[VideoLightbox] Fatal error, cannot recover');
              hls.destroy();
              break;
          }
        }
      });
      
      hlsInstance.value = hls;
    } else {
      console.error('[VideoLightbox] HLS is not supported in this browser');
    }
  } else {
    // Regular video file (mp4, webm, etc.)
    video.src = url;
  }
}

function goToNext() {
  if (currentIndex.value < props.videos.length - 1) {
    currentIndex.value++;
  }
}

function goToPrevious() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
}

function goToVideo(index: number) {
  if (index >= 0 && index < props.videos.length) {
    currentIndex.value = index;
  }
}

function handleClose() {
  emit('close');
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.visible) return;
  
  switch (event.key) {
    case 'Escape':
      handleClose();
      break;
    case 'ArrowLeft':
      event.preventDefault();
      goToPrevious();
      break;
    case 'ArrowRight':
      event.preventDefault();
      goToNext();
      break;
  }
}

// Watch for video URL changes and load the video
watch([currentVideoUrl, () => props.visible], async ([newUrl, visible]) => {
  if (newUrl && visible) {
    await nextTick();
    await loadVideo();
  }
}, { immediate: false });

// Watch for visibility changes
watch(() => props.visible, (visible) => {
  if (!visible) {
    // Clean up when closing
    if (hlsInstance.value) {
      hlsInstance.value.destroy();
      hlsInstance.value = null;
    }
    if (videoPlayerRef.value) {
      videoPlayerRef.value.pause();
      videoPlayerRef.value.currentTime = 0;
      videoPlayerRef.value.src = '';
    }
  } else {
    // Reset to initial index when opening
    currentIndex.value = props.initialIndex;
  }
});

// Watch for initial index changes
watch(() => props.initialIndex, (newIndex) => {
  if (props.visible) {
    currentIndex.value = newIndex;
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  // Clean up HLS instance on component unmount
  if (hlsInstance.value) {
    hlsInstance.value.destroy();
    hlsInstance.value = null;
  }
});
</script>

<template>
  <div
    v-if="visible && videos.length > 0"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    style="pointer-events: auto; z-index: 10000002; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.95); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
    @click.self="handleClose"
  >
    <div class="relative w-full h-full flex flex-col items-center justify-center" @click.stop>
      <!-- Close Button -->
      <button
        @click="handleClose"
        class="absolute top-4 right-4 p-3 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm transition-colors z-20"
        title="Close (Esc)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      
      <!-- Previous Button -->
      <button
        v-if="currentIndex > 0"
        @click="goToPrevious"
        class="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm transition-colors z-20"
        title="Previous (←)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      
      <!-- Next Button -->
      <button
        v-if="currentIndex < videos.length - 1"
        @click="goToNext"
        class="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm transition-colors z-20"
        title="Next (→)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
      
      <!-- Main Video Player -->
      <div class="flex-1 flex items-center justify-center w-full px-4 pb-32">
        <video
          ref="videoPlayerRef"
          controls
          crossorigin="use-credentials"
          preload="metadata"
          class="w-full h-full max-w-full max-h-full object-contain"
          @click.stop
          @error="(e) => console.error('[VideoLightbox] Video load error:', currentVideoUrl, e)"
        >
          Your browser does not support the video tag.
        </video>
      </div>
      
      <!-- Video Thumbnail Strip -->
      <div class="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4 z-20">
        <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div
            v-for="(video, index) in videos"
            :key="video.id"
            @click="goToVideo(index)"
            :class="[
              'relative shrink-0 w-24 h-24 rounded-lg overflow-hidden cursor-pointer border-2 transition-all',
              currentIndex === index
                ? 'border-blue-500 scale-105'
                : 'border-transparent hover:border-white/50 opacity-70 hover:opacity-100'
            ]"
          >
            <img
              v-if="video.thumbnail"
              :src="video.thumbnail"
              :alt="`Video ${index + 1}`"
              class="w-full h-full object-cover"
              @error="(e) => { (e.target as HTMLImageElement).style.display = 'none'; }"
            />
            <div v-else class="w-full h-full flex items-center justify-center bg-[#0f0f0f]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#666]">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
            
            <!-- Play Icon Overlay -->
            <div class="absolute inset-0 flex items-center justify-center bg-black/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
            
            <!-- Current Video Indicator -->
            <div
              v-if="currentIndex === index"
              class="absolute top-1 right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"
            ></div>
          </div>
        </div>
        
        <!-- Video Counter -->
        <div class="text-center text-white/70 text-sm mt-2">
          {{ currentIndex + 1 }} / {{ videos.length }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar styles */
.scrollbar-thin::-webkit-scrollbar {
  height: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.7);
}
</style>

