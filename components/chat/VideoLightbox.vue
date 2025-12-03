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

// Playback state
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const isDragging = ref(false);
const isFullscreen = ref(false);

function isHLS(url: string): boolean {
  return url.includes('.m3u8');
}

function canPlayHLS(): boolean {
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

function setupVideoListeners() {
  if (!videoPlayerRef.value) return;
  
  const video = videoPlayerRef.value;
  
  // Update current time
  const updateTime = () => {
    if (!isDragging.value) {
      currentTime.value = video.currentTime;
    }
  };
  
  // Update duration when metadata loads
  const updateDuration = () => {
    duration.value = video.duration || 0;
  };
  
  // Track play/pause state
  video.addEventListener('play', () => {
    isPlaying.value = true;
  });
  
  video.addEventListener('pause', () => {
    isPlaying.value = false;
  });
  
  video.addEventListener('timeupdate', updateTime);
  video.addEventListener('loadedmetadata', updateDuration);
  video.addEventListener('durationchange', updateDuration);
  
  // Cleanup function (will be called when video changes)
  return () => {
    video.removeEventListener('play', () => {});
    video.removeEventListener('pause', () => {});
    video.removeEventListener('timeupdate', updateTime);
    video.removeEventListener('loadedmetadata', updateDuration);
    video.removeEventListener('durationchange', updateDuration);
  };
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
  currentTime.value = 0;
  duration.value = 0;
  isPlaying.value = false;
  
  // Setup video event listeners
  setupVideoListeners();
  
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

function togglePlayPause() {
  if (!videoPlayerRef.value) return;
  
  if (isPlaying.value) {
    videoPlayerRef.value.pause();
  } else {
    videoPlayerRef.value.play();
  }
}

function stopVideo() {
  if (!videoPlayerRef.value) return;
  
  videoPlayerRef.value.pause();
  videoPlayerRef.value.currentTime = 0;
  isPlaying.value = false;
  currentTime.value = 0;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function handleSeek(event: Event) {
  if (!videoPlayerRef.value || !duration.value) return;
  
  const target = event.target as HTMLInputElement;
  const newTime = (parseFloat(target.value) / 100) * duration.value;
  
  videoPlayerRef.value.currentTime = newTime;
  currentTime.value = newTime;
}

function handleSeekStart() {
  isDragging.value = true;
}

function handleSeekEnd() {
  isDragging.value = false;
}

const thumbnailErrors = ref<Set<string>>(new Set());

function handleThumbnailError(event: Event) {
  const img = event.target as HTMLImageElement;
  const src = img.src;
  
  // Mark this thumbnail as failed
  thumbnailErrors.value.add(src);
  
  // Hide the broken image
  img.style.display = 'none';
  
  // Try to load a fallback - use the video filename to construct a potential thumbnail URL
  // Some videos might have different thumbnail naming conventions
  if (src.includes('_thumbnail.0000001.png')) {
    // Try alternative thumbnail path
    const altSrc = src.replace('_thumbnail.0000001.png', '_thumbnail.png');
    if (!thumbnailErrors.value.has(altSrc)) {
      img.src = altSrc;
      img.style.display = 'block';
    }
  }
}

function handleThumbnailLoad(event: Event) {
  const img = event.target as HTMLImageElement;
  img.style.display = 'block';
}

async function enterFullscreen() {
  if (!videoPlayerRef.value) return;
  
  try {
    const video = videoPlayerRef.value;
    if (video.requestFullscreen) {
      await video.requestFullscreen();
    } else if ((video as any).webkitRequestFullscreen) {
      await (video as any).webkitRequestFullscreen();
    } else if ((video as any).mozRequestFullScreen) {
      await (video as any).mozRequestFullScreen();
    } else if ((video as any).msRequestFullscreen) {
      await (video as any).msRequestFullscreen();
    }
  } catch (err) {
    console.error('[VideoLightbox] Failed to enter fullscreen:', err);
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}

function handleClose() {
  emit('close');
}

async function downloadVideo() {
  if (!currentVideoUrl.value || !currentVideo.value) return;
  
  const url = currentVideoUrl.value;
  const videoName = currentVideo.value.photoname || `video-${currentIndex.value + 1}`;
  
  // For HLS streams, downloading is complex - we'll download the manifest file
  // For regular videos, we can download directly
  if (isHLS(url)) {
    // For HLS, we can download the manifest file
    // Note: This downloads the .m3u8 file, not the actual video segments
    try {
      const response = await fetch(url, {
        credentials: 'include', // Include cookies for authenticated requests
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch video');
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${videoName}.m3u8`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('[VideoLightbox] Failed to download video:', error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  } else {
    // For regular video files, download directly
    try {
      const response = await fetch(url, {
        credentials: 'include', // Include cookies for authenticated requests
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch video');
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      
      // Determine file extension from URL or use default
      const urlPath = new URL(url).pathname;
      const extension = urlPath.match(/\.([^.]+)$/)?.[1] || 'mp4';
      a.download = `${videoName}.${extension}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('[VideoLightbox] Failed to download video:', error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.visible) return;
  
  switch (event.key) {
    case 'Escape':
      handleClose();
      break;
    case 'ArrowLeft':
      event.preventDefault();
      if (event.shiftKey && videoPlayerRef.value) {
        // Shift + Left: Seek backward 10 seconds
        videoPlayerRef.value.currentTime = Math.max(0, videoPlayerRef.value.currentTime - 10);
      } else {
        goToPrevious();
      }
      break;
    case 'ArrowRight':
      event.preventDefault();
      if (event.shiftKey && videoPlayerRef.value) {
        // Shift + Right: Seek forward 10 seconds
        if (videoPlayerRef.value.duration) {
          videoPlayerRef.value.currentTime = Math.min(videoPlayerRef.value.duration, videoPlayerRef.value.currentTime + 10);
        }
      } else {
        goToNext();
      }
      break;
    case ' ':
      event.preventDefault();
      togglePlayPause();
      break;
    case 'f':
    case 'F':
      event.preventDefault();
      enterFullscreen();
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
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
  document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
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
    <div class="relative w-full h-full flex flex-col" @click.stop>
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
      
      <!-- Download Button -->
      <button
        @click="downloadVideo"
        class="absolute top-4 right-20 p-3 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm transition-colors z-20"
        title="Download video"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
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
      <div 
        :class="[
          'flex-1 flex items-center justify-center w-full min-h-0 overflow-hidden',
          isFullscreen ? 'px-0 pb-0' : 'px-1 sm:px-2 md:px-4 pb-32 sm:pb-40'
        ]"
      >
        <video
          ref="videoPlayerRef"
          crossorigin="use-credentials"
          preload="metadata"
          :class="[
            'w-full h-full max-w-full object-contain',
            isFullscreen ? 'max-h-screen' : 'max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-280px)]'
          ]"
          style="min-width: 0; min-height: 0; width: 100%; height: 100%;"
          @click.stop="togglePlayPause"
          @error="(e) => console.error('[VideoLightbox] Video load error:', currentVideoUrl, e)"
        >
          Your browser does not support the video tag.
        </video>
      </div>
      
      <!-- Custom Controls - Positioned absolutely above thumbnail strip -->
      <div 
        v-if="!isFullscreen"
        class="absolute bottom-32 sm:bottom-40 left-0 right-0 px-2 sm:px-4 z-20"
      >
        <div class="w-full max-w-4xl mx-auto bg-black/60 backdrop-blur-sm rounded-lg p-2 sm:p-4" @click.stop>
          <!-- Timeline/Scrubber -->
          <div class="mb-3">
            <input
              type="range"
              min="0"
              max="100"
              :value="duration > 0 ? (currentTime / duration) * 100 : 0"
              @input="handleSeek"
              @mousedown="handleSeekStart"
              @mouseup="handleSeekEnd"
              @touchstart="handleSeekStart"
              @touchend="handleSeekEnd"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              :style="{ background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #4b5563 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #4b5563 100%)` }"
            />
          </div>
          
          <!-- Controls Row -->
          <div class="flex items-center justify-between">
            <!-- Left: Playback Controls -->
            <div class="flex items-center gap-3">
              <!-- Play/Pause Button -->
              <button
                @click="togglePlayPause"
                class="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Play/Pause (Space)"
              >
                <svg v-if="!isPlaying" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              </button>
              
              <!-- Stop Button -->
              <button
                @click="stopVideo"
                class="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Stop"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="text-white">
                  <rect x="6" y="6" width="12" height="12"></rect>
                </svg>
              </button>
              
              <!-- Time Display -->
              <div class="text-white text-sm font-mono min-w-[100px]">
                {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
              </div>
            </div>
            
            <!-- Right: Fullscreen and other controls -->
            <div class="flex items-center gap-2">
              <!-- Fullscreen Button -->
              <button
                @click="enterFullscreen"
                class="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Enter fullscreen (F)"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Video Thumbnail Strip -->
      <div 
        v-if="!isFullscreen"
        class="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-2 sm:p-4 z-20"
      >
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
              crossorigin="use-credentials"
              @error="handleThumbnailError"
              @load="handleThumbnailLoad"
            />
            <div v-else class="w-full h-full flex items-center justify-center bg-[#0f0f0f]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#666]">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
            
            <!-- Play Icon Overlay -->
            <div 
              v-if="!thumbnailErrors.has(video.thumbnail || '') || !video.thumbnail"
              class="absolute inset-0 flex items-center justify-center bg-black/30"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
            
            <!-- Fallback for failed thumbnails -->
            <div
              v-if="video.thumbnail && thumbnailErrors.has(video.thumbnail)"
              class="absolute inset-0 flex flex-col items-center justify-center bg-[#0f0f0f] text-[#666]"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-1">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span class="text-xs">Video {{ index + 1 }}</span>
            </div>
            
            <!-- Current Video Indicator -->
            <div
              v-if="currentIndex === index"
              class="absolute top-1 right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white z-10"
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

/* Custom range slider styles */
.slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.slider:active::-webkit-slider-thumb {
  transform: scale(1.2);
}

.slider:active::-moz-range-thumb {
  transform: scale(1.2);
}
</style>

