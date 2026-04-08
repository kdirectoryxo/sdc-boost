<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import type { OnlineV2Member, ViewedV2Member } from '@/lib/sdc-api-types';
import { Badge } from '@/lib/view-router/ui/badge';
import { parseSummaryIntToLookingForIcons } from '@/lib/looking-for-icons';
import { formatVoyeurStreamDuration } from '@/lib/voyeur-timed';
import { getBoostProfilePath, navigateBoostViewRouterPath } from '@/lib/view-router/routes';

interface Props {
  member: OnlineV2Member | ViewedV2Member;
  isOnline?: boolean;
  /** Live hub: show voyeur `count_live` + `timed` on the photo (API from voyeur_cam_list_v2). */
  liveVoyeur?: boolean;
  /**
   * View-router: full page URL (`?sdc_boost_vr=/sdc/profile/…`). Renders a real `<a>` so
   * middle-click / ctrl+click open a new tab; plain click uses in-app navigation.
   */
  profileHref?: string;
}

const props = withDefaults(defineProps<Props>(), {
  liveVoyeur: false,
});

const liveWatchCount = computed(() => {
  const m = props.member as OnlineV2Member;
  if (typeof m.count_live === 'number' && m.count_live >= 0) {
    return m.count_live;
  }
  return null;
});

const liveTimedLabel = computed(() => {
  const m = props.member as OnlineV2Member;
  if (m.timed && String(m.timed).trim() !== '') {
    return String(m.timed).trim();
  }
  if ('timed' in props.member && props.member.timed) {
    return String(props.member.timed).trim();
  }
  return '';
});

/** Site-style duration: `4h 26m`, `42m` (from voyeur `timed`). */
const liveTimedFormatted = computed(() => formatVoyeurStreamDuration(liveTimedLabel.value));

// Parse age string (format: "35|32" or similar)
const parseAge = (ageStr: string | undefined) => {
  if (!ageStr) return { first: null, second: null };
  const parts = ageStr.split('|');
  return {
    first: parts[0]?.trim() || null,
    second: parts[1]?.trim() || null,
  };
};

const ages = computed(() => parseAge(props.member.age));

// Check if second person age is real
const isSecondAgeReal = (ageSecond: string | null) => {
  if (!ageSecond) return false;
  const age = parseInt(ageSecond, 10);
  return !isNaN(age) && age >= 18 && age <= 100;
};

const isGender2Real = computed(() => isSecondAgeReal(ages.value.second));

// Get age color based on gender
const getAgeColor = (gender: number | undefined) => {
  return gender === 1 ? '#ff60df' : '#3a97fe';
};

const FALLBACK_IMAGE_URL = 'https://www.sdc.com/react/assets/couple_male_female_silhouette.cae98680.svg';
const imageError = ref(false);

// Check if photo URL is valid (not empty or just thumbnail path)
const isValidPhoto = (photo: string | undefined): boolean => {
  if (!photo) return false;
  const trimmed = photo.trim();
  // Check if it's just '/thumbnail/' or ends with '/thumbnail/' or is empty
  if (trimmed === '' || trimmed === '/thumbnail/' || trimmed.endsWith('/thumbnail/')) {
    return false;
  }
  return true;
};

// Get photo URL
const photoUrl = computed(() => {
  if (!isValidPhoto(props.member.primary_photo)) {
    return null;
  }
  if (props.member.primary_photo!.startsWith('http')) {
    return props.member.primary_photo!;
  }
  return `https://pictures.sdc.com/photos/${props.member.primary_photo}`;
});

// Get display image URL (with fallback)
const displayImageUrl = computed(() => {
  // If no valid photo URL or error occurred, use fallback
  if (!photoUrl.value || imageError.value) {
    return FALLBACK_IMAGE_URL;
  }
  return photoUrl.value;
});

// Handle image error (including 403, 404, network errors, etc.)
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  // Prevent infinite loop - don't handle errors for the fallback image itself
  if (img && img.src && !img.src.includes('couple_male_female_silhouette')) {
    imageError.value = true;
  }
};

// Reset error when member changes
watch(() => props.member.db_id, () => {
  imageError.value = false;
});

// Format location
const locationText = computed(() => {
  return props.member.location || '';
});

const distanceText = computed(() => {
  const distance = 'location_how_far' in props.member ? props.member.location_how_far : 0;
  return distance > 0 ? `${distance} km` : '';
});

// Get timed text (for viewed members)
const timedText = computed(() => {
  if ('timed' in props.member && props.member.timed) {
    return props.member.timed;
  }
  return '';
});

// Check if member has lifetime status
const hasLifetimeStatus = computed(() => props.member.lifetime_status === true);

// Check if member has speed dating active
const hasSpeedDating = computed(() => props.member.speed === 1);

// Handle card click / link activation
function handleClick(e: MouseEvent) {
  const id = props.member.db_id;
  if (!id) return;

  if (props.profileHref) {
    // Middle-click and modified primary clicks: browser follows `href` (new tab)
    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigateBoostViewRouterPath(getBoostProfilePath(id));
    return;
  }

  navigateBoostViewRouterPath(getBoostProfilePath(id));
}

// Profile type indicator color
const profileTypeColor = computed(() => {
  const g1 = props.member.gender1;
  
  if (!isGender2Real.value) {
    // Single: blue for male, pink for female
    return g1 === 1 ? '#ff60df' : '#3a97fe';
  }
  
  // Couple: purple
  return '#a855f7';
});

const lookingForIcons = computed(() => parseSummaryIntToLookingForIcons(props.member.summary_int));
</script>

<template>
  <component
    :is="profileHref ? 'a' : 'div'"
    :href="profileHref || undefined"
    class="group cursor-pointer overflow-hidden rounded-[10px] border border-white/4 bg-[#1a1d21] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
    :class="profileHref ? 'block text-inherit no-underline outline-none' : ''"
    @click="handleClick"
  >
    <!-- Photo -->
    <div class="relative aspect-square w-full overflow-hidden bg-[#131517]">
      <img 
        :key="`${member.db_id}-${imageError}`"
        :src="displayImageUrl" 
        :alt="member.account_id" 
        class="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
        @error="handleImageError" 
      />
      
      <!-- Online indicator -->
      <div
        v-if="member.online === 1"
        class="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#1a1d21] bg-green-500 shadow-[0_0_0_2px_rgba(34,197,94,0.3)]"
      />
      
      <!-- Badges -->
      <div class="absolute left-1.5 top-1.5 flex gap-1">
        <Badge
          v-if="hasLifetimeStatus"
          variant="secondary"
          class="size-5 shrink-0 rounded-[5px] border-0 bg-[rgba(234,179,8,0.85)] p-0 text-white backdrop-blur-md hover:bg-[rgba(234,179,8,0.85)]"
          title="Lifetime Member"
        >
          <Icon icon="mdi:star" width="12" height="12" />
        </Badge>
        <Badge
          v-if="hasSpeedDating"
          variant="secondary"
          class="size-5 shrink-0 rounded-[5px] border-0 bg-[rgba(139,92,246,0.85)] p-0 text-white backdrop-blur-md hover:bg-[rgba(139,92,246,0.85)]"
          title="Speed Date"
        >
          <Icon icon="mdi:lightning-bolt" width="12" height="12" />
        </Badge>
      </div>
      
      <!-- Timed (viewed / non-online); live voyeur uses bottom overlay instead -->
      <div
        v-if="timedText && !isOnline && !liveVoyeur"
        class="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-md"
      >
        {{ timedText }}
      </div>

      <!-- Live voyeur: watchers + stream duration (voyeur_cam_list_v2) -->
      <div
        v-if="liveVoyeur && (liveWatchCount != null || liveTimedFormatted)"
        class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-[linear-gradient(to_top,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.35)_55%,transparent_100%)] px-2 pb-[7px] pt-1.5 text-[10px] font-semibold text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]"
      >
        <span v-if="liveWatchCount != null" class="inline-flex items-center gap-1">
          <Icon icon="mdi:eye-outline" width="12" height="12" />
          {{ liveWatchCount }}
        </span>
        <span v-if="liveTimedFormatted" class="font-medium opacity-90">{{ liveTimedFormatted }}</span>
      </div>
      
      <!-- Device -->
      <div
        v-if="member.is_app_user || member.is_web_user"
        class="absolute bottom-1.5 right-1.5 flex gap-[3px] rounded bg-black/60 px-[5px] py-[3px] backdrop-blur-md [&_svg]:opacity-90"
      >
        <Icon v-if="member.is_app_user" icon="mdi:cellphone" width="12" height="12" />
        <Icon v-if="member.is_web_user" icon="mdi:monitor" width="12" height="12" />
      </div>
    </div>

    <!-- Info -->
    <div
      class="flex flex-col gap-1 p-[10px]"
      :style="{ borderTop: `3px solid ${profileTypeColor}` }"
    >
      <!-- Name row -->
      <div class="flex flex-row items-center gap-1.5">
        <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-white">{{ member.account_id }}</span>
        <!-- Looking For Icons -->
        <div v-if="lookingForIcons.length > 0" class="ml-auto flex shrink-0 flex-row items-center gap-[3px]">
          <template v-for="(item, index) in lookingForIcons" :key="index">
            <div v-if="item.type === 'couple-group'" class="flex items-center">
              <Icon 
                v-for="(icon, i) in item.icons" 
                :key="i"
                :icon="icon.icon"
                width="12"
                height="12"
                :class="i === 1 ? '-ml-2' : ''"
                :style="{ color: icon.color }"
              />
            </div>
            <Icon 
              v-else
              :icon="item.icon"
              width="12"
              height="12"
              :style="{ color: item.color }"
            />
          </template>
        </div>
      </div>
      
      <!-- Age row -->
      <div class="flex flex-row items-center gap-1.5">
        <div class="flex items-center gap-[3px] text-[13px] font-semibold">
          <span v-if="ages.first" :style="{ color: getAgeColor(member.gender1) }">{{ ages.first }}</span>
          <span v-if="ages.first && ages.second && isGender2Real" class="text-[11px] text-white/20">|</span>
          <span v-if="ages.second && isGender2Real" :style="{ color: getAgeColor(member.gender2) }">{{ ages.second }}</span>
        </div>
        <span v-if="distanceText" class="rounded bg-blue-400/12 px-1.5 py-0.5 text-[9px] font-medium text-blue-400">{{ distanceText }}</span>
      </div>
      
      <!-- Location -->
      <div v-if="locationText" class="flex items-center gap-1 overflow-hidden text-[10px] text-gray-500">
        <Icon icon="mdi:map-marker-outline" width="10" height="10" class="shrink-0 text-gray-600" />
        <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ locationText }}</span>
      </div>

      <!-- Stats -->
      <div v-if="member.photo_count || member.likes_count || member.valid_count" class="mt-1 flex items-center gap-1 border-t border-white/4 pt-1.5">
        <span v-if="member.photo_count" class="flex items-center gap-[3px] text-[10px] text-gray-500 [&_svg]:opacity-60 group-hover:text-gray-400">
          <Icon icon="mdi:image-outline" width="11" height="11" />
          {{ member.photo_count }}
        </span>
        <span v-if="member.likes_count" class="flex items-center gap-[3px] text-[10px] text-gray-500 [&_svg]:opacity-60 group-hover:text-gray-400">
          <Icon icon="mdi:heart-outline" width="11" height="11" />
          {{ member.likes_count }}
        </span>
        <span v-if="member.valid_count" class="flex items-center gap-[3px] text-[10px] text-gray-500 [&_svg]:opacity-60 group-hover:text-gray-400">
          <Icon icon="mdi:check-circle-outline" width="11" height="11" />
          {{ member.valid_count }}
        </span>
      </div>
    </div>
  </component>
</template>
