<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import type { ProfileUser, PhotoAlbum, GalleryPhoto, ValidationV2User } from '@/lib/sdc-api-types';
import GalleryModal from '@/components/chat/GalleryModal.vue';
import VueEasyLightbox from 'vue-easy-lightbox';
import 'vue-easy-lightbox/dist/external-css/vue-easy-lightbox.css';
import VideoLightbox from '@/components/chat/VideoLightbox.vue';
import { profileStorage } from '@/lib/profile-storage';
import { getProfileV2, getValidationsV2 } from '@/lib/sdc-api/profile';
import { startChat } from '@/lib/sdc-api/messenger';
import { chatStorage } from '@/lib/chat-storage';
import type { MessengerChatItem } from '@/lib/sdc-api-types';

interface Props {
  visible: boolean;
  userId: number | null;
  stackLevel?: number;
  dialogId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  stackLevel: 0,
  dialogId: '',
});

const emit = defineEmits<{
  close: [];
  'open-profile': [userId: number];
}>();

const activeTab = ref<string>('profile');
const profileData = ref<ProfileUser | null>(null);
const isLoading = ref(false);
const isRefreshingImages = ref(false);
const isRefreshingDueToError = ref(false);
const error = ref<string | null>(null);
const imageErrors = ref<Set<string>>(new Set());

// Validations state
const allValidations = ref<ValidationV2User[]>([]);
const isLoadingValidations = ref(false);
const validationsError = ref<string | null>(null);
const validationsLoaded = ref(false);

// Gallery modal state
const galleryModalVisible = ref<boolean>(false);
const galleryName = ref<string>('');
const galleryId = ref<string>('');
const galleryDbId = ref<number>(0);
const initialPassword = ref<string | undefined>(undefined);

// Lightbox state
const lightboxVisible = ref<boolean>(false);
const lightboxImages = ref<string[]>([]);
const lightboxIndex = ref<number>(0);

// Video lightbox state
const videoLightboxVisible = ref<boolean>(false);
const videoLightboxVideos = ref<GalleryPhoto[]>([]);
const videoLightboxIndex = ref<number>(0);

const baseTabs = [
  { id: 'profile', label: 'Profile' },
  { id: 'images', label: 'Images' },
  { id: 'albums', label: 'Albums' },
  { id: 'validaties', label: 'Validaties' },
  { id: 'groepen', label: 'Groepen' },
  { id: 'speeddate', label: 'Speed Date' },
  { id: 'parties', label: 'Party & Events' },
  { id: 'following', label: 'Following' },
  { id: 'friends', label: 'Friends' },
];

// Computed tabs with counts
const tabs = computed(() => {
  if (!profileData.value) return baseTabs;
  
  const getCount = (tabId: string): number | null => {
    switch (tabId) {
      case 'images':
        const imageCount = (profileData.value?.vanilla_photo_counter || 0) + 
                          (profileData.value?.no_vanilla_photo_counter || 0) + 
                          (profileData.value?.video_counter || 0);
        return imageCount > 0 ? imageCount : null;
      case 'albums':
        return profileData.value?.photoalbum_list?.length || null;
      case 'validaties':
        // Use total validations count if available, otherwise fall back to my_validations length
        return profileData.value?.validations || profileData.value?.my_validations?.length || null;
      case 'groepen':
        return profileData.value?.communities?.length || null;
      case 'speeddate':
        return profileData.value?.speeddating_active ? 1 : null;
      case 'parties':
        return profileData.value?.party_plans_up?.length || null;
      case 'following':
        return profileData.value?.following?.length || null;
      case 'friends':
        return profileData.value?.friends?.length || profileData.value?.friend_counter || null;
      default:
        return null;
    }
  };
  
  return baseTabs.map(tab => {
    const count = getCount(tab.id);
    return {
      ...tab,
      label: count !== null ? `${tab.label} (${count})` : tab.label,
      count
    };
  });
});

// Fetch profile data when dialog opens
watch([() => props.visible, () => props.userId], async ([visible, userId], [prevVisible, prevUserId]) => {
  if (visible && userId) {
    // Reset validations state if userId changed
    if (prevUserId !== undefined && prevUserId !== userId) {
      allValidations.value = [];
      validationsLoaded.value = false;
      validationsError.value = null;
    }
    await fetchProfile(userId);
  } else if (!visible) {
    // Reset state when closing
    profileData.value = null;
    error.value = null;
    activeTab.value = 'profile';
    imageErrors.value.clear();
    isRefreshingImages.value = false;
    isRefreshingDueToError.value = false;
    // Reset validations state
    allValidations.value = [];
    validationsLoaded.value = false;
    validationsError.value = null;
  }
}, { immediate: true });

// Watch for validations tab activation to fetch all validations on demand
watch(activeTab, async (newTab) => {
  if (newTab === 'validaties' && profileData.value?.db_id && !validationsLoaded.value) {
    await fetchAllValidations(profileData.value.db_id);
  }
});

async function fetchProfile(userId: number) {
  isLoading.value = true;
  error.value = null;
  
  try {
    // First, load cached profile from database for instant display
    let cachedProfile = await profileStorage.getProfile(userId);
    
    if (cachedProfile) {
      // Use cached data immediately
      profileData.value = cachedProfile;
      isLoading.value = false;
      
      // Then refresh image URLs in the background (they may have expired)
      // Pass false to indicate this is not due to an error, so no spinner
      refreshProfileImages(userId, false);
    } else {
      // No cached data available - try to sync it automatically
      console.log(`[ProfileDialog] Profile ${userId} not synced, attempting auto-sync...`);
      
      try {
        // Fetch profile directly from API and save it
        const response = await getProfileV2(userId.toString());
        const freshProfile = response.info.profile_user;
        
        // Ensure db_id is set
        if (!freshProfile.db_id) {
          freshProfile.db_id = userId;
        }
        
        // Save to database
        await profileStorage.upsertProfile(freshProfile);
        
        // Use the fresh profile data
        profileData.value = freshProfile;
        isLoading.value = false;
        
        console.log(`[ProfileDialog] Auto-synced profile ${userId} successfully`);
      } catch (syncErr) {
        console.error(`[ProfileDialog] Failed to auto-sync profile ${userId}:`, syncErr);
        
        // Check if profile was saved despite error (race condition)
        cachedProfile = await profileStorage.getProfile(userId);
        if (cachedProfile) {
          profileData.value = cachedProfile;
          isLoading.value = false;
        } else {
          profileData.value = null;
          error.value = 'Profile data not synced. Please sync profile data via the sync dialog.';
          isLoading.value = false;
        }
      }
    }
  } catch (err) {
    console.error('[ProfileDialog] Failed to get cached profile:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load profile';
    isLoading.value = false;
  }
}

let refreshPromise: Promise<void> | null = null;

async function refreshProfileImages(userId: number, dueToError: boolean = false) {
  // Skip if already refreshing
  if (isRefreshingImages.value || refreshPromise) {
    return;
  }
  
  isRefreshingImages.value = true;
  isRefreshingDueToError.value = dueToError;
  
  refreshPromise = (async () => {
    try {
      // Fetch fresh profile data from API to get updated image URLs
      const response = await getProfileV2(userId.toString());
      const freshProfile = response.info.profile_user;
      
      // Only update if dialog is still open and showing the same user
      if (props.visible && props.userId === userId) {
        // Update the displayed profile data with fresh image URLs
        profileData.value = freshProfile;
        
        // Also update the database with fresh data
        await profileStorage.upsertProfile(freshProfile);
        
        // Clear image errors since we have fresh URLs
        imageErrors.value.clear();
        
        console.log('[ProfileDialog] Refreshed profile images for user', userId);
      }
    } catch (err) {
      console.error('[ProfileDialog] Failed to refresh profile images:', err);
      // Don't show error to user - cached images will still be displayed
      // The error is logged for debugging
    } finally {
      isRefreshingImages.value = false;
      isRefreshingDueToError.value = false;
      refreshPromise = null;
    }
  })();
  
  await refreshPromise;
}

async function fetchAllValidations(userId: number) {
  if (isLoadingValidations.value) return;
  
  isLoadingValidations.value = true;
  validationsError.value = null;
  
  try {
    // Fetch all validations from validations_v2 endpoint
    const response = await getValidationsV2(userId.toString());
    
    // Only update if dialog is still open and showing the same user
    if (props.visible && props.userId === userId) {
      allValidations.value = response.info.users || [];
      validationsLoaded.value = true;
      console.log('[ProfileDialog] Loaded all validations for user', userId, 'count:', allValidations.value.length);
    }
  } catch (err) {
    console.error('[ProfileDialog] Failed to fetch all validations:', err);
    validationsError.value = err instanceof Error ? err.message : 'Failed to load validations';
  } finally {
    isLoadingValidations.value = false;
  }
}

function handleClose() {
  emit('close');
}

function getPhotoUrl(photo: string | undefined): string {
  if (!photo) return '';
  if (photo.startsWith('http')) return photo;
  return `https://pictures.sdc.com/photos/${photo}`;
}

function handleImageError(event: Event, photoUrl: string) {
  const img = event.target as HTMLImageElement;
  imageErrors.value.add(photoUrl);
  
  // If image failed and we're not already refreshing, trigger a refresh
  if (!isRefreshingImages.value && profileData.value?.db_id) {
    console.log('[ProfileDialog] Image load failed, refreshing profile images:', photoUrl);
    refreshProfileImages(profileData.value.db_id, true); // true = refreshing due to error
  }
  
  // Show placeholder or hide image
  img.style.display = 'none';
}

function handleImageLoad(event: Event, photoUrl: string) {
  // Remove from error set if it loads successfully
  imageErrors.value.delete(photoUrl);
}

function getCommunityPhotoUrl(picture: string | undefined): string {
  if (!picture) return '';
  if (picture.startsWith('http')) return picture;
  // Community pictures use /group/logo/ path
  return `https://pictures.sdc.com/group/logo/${picture}`;
}

function formatLocation(location: string | undefined, distance: number | undefined): string {
  if (!location) return '';
  if (distance !== undefined && distance !== null) {
    return `${location} | ${distance} km`;
  }
  return location;
}

// Helper to split pipe-separated values
function splitValue(value: string | undefined): string[] {
  if (!value) return ['-', '-'];
  return value.split('|').map(v => v.trim() || '-');
}

// Helper to validate if an age is valid (between 18-100)
function isValidAge(ageStr: string): boolean {
  const age = parseInt(ageStr, 10);
  return !isNaN(age) && age >= 18 && age <= 100;
}

// Helper to split age string (for friends/validations that only have age string)
function splitAge(age: string | undefined): string[] {
  if (!age) return ['-', '-'];
  return age.split('|').map(v => {
    const trimmed = v.trim();
    if (!trimmed) return '-';
    return isValidAge(trimmed) ? trimmed : '-';
  });
}

// Helper to get age color based on gender (1 = female = pink, 0 = male = blue)
function getAgeColorClass(gender: number | undefined): string {
  return gender === 1 ? 'text-pink-300' : 'text-blue-300';
}

// Helper to get gender label (1 = female = Her, 0 = male = Him)
function getGenderLabel(gender: number | undefined): string {
  return gender === 1 ? 'Her' : 'Him';
}

// Helper to combine hair color and length
function combineHair(hairColor: string | undefined, hairLength: string | undefined): string[] {
  const colors = splitValue(hairColor);
  const lengths = splitValue(hairLength);
  
  return [
    colors[0] !== '-' && lengths[0] !== '-' 
      ? `${colors[0]} | ${lengths[0]}` 
      : colors[0] !== '-' ? colors[0] : lengths[0] !== '-' ? lengths[0] : '-',
    colors[1] !== '-' && lengths[1] !== '-' 
      ? `${colors[1]} | ${lengths[1]}` 
      : colors[1] !== '-' ? colors[1] : lengths[1] !== '-' ? lengths[1] : '-'
  ];
}

// Handle album click with shift-click support for password auto-fill
function handleAlbumClick(album: PhotoAlbum, event: MouseEvent) {
  // If shift-clicked and album has password, use it for auto-fill
  if (event.shiftKey && album.pwd) {
    event.preventDefault(); // Prevent browser password manager interference
    event.stopPropagation();
    initialPassword.value = album.pwd;
  } else {
    initialPassword.value = undefined;
  }
  
  // Set gallery state
  galleryId.value = album.id;
  galleryName.value = album.name;
  galleryDbId.value = profileData.value?.db_id || 0;
  galleryModalVisible.value = true;
}

// Close gallery modal
function handleCloseGalleryModal() {
  galleryModalVisible.value = false;
  galleryName.value = '';
  galleryId.value = '';
  galleryDbId.value = 0;
  initialPassword.value = undefined;
}

// Handle lightbox events from gallery modal
function handleOpenLightbox(photos: string[], imageIndex: number) {
  lightboxImages.value = photos;
  lightboxIndex.value = imageIndex;
  lightboxVisible.value = true;
}

function handleOpenVideoLightbox(videos: GalleryPhoto[], videoIndex: number) {
  videoLightboxVideos.value = videos;
  videoLightboxIndex.value = videoIndex;
  videoLightboxVisible.value = true;
}

// Compute lightbox z-index to be higher than ProfileDialog
const lightboxZIndex = computed(() => {
  return 10000020 + (props.stackLevel * 10);
});

// Inject lightbox z-index override styles
function injectLightboxStyles() {
  const styleId = `sdc-lightbox-z-index-override-${props.dialogId || 'profile'}`;
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      body .vel-modal {
        z-index: ${lightboxZIndex.value} !important;
        pointer-events: auto !important;
      }
      body .vel-modal-mask {
        pointer-events: auto !important;
        z-index: ${lightboxZIndex.value} !important;
      }
      body .v-popper__popper {
        z-index: ${lightboxZIndex.value} !important;
      }
      body .v-popper__inner {
        z-index: ${lightboxZIndex.value} !important;
      }
    `;
    document.head.appendChild(style);
  } else {
    // Update existing style if z-index changed
    const style = document.getElementById(styleId) as HTMLStyleElement;
    if (style) {
      style.textContent = `
        body .vel-modal {
          z-index: ${lightboxZIndex.value} !important;
          pointer-events: auto !important;
        }
        body .vel-modal-mask {
          pointer-events: auto !important;
          z-index: ${lightboxZIndex.value} !important;
        }
        body .v-popper__popper {
          z-index: ${lightboxZIndex.value} !important;
        }
        body .v-popper__inner {
          z-index: ${lightboxZIndex.value} !important;
        }
      `;
    }
  }
}

function removeLightboxStyles() {
  const styleId = `sdc-lightbox-z-index-override-${props.dialogId || 'profile'}`;
  const style = document.getElementById(styleId);
  if (style) {
    style.remove();
  }
}

// Watch for z-index changes and update styles
watch(lightboxZIndex, () => {
  if (props.visible) {
    injectLightboxStyles();
  }
});

// Inject styles when dialog opens, remove when it closes
watch(() => props.visible, (newValue) => {
  if (newValue) {
    injectLightboxStyles();
  } else {
    removeLightboxStyles();
  }
});

onUnmounted(() => {
  removeLightboxStyles();
});

// Parse interests_st (3 characters: Girl on Girl, Soft Swap, Full Swap)
function parseInterestsSt(interestsSt: string | undefined): {
  girlOnGirl: boolean;
  softSwap: boolean;
  fullSwap: boolean;
} {
  if (!interestsSt || interestsSt.length < 3) {
    return { girlOnGirl: false, softSwap: false, fullSwap: false };
  }
  
  const chars = interestsSt.split('');
  return {
    girlOnGirl: chars[0] === '1',
    softSwap: chars[1] === '1',
    fullSwap: chars[2] === '1',
  };
}

// Parse interests1 or interests2 (6 characters: Couple M/F, Couple F/F, Couple M/M, Single F, Single M, Transgender)
function parseInterests(interests: string | undefined): {
  coupleMaleFemale: boolean;
  coupleFemaleFemale: boolean;
  coupleMaleMale: boolean;
  singleFemale: boolean;
  singleMale: boolean;
  transgender: boolean;
} {
  if (!interests || interests.length < 6) {
    return {
      coupleMaleFemale: false,
      coupleFemaleFemale: false,
      coupleMaleMale: false,
      singleFemale: false,
      singleMale: false,
      transgender: false,
    };
  }
  
  const chars = interests.split('');
  return {
    coupleMaleFemale: chars[0] === '1',
    coupleFemaleFemale: chars[1] === '1',
    coupleMaleMale: chars[2] === '1',
    singleFemale: chars[3] === '1',
    singleMale: chars[4] === '1',
    transgender: chars[5] === '1',
  };
}

// Get looking for icons based on interests1 and interests2
type LookingForIcon = 
  | { type: 'couple-group'; icons: Array<{ icon: string; color: string }> }
  | { type: 'single-female' | 'single-male'; icon: string; color: string };

function getLookingForIcons(): LookingForIcon[] {
  if (!profileData.value) return [];
  
  const icons: LookingForIcon[] = [];
  
  // Parse interests1 (what they're looking for)
  const interests1 = parseInterests(profileData.value.interests1);
  
  if (interests1.coupleMaleFemale) {
    // Couple: grouped together as one unit
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#3a97fe' }, // Blue for male
        { icon: 'fa6-solid:person', color: '#ff60df' }, // Pink for female
      ],
    });
  }
  
  if (interests1.singleFemale) {
    // Single female: one pink person icon
    icons.push({
      type: 'single-female',
      icon: 'fa6-solid:person',
      color: '#ff60df', // Pink
    });
  }
  
  if (interests1.singleMale) {
    // Single male: one blue person icon
    icons.push({
      type: 'single-male',
      icon: 'fa6-solid:person',
      color: '#3a97fe', // Blue
    });
  }
  
  return icons;
}

// Get preferences from interests_st
const lookingForPreferences = computed(() => {
  if (!profileData.value) return null;
  return parseInterestsSt(profileData.value.interests_st);
});

// Get looking for icons
const lookingForIcons = computed(() => {
  return getLookingForIcons();
});

// Helper to check if gender2 is a real person (not a placeholder)
// Gender2 is not real if age is > 100, undefined, or if most fields are "-"
const isGender2Real = computed(() => {
  if (!profileData.value) return false;
  
  const g2Age = profileData.value.g2_age;
  // If age is undefined, > 100, or < 18, it's not a real person
  if (!g2Age || g2Age > 100 || g2Age < 18) return false;
  
  // Additional check: if g2_nick is "Person 2" or similar placeholder, it's likely not real
  const g2Nick = profileData.value.g2_nick;
  if (g2Nick && (g2Nick.toLowerCase().includes('person 2') || g2Nick.toLowerCase().includes('placeholder'))) {
    return false;
  }
  
  return true;
});

// Check if opened from PeopleDialog (no dialogId means opened from PeopleDialog)
const isFromPeopleDialog = computed(() => !props.dialogId || props.dialogId === '');

// Chat button state
const isStartingChat = ref(false);

// Handle opening chat
async function handleOpenChat() {
  if (!profileData.value?.db_id || isStartingChat.value) return;
  
  isStartingChat.value = true;
  const toast = (window as any).__sdcBoostToast;
  
  try {
    // Check if chat already exists
    const existingChats = await chatStorage.getAllChats();
    const existingChat = existingChats.find(
      (chat: MessengerChatItem) => 
        chat.db_id === profileData.value!.db_id && 
        !chat.broadcast && 
        chat.type !== 100
    );
    
    let chatId: number | string;
    
    if (existingChat) {
      // Chat already exists, use its group_id
      chatId = existingChat.group_id;
    } else {
      // Start new chat
      const response = await startChat(profileData.value.db_id);
      
      if (!response.info.group_id) {
        throw new Error('Failed to create chat: no group_id returned');
      }
      
      chatId = response.info.group_id;
      
      // Create chat item and store it
      const chatItem: MessengerChatItem = {
        db_id: response.info.target_db_id || profileData.value.db_id,
        account_id: response.info.account_id || profileData.value.account_id || '',
        gender1: response.info.gender1 || profileData.value.gender1 || 0,
        gender2: response.info.gender2 || profileData.value.gender2 || 0,
        profile_type: response.info.profile_type || profileData.value.profile_type || 0,
        unread_counter: 0,
        last_message: '',
        message_status: 0,
        date: new Date().toISOString(),
        date_time: new Date().toISOString(),
        start_chat: 1,
        primary_photo: response.info.primary_photo || profileData.value.photo_file_list?.[0] || '',
        muted: response.info.muted || 0,
        pin_chat: response.info.pin_chat || 0,
        time_elapsed: '',
        isFriend: false,
        online: response.info.online || profileData.value.online || 0,
        group_type: 0,
        group_id: chatId,
        blocked_profile: 0,
        extra1: '',
      };
      
      await chatStorage.upsertChats([chatItem]);
    }
    
    // Reload page with chat parameters in URL
    // This will cause ChatDialogWrapper to auto-open the chat on page load
    const url = new URL(window.location.href);
    url.searchParams.set('chat', 'open');
    url.searchParams.set('chatId', chatId.toString());
    
    // Reload the page with the new URL
    window.location.assign(url.toString());
  } catch (err: any) {
    console.error('[ProfileDialog] Failed to open chat:', err);
    isStartingChat.value = false;
    
    if (err.isBlockedChat) {
      if (toast) {
        toast.error('Cannot start chat: ' + (err.message || 'Chat is blocked'));
      }
    } else {
      if (toast) {
        toast.error('Failed to start chat: ' + (err.message || 'Unknown error'));
      }
    }
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    :style="{
      pointerEvents: 'auto',
      zIndex: 10000011 + (stackLevel * 10), // Higher base z-index than GroupDialog to ensure it appears above
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      background: stackLevel > 0 ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
    }"
    @click.self="handleClose"
  >
    <div
      class="w-[80vw] max-w-6xl h-[90vh] bg-[#1a1a1a] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-[#333]"
      :style="{
        transform: stackLevel > 0 ? `scale(${1 - stackLevel * 0.05})` : 'scale(1)',
        transition: 'transform 0.2s ease',
      }"
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-[#333] shrink-0">
        <div class="flex items-center gap-4 flex-1 min-w-0">
          <div class="relative w-12 h-12 shrink-0">
            <img
              v-if="profileData?.photo_file_list?.[0]"
              :src="getPhotoUrl(`${profileData.db_id}/${profileData.photo_file_list[0]}`)"
              :alt="profileData?.account_id || 'Profile'"
              class="w-12 h-12 rounded-full object-cover"
              @error="handleImageError($event, getPhotoUrl(`${profileData.db_id}/${profileData.photo_file_list[0]}`))"
              @load="handleImageLoad($event, getPhotoUrl(`${profileData.db_id}/${profileData.photo_file_list[0]}`))"
            />
            <div
              v-else
              class="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center"
            >
              <Icon icon="mdi:account-outline" width="24" height="24" class="text-[#666]" />
            </div>
            <!-- Refresh indicator - only show when refreshing due to image errors -->
            <div
              v-if="isRefreshingImages && isRefreshingDueToError"
              class="absolute -top-1 -right-1 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin bg-[#1a1a1a]"
              title="Refreshing images..."
            ></div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-semibold text-white truncate">
                {{ profileData?.account_id || 'Loading...' }}
              </h2>
              <a
                v-if="profileData?.db_id"
                :href="`https://www.sdc.com/react/#/profile?idUser=${profileData.db_id}`"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
                class="p-1 hover:bg-[#333] rounded transition-colors shrink-0"
                title="Open profile in new tab"
              >
                <Icon icon="mdi:open-in-new" width="16" height="16" class="text-[#999] hover:text-white" />
              </a>
            </div>
            <div v-if="profileData?.g1_age || (profileData?.g2_age && isGender2Real)" class="flex items-center gap-2">
              <span v-if="profileData.g1_age" :class="['text-sm font-medium', getAgeColorClass(profileData.gender1)]">{{ profileData.g1_age }}</span>
              <span v-if="profileData.g2_age && isGender2Real" :class="['text-sm font-medium', getAgeColorClass(profileData.gender2)]">{{ profileData.g2_age }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <!-- Chat Button (only show when opened from PeopleDialog) -->
          <button
            v-if="isFromPeopleDialog && profileData?.db_id"
            @click="handleOpenChat"
            :disabled="isStartingChat"
            class="p-2 hover:bg-[#333] rounded-md transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            :title="isStartingChat ? 'Starting chat...' : 'Open chat'"
          >
            <Icon 
              v-if="!isStartingChat"
              icon="mdi:message-outline" 
              width="20" 
              height="20" 
              class="text-[#999] hover:text-white" 
            />
            <Icon 
              v-else
              icon="mdi:loading" 
              width="20" 
              height="20" 
              class="text-[#999] animate-spin" 
            />
          </button>
          <button
            @click="handleClose"
            class="p-2 hover:bg-[#333] rounded-md transition-colors shrink-0"
            title="Close"
          >
            <Icon icon="mdi:close" width="20" height="20" class="text-[#999] hover:text-white" />
          </button>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="border-b border-[#333] shrink-0 overflow-x-auto scrollbar-hide" style="scrollbar-width: none; -ms-overflow-style: none;">
        <div class="flex items-center gap-1 px-4 min-w-max">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2',
              activeTab === tab.id
                ? 'text-blue-400 border-blue-400'
                : 'text-[#999] border-transparent hover:text-white hover:border-[#555]'
            ]"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto">
        <!-- Loading State -->
        <div v-if="isLoading" class="flex items-center justify-center h-full">
          <div class="flex flex-col items-center gap-4">
            <div class="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-[#999] text-sm">Loading profile...</div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex items-center justify-center h-full">
          <div class="text-center px-6">
            <div class="text-red-500 mb-2">{{ error }}</div>
            <button
              @click="userId && fetchProfile(userId)"
              class="text-blue-500 hover:text-blue-400 text-sm"
            >
              Try again
            </button>
          </div>
        </div>

        <!-- Profile Tab -->
        <div v-else-if="activeTab === 'profile' && profileData" class="p-6">
          <!-- Profile Header Card -->
          <div class="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] rounded-xl p-6 mb-6 border border-[#333]">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <!-- Profile Picture -->
              <div class="md:col-span-1 flex flex-col items-center">
                <div class="relative">
                  <img
                    v-if="profileData.photo_file_list?.[0]"
                    :src="getPhotoUrl(`${profileData.db_id}/${profileData.photo_file_list[0]}`)"
                    :alt="profileData.account_id"
                    class="w-48 h-48 rounded-2xl object-cover shadow-xl border-2 border-[#333]"
                    @error="handleImageError($event, getPhotoUrl(`${profileData.db_id}/${profileData.photo_file_list[0]}`))"
                    @load="handleImageLoad($event, getPhotoUrl(`${profileData.db_id}/${profileData.photo_file_list[0]}`))"
                  />
                  <div
                    v-else
                    class="w-48 h-48 rounded-2xl bg-[#333] flex items-center justify-center shadow-xl border-2 border-[#333]"
                  >
                    <Icon icon="mdi:account-outline" width="64" height="64" class="text-[#666]" />
                  </div>
                  <!-- Refresh indicator - only show when refreshing due to image errors -->
                  <div
                    v-if="isRefreshingImages && isRefreshingDueToError"
                    class="absolute top-2 right-2 w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin bg-[#1a1a1a]"
                    title="Refreshing images..."
                  ></div>
                  <div 
                    v-if="profileData.online === 1" 
                    class="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-4 border-[#1a1a1a]"
                  ></div>
                </div>
                
                <!-- Membership Badge -->
                <div v-if="profileData.membership" class="mt-4 flex items-center gap-2 px-4 py-2 bg-[#0f0f0f] rounded-full border border-[#333]">
                  <Icon v-if="profileData.lifetime_status" icon="mdi:star" width="18" height="18" class="text-yellow-400" />
                  <span class="text-sm font-medium text-white">{{ profileData.membership }}</span>
                </div>
              </div>

              <!-- Profile Info -->
              <div class="md:col-span-2 flex flex-col justify-center space-y-4">
                <!-- Name and Age -->
                <div>
                  <h3 class="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    {{ profileData.account_id }}
                    <span v-if="profileData.online === 1" class="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">Online</span>
                    <span v-else class="px-3 py-1 bg-[#333] text-[#999] text-xs rounded-full font-medium">Offline</span>
                  </h3>
                  <div v-if="profileData.g1_age || (profileData.g2_age && isGender2Real)" class="flex items-center gap-2">
                    <Icon icon="mdi:account-outline" width="20" height="20" class="text-pink-400 shrink-0" />
                    <div class="flex items-center gap-2">
                      <span v-if="profileData.g1_age" :class="['text-xl font-semibold', getAgeColorClass(profileData.gender1)]">{{ profileData.g1_age }}</span>
                      <span v-if="profileData.g2_age && isGender2Real" :class="['text-xl font-semibold', getAgeColorClass(profileData.gender2)]">{{ profileData.g2_age }}</span>
                    </div>
                  </div>
                </div>

                <!-- Locations -->
                <div v-if="profileData.location || profileData.location2" class="space-y-2">
                  <div v-if="profileData.location" class="flex items-start gap-2 text-[#999]">
                    <Icon icon="mdi:map-marker-outline" width="20" height="20" class="shrink-0 mt-0.5 text-blue-400" />
                    <span class="text-sm">{{ formatLocation(profileData.location, profileData.location_how_far) }}</span>
                  </div>
                  <div v-if="profileData.location2" class="flex items-start gap-2 text-[#999]">
                    <Icon icon="mdi:map-marker-outline" width="20" height="20" class="shrink-0 mt-0.5 text-blue-400" />
                    <span class="text-sm">{{ formatLocation(profileData.location2, profileData.location_how_far2 ? Number(profileData.location_how_far2) : undefined) }}</span>
                  </div>
                </div>

                <!-- Looking For -->
                <div v-if="profileData.hope_to_find" class="flex items-start gap-2">
                  <Icon icon="mdi:heart-outline" width="20" height="20" class="text-purple-400 shrink-0 mt-0.5" />
                  <div class="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium profile-bio" v-html="profileData.hope_to_find"></div>
                </div>

                <!-- Op zoek naar (Looking For) -->
                <div 
                  v-if="lookingForIcons.length > 0 || (lookingForPreferences && (lookingForPreferences.girlOnGirl || lookingForPreferences.softSwap || lookingForPreferences.fullSwap))" 
                  class="flex items-center gap-3 px-4 py-2.5 bg-[#0f0f0f] rounded-lg border border-[#333]"
                >
                  <span class="text-sm text-[#999] whitespace-nowrap">Op zoek naar:</span>
                  <!-- Icons -->
                  <div v-if="lookingForIcons.length > 0" class="flex items-center gap-2">
                    <template v-for="(item, index) in lookingForIcons" :key="index">
                      <!-- Couple group: display horizontally with overlapping -->
                      <div v-if="item.type === 'couple-group'" class="flex items-center">
                        <Icon 
                          v-for="(icon, i) in item.icons" 
                          :key="i"
                          :icon="icon.icon"
                          width="16"
                          height="16"
                          :style="{ 
                            color: icon.color,
                            marginLeft: i === 1 ? '-6px' : '0'
                          }"
                        />
                      </div>
                      <!-- Single icons: render normally -->
                      <Icon 
                        v-else-if="item.type === 'single-female' || item.type === 'single-male'"
                        :icon="item.icon"
                        width="16"
                        height="16"
                        :style="{ color: item.color }"
                      />
                    </template>
                  </div>
                  <!-- Separator -->
                  <span 
                    v-if="lookingForIcons.length > 0 && lookingForPreferences && (lookingForPreferences.girlOnGirl || lookingForPreferences.softSwap || lookingForPreferences.fullSwap)" 
                    class="text-[#444]"
                  >|</span>
                  <!-- Preferences -->
                  <div v-if="lookingForPreferences" class="flex flex-wrap items-center gap-2">
                    <span 
                      v-if="lookingForPreferences.girlOnGirl" 
                      class="px-2 py-0.5 bg-pink-500/20 text-pink-300 rounded text-xs font-medium"
                    >Vrouw met vrouw</span>
                    <span 
                      v-if="lookingForPreferences.softSwap" 
                      class="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs font-medium"
                    >Soft Swap</span>
                    <span 
                      v-if="lookingForPreferences.fullSwap" 
                      class="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs font-medium"
                    >Full Swap</span>
                  </div>
                </div>

                <!-- Stats -->
                <div class="flex flex-wrap gap-4 pt-2">
                  <div v-if="profileData.validations" class="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f] rounded-lg border border-[#333]">
                    <Icon icon="mdi:check-circle-outline" width="16" height="16" class="text-green-400" />
                    <span class="text-sm text-white">{{ profileData.validations }} Validations</span>
                  </div>
                  <div v-if="profileData.friend_counter" class="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f] rounded-lg border border-[#333]">
                    <Icon icon="mdi:account-multiple-outline" width="16" height="16" class="text-blue-400" />
                    <span class="text-sm text-white">{{ profileData.friend_counter }} Friends</span>
                  </div>
                  <div v-if="profileData.likes" class="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f] rounded-lg border border-[#333]">
                    <Icon icon="mdi:heart-outline" width="16" height="16" class="text-pink-400" />
                    <span class="text-sm text-white">{{ profileData.likes }} Likes</span>
                  </div>
                  <div v-if="profileData.messenger_count !== undefined && profileData.messenger_count !== null" class="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f] rounded-lg border border-[#333]">
                    <Icon icon="mdi:message-outline" width="16" height="16" class="text-cyan-400" />
                    <span class="text-sm text-white">{{ profileData.messenger_count }} Messages</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bio -->
          <div v-if="profileData.profile_description" class="mb-6 bg-[#0f0f0f] rounded-xl p-6 border border-[#333]">
            <h4 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Icon icon="mdi:file-document-outline" width="20" height="20" class="text-blue-400" />
              About
            </h4>
            <div
              class="text-sm text-[#ccc] profile-bio leading-relaxed"
              v-html="profileData.profile_description"
            ></div>
          </div>

          <!-- Details Table -->
          <div class="bg-[#0f0f0f] rounded-xl p-6 border border-[#333] w-full">
            <h4 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Icon icon="mdi:table" width="20" height="20" class="text-purple-400" />
              Details
            </h4>
            <div class="overflow-x-auto w-full">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b-2 border-[#333]">
                    <th class="text-left py-3 px-4 text-[#999] font-semibold"></th>
                    <th class="text-left py-3 px-4 text-pink-400 font-semibold text-base">{{ getGenderLabel(profileData.gender1) }}</th>
                    <th v-if="isGender2Real" class="text-left py-3 px-4 text-blue-400 font-semibold text-base">{{ getGenderLabel(profileData.gender2) }}</th>
                  </tr>
                </thead>
                <tbody class="text-white">
                  <tr class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Age</td>
                    <td class="py-3 px-4 text-pink-300 font-medium">{{ profileData.g1_age || '-' }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300 font-medium">{{ profileData.g2_age || '-' }}</td>
                  </tr>
                  <tr v-if="profileData.hair_color || profileData.hair_length" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Hair</td>
                    <td class="py-3 px-4 text-pink-300">{{ combineHair(profileData.hair_color, profileData.hair_length)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ combineHair(profileData.hair_color, profileData.hair_length)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.body_hair" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Body Hair</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.body_hair)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.body_hair)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.height" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Height</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.height)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.height)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.weight" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Weight</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.weight)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.weight)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.body_type" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Body Type</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.body_type)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.body_type)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.race" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Ethnic Background</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.race)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.race)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.smoke" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Smoking</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.smoke)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.smoke)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.piercings" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Piercings</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.piercings)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.piercings)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.tattoos" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Tattoos</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.tattoos)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.tattoos)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.languages" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Languages</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.languages)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.languages)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.look_imp" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Looks Importance</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.look_imp)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.look_imp)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.inte_imp" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Intelligence Importance</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.inte_imp)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.inte_imp)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.sexuality" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Sexuality</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.sexuality)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.sexuality)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.relationship" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Relationship</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.relationship)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.relationship)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.experience" class="hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Experience</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.experience)[0] }}</td>
                    <td v-if="isGender2Real" class="py-3 px-4 text-blue-300">{{ splitValue(profileData.experience)[1] }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Images Tab -->
        <div v-else-if="activeTab === 'images' && profileData" class="p-6">
          <div class="bg-[#0f0f0f] rounded-xl p-6 border border-[#333]">
            <h4 class="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Icon icon="mdi:image-outline" width="20" height="20" class="text-blue-400" />
              Images
            </h4>
            <div class="space-y-6">
              <!-- Non-Adult Photos -->
              <div v-if="profileData.vanilla_photo_counter && profileData.vanilla_photo_counter > 0">
                <h3 class="text-lg font-semibold text-white mb-4">Non-Adult Photos ({{ profileData.vanilla_photo_counter }})</h3>
              <div class="grid grid-cols-3 gap-4">
                <div
                  v-for="(photo, index) in profileData.vanilla_photo_album"
                  :key="index"
                  class="aspect-square rounded-lg overflow-hidden bg-[#0f0f0f]"
                >
                  <img
                    :src="getPhotoUrl(`${profileData.db_id}/${photo}`)"
                    :alt="`Photo ${index + 1}`"
                    class="w-full h-full object-cover"
                    @error="handleImageError($event, getPhotoUrl(`${profileData.db_id}/${photo}`))"
                    @load="handleImageLoad($event, getPhotoUrl(`${profileData.db_id}/${photo}`))"
                  />
                </div>
              </div>
            </div>

            <!-- Adult Photos -->
            <div v-if="profileData.no_vanilla_photo_counter && profileData.no_vanilla_photo_counter > 0">
              <h3 class="text-lg font-semibold text-white mb-4">Adult Photos ({{ profileData.no_vanilla_photo_counter }})</h3>
              <div class="grid grid-cols-3 gap-4">
                <div
                  v-for="(photo, index) in profileData.no_vanilla_photo_album"
                  :key="index"
                  class="aspect-square rounded-lg overflow-hidden bg-[#0f0f0f]"
                >
                  <img
                    :src="getPhotoUrl(`${profileData.db_id}/${photo}`)"
                    :alt="`Photo ${index + 1}`"
                    class="w-full h-full object-cover"
                    @error="handleImageError($event, getPhotoUrl(`${profileData.db_id}/${photo}`))"
                    @load="handleImageLoad($event, getPhotoUrl(`${profileData.db_id}/${photo}`))"
                  />
                </div>
              </div>
            </div>

            <!-- Videos -->
            <div v-if="profileData.video_counter && profileData.video_counter > 0">
              <h3 class="text-lg font-semibold text-white mb-4">Videos ({{ profileData.video_counter }})</h3>
              <!-- Show videos if video_list exists and has items -->
              <div v-if="profileData.video_list && profileData.video_list.length > 0" class="grid grid-cols-3 gap-4">
                <div
                  v-for="(video, index) in profileData.video_list"
                  :key="video.id || index"
                  class="aspect-square rounded-lg overflow-hidden bg-[#0f0f0f] relative group cursor-pointer"
                >
                  <img
                    v-if="video.thumbnail"
                    :src="video.thumbnail"
                    :alt="`Video ${index + 1}`"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                    <Icon icon="mdi:play" width="48" height="48" class="text-[#666]" />
                  </div>
                  <!-- Play overlay -->
                  <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Icon icon="mdi:play" width="48" height="48" class="text-white drop-shadow-lg" />
                  </div>
                  <!-- Views badge -->
                  <div v-if="video.views" class="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {{ video.views }} views
                  </div>
                </div>
              </div>
              <!-- Show placeholder if videos exist but are hidden -->
              <div v-else class="grid grid-cols-3 gap-4">
                <div
                  v-for="n in Math.min(profileData.video_counter, 9)"
                  :key="n"
                  class="aspect-square rounded-lg bg-[#0f0f0f] border-2 border-dashed border-[#333] flex flex-col items-center justify-center"
                >
                  <Icon icon="mdi:lock-outline" width="48" height="48" class="text-[#666] mb-2" />
                  <span class="text-xs text-[#666] text-center px-2">Hidden</span>
                </div>
              </div>
            </div>

              <div v-if="(!profileData.vanilla_photo_counter || profileData.vanilla_photo_counter === 0) && (!profileData.no_vanilla_photo_counter || profileData.no_vanilla_photo_counter === 0) && (!profileData.video_counter || profileData.video_counter === 0)" class="text-center text-[#999] py-12">
                No images or videos available
              </div>
            </div>
          </div>
        </div>

        <!-- Albums Tab -->
        <div v-else-if="activeTab === 'albums' && profileData" class="p-6">
          <div class="bg-[#0f0f0f] rounded-xl p-6 border border-[#333]">
            <h4 class="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Icon icon="mdi:image-multiple-outline" width="20" height="20" class="text-green-400" />
              Albums
            </h4>
            <div v-if="profileData.photoalbum_list && profileData.photoalbum_list.length > 0" class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div
              v-for="album in profileData.photoalbum_list"
              :key="album.id"
              @click="handleAlbumClick(album, $event)"
              class="bg-[#0f0f0f] rounded-lg overflow-hidden border border-[#333] cursor-pointer hover:bg-[#1a1a1a] transition-colors"
            >
              <div class="aspect-square bg-[#1a1a1a] relative">
                <img
                  v-if="album.photo_album"
                  :src="album.photo_album"
                  :alt="album.name"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Icon icon="mdi:image-outline" width="48" height="48" class="text-[#666]" />
                </div>
                <div v-if="album.password === 1" class="absolute top-2 right-2 bg-black/50 rounded px-2 py-1">
                  <Icon icon="mdi:lock-outline" width="16" height="16" class="text-white" />
                </div>
              </div>
              <div class="p-3">
                <h4 class="text-white font-medium mb-1">{{ album.name }}</h4>
                <p class="text-xs text-[#999]">
                  {{ album.counter_images }} photos
                  <span v-if="album.counter_videos !== '0'">, {{ album.counter_videos }} videos</span>
                </p>
              </div>
              </div>
            </div>
            <div v-else class="text-center text-[#999] py-12">
              No albums available
            </div>
          </div>
        </div>

        <!-- Validaties Tab -->
        <div v-else-if="activeTab === 'validaties' && profileData" class="p-6">
          <div class="bg-[#0f0f0f] rounded-xl p-6 border border-[#333]">
            <h4 class="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Icon icon="mdi:check-circle-outline" width="20" height="20" class="text-green-400" />
              Validaties
              <span v-if="profileData.validations" class="text-sm text-[#999] font-normal ml-2">
                ({{ profileData.validations }} total)
              </span>
            </h4>
            
            <!-- Loading State -->
            <div v-if="isLoadingValidations" class="flex items-center justify-center py-12">
              <div class="flex flex-col items-center gap-4">
                <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div class="text-[#999] text-sm">Loading validations...</div>
              </div>
            </div>
            
            <!-- Error State -->
            <div v-else-if="validationsError" class="text-center py-12">
              <div class="text-red-500 mb-2">{{ validationsError }}</div>
              <button
                @click="profileData?.db_id && fetchAllValidations(profileData.db_id)"
                class="text-blue-500 hover:text-blue-400 text-sm"
              >
                Try again
              </button>
            </div>
            
            <!-- Validations List -->
            <div v-else-if="allValidations.length > 0" class="space-y-4">
              <div
                v-for="validation in allValidations"
                :key="validation.db_id"
                @click="emit('open-profile', validation.db_id)"
                class="bg-[#0f0f0f] rounded-lg p-4 border border-[#333] cursor-pointer hover:bg-[#1a1a1a] transition-colors"
              >
                <div class="flex items-start gap-4">
                  <img
                    :src="getPhotoUrl(validation.primary_photo)"
                    :alt="validation.account_id"
                    class="w-16 h-16 rounded-full object-cover shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h4 class="text-white font-medium">{{ validation.account_id }}</h4>
                      <Icon v-if="validation.lifetime_status" icon="mdi:star" width="14" height="14" class="text-yellow-400" />
                      <span v-if="validation.online === 1" class="w-2 h-2 bg-green-500 rounded-full"></span>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                      <span v-if="splitAge(validation.age)[0] !== '-'" :class="['text-sm font-semibold', getAgeColorClass(validation.gender1)]">{{ splitAge(validation.age)[0] }}</span>
                      <span v-if="splitAge(validation.age)[1] !== '-'" :class="['text-sm font-semibold', getAgeColorClass(validation.gender2)]">{{ splitAge(validation.age)[1] }}</span>
                      <span v-if="validation.location" class="text-sm text-[#999]">| {{ validation.location }}</span>
                    </div>
                    <p class="text-sm text-white">{{ validation.validation_text }}</p>
                    <p class="text-xs text-[#666] mt-2">{{ validation.validation_date }}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Fallback to profile validations if not loaded yet -->
            <div v-else-if="profileData.my_validations && profileData.my_validations.length > 0" class="space-y-4">
              <div
                v-for="validation in profileData.my_validations"
                :key="validation.validation_id"
                @click="emit('open-profile', validation.db_id)"
                class="bg-[#0f0f0f] rounded-lg p-4 border border-[#333] cursor-pointer hover:bg-[#1a1a1a] transition-colors"
              >
                <div class="flex items-start gap-4">
                  <img
                    :src="getPhotoUrl(validation.primary_photo)"
                    :alt="validation.account_id"
                    class="w-16 h-16 rounded-full object-cover shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h4 class="text-white font-medium">{{ validation.account_id }}</h4>
                      <Icon v-if="validation.lifetime_status" icon="mdi:star" width="14" height="14" class="text-yellow-400" />
                      <span v-if="validation.online === 1" class="w-2 h-2 bg-green-500 rounded-full"></span>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                      <span v-if="splitAge(validation.age)[0] !== '-'" :class="['text-sm font-semibold', getAgeColorClass(validation.gender1)]">{{ splitAge(validation.age)[0] }}</span>
                      <span v-if="splitAge(validation.age)[1] !== '-'" :class="['text-sm font-semibold', getAgeColorClass(validation.gender2)]">{{ splitAge(validation.age)[1] }}</span>
                      <span v-if="validation.location" class="text-sm text-[#999]">| {{ validation.location }}</span>
                    </div>
                    <p class="text-sm text-white">{{ validation.subject }}</p>
                    <p class="text-xs text-[#666] mt-2">{{ validation.date }}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else class="text-center text-[#999] py-12">
              No validations available
            </div>
          </div>
        </div>

        <!-- Groepen Tab -->
        <div v-else-if="activeTab === 'groepen' && profileData" class="p-6">
          <div class="bg-[#0f0f0f] rounded-xl p-6 border border-[#333]">
            <h4 class="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Icon icon="mdi:account-group-outline" width="20" height="20" class="text-orange-400" />
              Groepen
            </h4>
            <div v-if="profileData.communities && profileData.communities.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="community in profileData.communities"
              :key="community.id"
              @click.stop
              class="bg-[#0f0f0f] rounded-lg p-4 border border-[#333] cursor-pointer hover:bg-[#1a1a1a] transition-colors"
            >
              <a
                :href="`https://www.sdc.com/react/#/community?id=${community.id}`"
                target="_blank"
                rel="noopener noreferrer"
                class="block"
              >
              <div class="flex items-start gap-4">
                <div class="w-16 h-16 rounded-lg bg-[#1a1a1a] flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    v-if="community.picture"
                    :src="getCommunityPhotoUrl(community.picture)"
                    :alt="community.club_name"
                    class="w-full h-full object-cover"
                    @error="(e: any) => { e.target.style.display = 'none'; }"
                  />
                  <span v-else class="text-2xl text-[#666]">{{ community.club_name.charAt(0) }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-white font-medium mb-1">{{ community.club_name }}</h4>
                  <p class="text-xs text-[#999] mb-2">{{ community.location }} | {{ community.total_members }} members</p>
                  <p class="text-sm text-[#ccc] line-clamp-2">{{ community.short_description }}</p>
                </div>
                </div>
              </a>
              </div>
            </div>
            <div v-else class="text-center text-[#999] py-12">
              No groups available
            </div>
          </div>
        </div>

        <!-- Speed Date Tab -->
        <div v-else-if="activeTab === 'speeddate' && profileData" class="p-6">
          <div class="bg-[#0f0f0f] rounded-xl p-6 border border-[#333]">
            <h4 class="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Icon icon="mdi:clock-outline" width="20" height="20" class="text-red-400" />
              Speed Date
            </h4>
            <div v-if="profileData.speeddating_active && profileData.speeddating_details" class="bg-[#1a1a1a] rounded-lg p-6 border border-[#333]">
              <h3 class="text-lg font-semibold text-white mb-4">Speed Dating</h3>
            <div class="space-y-3">
              <div v-if="profileData.speeddating_details.date_list">
                <span class="text-sm text-[#999]">Date: </span>
                <span class="text-sm text-white">{{ profileData.speeddating_details.date_list }}</span>
              </div>
              <div v-if="profileData.speeddating_details.location">
                <span class="text-sm text-[#999]">Location: </span>
                <span class="text-sm text-white">{{ profileData.speeddating_details.location }}</span>
                <span v-if="profileData.speeddating_details.how_far" class="text-sm text-[#999] ml-2">
                  ({{ profileData.speeddating_details.how_far }} km away)
                </span>
              </div>
              <div v-if="profileData.speeddating_details.personal_text" class="mt-4">
                <p class="text-sm text-white">{{ profileData.speeddating_details.personal_text }}</p>
                </div>
              </div>
            </div>
            <div v-else class="text-center text-[#999] py-12">
              No speed dating information available
            </div>
          </div>
        </div>

        <!-- Party & Events Tab -->
        <div v-else-if="activeTab === 'parties' && profileData" class="p-6">
          <div class="bg-[#0f0f0f] rounded-xl p-6 border border-[#333]">
            <h4 class="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Icon icon="mdi:tag-outline" width="20" height="20" class="text-yellow-400" />
              Party & Events
            </h4>
            <div v-if="profileData.party_plans_up && profileData.party_plans_up.length > 0" class="space-y-4">
            <a
              v-for="party in profileData.party_plans_up"
              :key="party.event_id"
              :href="`https://www.sdc.com/react/#/party?idParty=${party.event_id}&partyType=${party.event_type || 1}`"
              target="_blank"
              rel="noopener noreferrer"
              @click.stop
              class="block bg-[#0f0f0f] rounded-lg overflow-hidden border border-[#333] cursor-pointer hover:bg-[#1a1a1a] transition-colors"
            >
              <div v-if="party.splash_photo" class="aspect-video bg-[#1a1a1a]">
                <img
                  :src="party.splash_photo"
                  :alt="party.title"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="p-4">
                <h4 class="text-white font-medium mb-2">{{ party.title }}</h4>
                <p class="text-sm text-[#999] mb-1">{{ party.party_date }}</p>
                <p class="text-sm text-[#999]">{{ party.location }}</p>
                </div>
              </a>
            </div>
            <div v-else class="text-center text-[#999] py-12">
              No upcoming parties or events
            </div>
          </div>
        </div>

        <!-- Following Tab -->
        <div v-else-if="activeTab === 'following' && profileData" class="p-6">
          <div class="bg-[#0f0f0f] rounded-xl p-6 border border-[#333]">
            <h4 class="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Icon icon="mdi:account-plus-outline" width="20" height="20" class="text-blue-400" />
              Following
            </h4>
            <div v-if="profileData.following && profileData.following.length > 0" class="space-y-3">
            <div
              v-for="follow in profileData.following"
              :key="follow.db_id"
              @click="emit('open-profile', follow.db_id)"
              class="bg-[#0f0f0f] rounded-lg p-4 border border-[#333] flex items-center gap-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
            >
              <img
                :src="getPhotoUrl(follow.primary_photo)"
                :alt="follow.account_id"
                class="w-12 h-12 rounded-full object-cover shrink-0"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h4 class="text-white font-medium">{{ follow.account_id }}</h4>
                  <Icon v-if="follow.lifetime_status" icon="mdi:star" width="14" height="14" class="text-yellow-400" />
                  <span v-if="follow.online === 1" class="w-2 h-2 bg-green-500 rounded-full"></span>
                </div>
                <p class="text-sm text-[#999]">{{ follow.location }}</p>
                <div v-if="follow.biz_type_subcategories && follow.biz_type_subcategories.length > 0" class="flex flex-wrap gap-1 mt-1">
                  <span
                    v-for="category in follow.biz_type_subcategories"
                    :key="category"
                    class="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded"
                  >
                    {{ category }}
                  </span>
                </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center text-[#999] py-12">
              Not following anyone
            </div>
          </div>
        </div>

        <!-- Friends Tab -->
        <div v-else-if="activeTab === 'friends' && profileData" class="p-6">
          <div class="bg-[#0f0f0f] rounded-xl p-6 border border-[#333]">
            <h4 class="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Icon icon="mdi:account-multiple-outline" width="20" height="20" class="text-blue-400" />
              Friends
            </h4>
            <div v-if="profileData.friends && profileData.friends.length > 0" class="space-y-3">
              <div
                v-for="friend in profileData.friends"
                :key="friend.db_id"
                @click="emit('open-profile', Number(friend.db_id))"
                class="bg-[#1a1a1a] rounded-lg p-4 border border-[#333] flex items-center gap-4 cursor-pointer hover:bg-[#222] transition-colors"
              >
                <img
                  :src="getPhotoUrl(friend.primary_photo)"
                  :alt="friend.account_id"
                  class="w-12 h-12 rounded-full object-cover shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h4 class="text-white font-medium">{{ friend.account_id }}</h4>
                    <Icon v-if="friend.lifetime_status" icon="mdi:star" width="14" height="14" class="text-yellow-400" />
                    <span v-if="friend.online === 1" class="w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                  <div class="flex items-center gap-2 mt-1.5">
                    <span v-if="splitAge(friend.age)[0] !== '-'" :class="['text-sm font-semibold', getAgeColorClass(friend.gender1)]">{{ splitAge(friend.age)[0] }}</span>
                    <span v-if="splitAge(friend.age)[1] !== '-'" :class="['text-sm font-semibold', getAgeColorClass(friend.gender2)]">{{ splitAge(friend.age)[1] }}</span>
                    <span v-if="friend.location" class="text-sm text-[#999]">| {{ friend.location }}</span>
                  </div>
                  <div class="flex items-center gap-3 mt-2 flex-wrap">
                    <span v-if="friend.photo_count > 0" class="text-xs px-2 py-1 bg-pink-500/20 text-pink-300 rounded-full font-medium">{{ friend.photo_count }} photos</span>
                    <span v-if="friend.video_count > 0" class="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full font-medium">{{ friend.video_count }} videos</span>
                    <span v-if="friend.valid_count > 0" class="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded-full font-medium">{{ friend.valid_count }} validations</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center text-[#999] py-12">
              No friends available
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Gallery Modal -->
    <GalleryModal
      :visible="galleryModalVisible"
      :gallery-name="galleryName"
      :gallery-id="galleryId"
      :db-id="galleryDbId"
      :initial-password="initialPassword"
      @close="handleCloseGalleryModal"
      @open-lightbox="handleOpenLightbox"
      @open-video-lightbox="handleOpenVideoLightbox"
    />

    <!-- Image Lightbox -->
    <VueEasyLightbox
      v-if="lightboxImages.length > 0"
      :visible="lightboxVisible"
      :imgs="lightboxImages"
      :index="lightboxIndex"
      teleport="body"
      :mask-closable="true"
      :scroll-disabled="true"
      @hide="lightboxVisible = false"
    />

    <!-- Video Lightbox -->
    <VideoLightbox
      :visible="videoLightboxVisible"
      :videos="videoLightboxVideos"
      :initial-index="videoLightboxIndex"
      :z-index="lightboxZIndex"
      @close="videoLightboxVisible = false"
    />
  </div>
</template>

<style scoped>
.profile-bio {
  color: #ccc;
  line-height: 1.6;
}

.profile-bio :deep(p) {
  margin-bottom: 1em;
}

.profile-bio :deep(br) {
  display: block;
  content: "";
  margin-top: 0.5em;
}

.profile-bio :deep(strong) {
  font-weight: 600;
  color: #fff;
}

.profile-bio :deep(em) {
  font-style: italic;
}

.profile-bio :deep(u) {
  text-decoration: underline;
}

.profile-bio :deep(ul),
.profile-bio :deep(ol) {
  margin-left: 1.5em;
  margin-bottom: 1em;
}

.profile-bio :deep(li) {
  margin-bottom: 0.5em;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>

