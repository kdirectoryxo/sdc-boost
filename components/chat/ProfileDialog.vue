<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue';
import { getProfileV2 } from '@/lib/sdc-api/profile';
import type { ProfileUser, PhotoAlbum } from '@/lib/sdc-api-types';
import GalleryModal from '@/components/chat/GalleryModal.vue';

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
const error = ref<string | null>(null);

// Gallery modal state
const galleryModalVisible = ref<boolean>(false);
const galleryName = ref<string>('');
const galleryId = ref<string>('');
const galleryDbId = ref<number>(0);

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
        return profileData.value?.my_validations?.length || profileData.value?.validations || null;
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
watch([() => props.visible, () => props.userId], async ([visible, userId]) => {
  if (visible && userId) {
    await fetchProfile(userId);
  } else if (!visible) {
    // Reset state when closing
    profileData.value = null;
    error.value = null;
    activeTab.value = 'profile';
  }
}, { immediate: true });

async function fetchProfile(userId: number) {
  isLoading.value = true;
  error.value = null;
  
  try {
    const response = await getProfileV2(userId.toString());
    profileData.value = response.info.profile_user;
  } catch (err) {
    console.error('[ProfileDialog] Failed to fetch profile:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load profile';
  } finally {
    isLoading.value = false;
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

function getCommunityPhotoUrl(picture: string | undefined): string {
  if (!picture) return '';
  if (picture.startsWith('http')) return picture;
  // Community pictures use /group/logo/ path
  return `https://pictures.sdc.com/group/logo/${picture}`;
}

function formatLocation(location: string | undefined, distance: number | undefined): string {
  if (!location) return '';
  if (distance !== undefined && distance > 0) {
    return `${location} | ${distance} km`;
  }
  return location;
}

// Helper to split pipe-separated values
function splitValue(value: string | undefined): string[] {
  if (!value) return ['-', '-'];
  return value.split('|').map(v => v.trim() || '-');
}

// Helper to split age string (for friends/validations that only have age string)
function splitAge(age: string | undefined): string[] {
  if (!age) return ['-', '-'];
  return age.split('|').map(v => v.trim() || '-');
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

// Handle album click
function handleAlbumClick(album: PhotoAlbum) {
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
}

// Handle lightbox events from gallery modal
function handleOpenLightbox(photos: string[], imageIndex: number) {
  // TODO: Implement lightbox if needed in ProfileDialog context
  console.log('[ProfileDialog] Open lightbox:', photos, imageIndex);
}

function handleOpenVideoLightbox(videos: any[], videoIndex: number) {
  // TODO: Implement video lightbox if needed in ProfileDialog context
  console.log('[ProfileDialog] Open video lightbox:', videos, videoIndex);
}

// Helper to get "looking for" from interests
function getLookingFor(): string[] {
  // This would need to be parsed from interests field
  // For now, return empty array
  return [];
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    :style="{
      pointerEvents: 'auto',
      zIndex: 10000001 + (stackLevel * 10),
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
          <img
            v-if="profileData?.photo_file_list?.[0]"
            :src="getPhotoUrl(`${profileData.db_id}/${profileData.photo_file_list[0]}`)"
            :alt="profileData?.account_id || 'Profile'"
            class="w-12 h-12 rounded-full object-cover shrink-0"
          />
          <div v-else class="w-12 h-12 rounded-full bg-[#333] shrink-0 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-[#666]">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
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
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-[#999] hover:text-white"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </div>
            <div v-if="profileData?.g1_age || profileData?.g2_age" class="flex items-center gap-2">
              <span v-if="profileData.g1_age" :class="['text-sm font-medium', getAgeColorClass(profileData.gender1)]">{{ profileData.g1_age }}</span>
              <span v-if="profileData.g2_age" :class="['text-sm font-medium', getAgeColorClass(profileData.gender2)]">{{ profileData.g2_age }}</span>
            </div>
          </div>
        </div>
        <button
          @click="handleClose"
          class="p-2 hover:bg-[#333] rounded-md transition-colors shrink-0"
          title="Close"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-[#999] hover:text-white"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
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
                  />
                  <div 
                    v-if="profileData.online === 1" 
                    class="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-4 border-[#1a1a1a]"
                  ></div>
                </div>
                
                <!-- Membership Badge -->
                <div v-if="profileData.membership" class="mt-4 flex items-center gap-2 px-4 py-2 bg-[#0f0f0f] rounded-full border border-[#333]">
                  <span v-if="profileData.lifetime_status" class="text-yellow-400 text-lg">⭐</span>
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
                  <div v-if="profileData.g1_age || profileData.g2_age" class="flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-pink-400 shrink-0">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <div class="flex items-center gap-2">
                      <span v-if="profileData.g1_age" :class="['text-xl font-semibold', getAgeColorClass(profileData.gender1)]">{{ profileData.g1_age }}</span>
                      <span v-if="profileData.g2_age" :class="['text-xl font-semibold', getAgeColorClass(profileData.gender2)]">{{ profileData.g2_age }}</span>
                    </div>
                  </div>
                </div>

                <!-- Locations -->
                <div v-if="profileData.location || profileData.location2" class="space-y-2">
                  <div v-if="profileData.location" class="flex items-start gap-2 text-[#999]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 mt-0.5 text-blue-400">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span class="text-sm">{{ formatLocation(profileData.location, profileData.location_how_far) }}</span>
                  </div>
                  <div v-if="profileData.location2" class="flex items-start gap-2 text-[#999]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 mt-0.5 text-blue-400">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span class="text-sm">{{ formatLocation(profileData.location2, profileData.location_how_far2 ? Number(profileData.location_how_far2) : undefined) }}</span>
                  </div>
                </div>

                <!-- Looking For -->
                <div v-if="profileData.hope_to_find" class="flex items-start gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-purple-400 shrink-0 mt-0.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                  <div class="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium profile-bio" v-html="profileData.hope_to_find"></div>
                </div>

                <!-- Stats -->
                <div class="flex flex-wrap gap-4 pt-2">
                  <div v-if="profileData.validations" class="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f] rounded-lg border border-[#333]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-green-400">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span class="text-sm text-white">{{ profileData.validations }} Validations</span>
                  </div>
                  <div v-if="profileData.friend_counter" class="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f] rounded-lg border border-[#333]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-400">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span class="text-sm text-white">{{ profileData.friend_counter }} Friends</span>
                  </div>
                  <div v-if="profileData.likes" class="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f] rounded-lg border border-[#333]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-pink-400">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <span class="text-sm text-white">{{ profileData.likes }} Likes</span>
                  </div>
                  <div v-if="profileData.messenger_count !== undefined && profileData.messenger_count !== null" class="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f] rounded-lg border border-[#333]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-cyan-400">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span class="text-sm text-white">{{ profileData.messenger_count }} Messages</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bio -->
          <div v-if="profileData.profile_description" class="mb-6 bg-[#0f0f0f] rounded-xl p-6 border border-[#333]">
            <h4 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-400">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-purple-400">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
              Details
            </h4>
            <div class="overflow-x-auto w-full">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b-2 border-[#333]">
                    <th class="text-left py-3 px-4 text-[#999] font-semibold"></th>
                    <th class="text-left py-3 px-4 text-pink-400 font-semibold text-base">{{ getGenderLabel(profileData.gender1) }}</th>
                    <th class="text-left py-3 px-4 text-blue-400 font-semibold text-base">{{ getGenderLabel(profileData.gender2) }}</th>
                  </tr>
                </thead>
                <tbody class="text-white">
                  <tr class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Age</td>
                    <td class="py-3 px-4 text-pink-300 font-medium">{{ profileData.g1_age || '-' }}</td>
                    <td class="py-3 px-4 text-blue-300 font-medium">{{ profileData.g2_age || '-' }}</td>
                  </tr>
                  <tr v-if="profileData.hair_color || profileData.hair_length" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Hair</td>
                    <td class="py-3 px-4 text-pink-300">{{ combineHair(profileData.hair_color, profileData.hair_length)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ combineHair(profileData.hair_color, profileData.hair_length)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.body_hair" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Body Hair</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.body_hair)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.body_hair)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.height" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Height</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.height)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.height)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.weight" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Weight</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.weight)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.weight)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.body_type" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Body Type</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.body_type)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.body_type)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.race" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Ethnic Background</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.race)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.race)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.smoke" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Smoking</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.smoke)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.smoke)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.piercings" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Piercings</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.piercings)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.piercings)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.tattoos" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Tattoos</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.tattoos)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.tattoos)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.languages" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Languages</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.languages)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.languages)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.look_imp" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Looks Importance</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.look_imp)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.look_imp)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.inte_imp" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Intelligence Importance</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.inte_imp)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.inte_imp)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.sexuality" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Sexuality</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.sexuality)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.sexuality)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.relationship" class="border-b border-[#333]/50 hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Relationship</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.relationship)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.relationship)[1] }}</td>
                  </tr>
                  <tr v-if="profileData.experience" class="hover:bg-[#1a1a1a] transition-colors">
                    <td class="py-3 px-4 text-[#999] font-medium">Experience</td>
                    <td class="py-3 px-4 text-pink-300">{{ splitValue(profileData.experience)[0] }}</td>
                    <td class="py-3 px-4 text-blue-300">{{ splitValue(profileData.experience)[1] }}</td>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-400">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
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
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-[#666]">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  </div>
                  <!-- Play overlay -->
                  <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="white" class="drop-shadow-lg">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
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
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-[#666] mb-2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-green-400">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              Albums
            </h4>
            <div v-if="profileData.photoalbum_list && profileData.photoalbum_list.length > 0" class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div
              v-for="album in profileData.photoalbum_list"
              :key="album.id"
              @click="handleAlbumClick(album)"
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
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-[#666]">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                </div>
                <div v-if="album.password === 1" class="absolute top-2 right-2 bg-black/50 rounded px-2 py-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-white">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-green-400">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Validaties
            </h4>
            <div v-if="profileData.my_validations && profileData.my_validations.length > 0" class="space-y-4">
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
                    <span v-if="validation.lifetime_status" class="text-yellow-400 text-xs">⭐</span>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-orange-400">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-red-400">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-yellow-400">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-400">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <path d="M20 8v6"></path>
                <path d="M23 11h-6"></path>
              </svg>
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
                  <span v-if="follow.lifetime_status" class="text-yellow-400 text-xs">⭐</span>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-400">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
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
                    <span v-if="friend.lifetime_status" class="text-yellow-400 text-xs">⭐</span>
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
      @close="handleCloseGalleryModal"
      @open-lightbox="handleOpenLightbox"
      @open-video-lightbox="handleOpenVideoLightbox"
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

