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
  /** When set (no `profileHref`), called instead of the global profile dialog hook. */
  openProfile?: (userId: number) => void;
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

  if (props.openProfile) {
    props.openProfile(id);
    return;
  }
  const w = window as unknown as { __sdcBoostOpenProfileDialog?: (uid: number) => void };
  const profileDialog = w.__sdcBoostOpenProfileDialog;
  if (profileDialog) {
    profileDialog(id);
  } else {
    window.open(`https://www.sdc.com/react/#/profile?idUser=${id}`, '_blank');
  }
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
    class="card"
    @click="handleClick"
  >
    <!-- Photo -->
    <div class="card-photo">
      <img 
        :key="`${member.db_id}-${imageError}`"
        :src="displayImageUrl" 
        :alt="member.account_id" 
        @error="handleImageError" 
      />
      
      <!-- Online indicator -->
      <div v-if="member.online === 1" class="card-online"></div>
      
      <!-- Badges -->
      <div class="card-badges">
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
      <div v-if="timedText && !isOnline && !liveVoyeur" class="card-timed">{{ timedText }}</div>

      <!-- Live voyeur: watchers + stream duration (voyeur_cam_list_v2) -->
      <div
        v-if="liveVoyeur && (liveWatchCount != null || liveTimedFormatted)"
        class="card-live-voyeur"
      >
        <span v-if="liveWatchCount != null" class="card-live-voyeur-stat">
          <Icon icon="mdi:eye-outline" width="12" height="12" />
          {{ liveWatchCount }}
        </span>
        <span v-if="liveTimedFormatted" class="card-live-voyeur-time">{{ liveTimedFormatted }}</span>
      </div>
      
      <!-- Device -->
      <div v-if="member.is_app_user || member.is_web_user" class="card-device">
        <Icon v-if="member.is_app_user" icon="mdi:cellphone" width="12" height="12" />
        <Icon v-if="member.is_web_user" icon="mdi:monitor" width="12" height="12" />
      </div>
    </div>

    <!-- Info -->
    <div class="card-info" :style="{ borderTop: `3px solid ${profileTypeColor}` }">
      <!-- Name row -->
      <div class="card-row">
        <span class="card-name">{{ member.account_id }}</span>
        <!-- Looking For Icons -->
        <div v-if="lookingForIcons.length > 0" class="card-looking-for">
          <template v-for="(item, index) in lookingForIcons" :key="index">
            <div v-if="item.type === 'couple-group'" class="looking-for-couple">
              <Icon 
                v-for="(icon, i) in item.icons" 
                :key="i"
                :icon="icon.icon"
                width="12"
                height="12"
                :style="{ 
                  color: icon.color,
                  marginLeft: i === 1 ? '-8px' : '0'
                }"
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
      <div class="card-row">
        <div class="card-ages">
          <span v-if="ages.first" :style="{ color: getAgeColor(member.gender1) }">{{ ages.first }}</span>
          <span v-if="ages.first && ages.second && isGender2Real" class="age-sep">|</span>
          <span v-if="ages.second && isGender2Real" :style="{ color: getAgeColor(member.gender2) }">{{ ages.second }}</span>
        </div>
        <span v-if="distanceText" class="card-distance">{{ distanceText }}</span>
      </div>
      
      <!-- Location -->
      <div v-if="locationText" class="card-location">
        <Icon icon="mdi:map-marker-outline" width="10" height="10" class="card-location-icon" />
        <span>{{ locationText }}</span>
      </div>

      <!-- Stats -->
      <div v-if="member.photo_count || member.likes_count || member.valid_count" class="card-stats">
        <span v-if="member.photo_count" class="stat">
          <Icon icon="mdi:image-outline" width="11" height="11" />
          {{ member.photo_count }}
        </span>
        <span v-if="member.likes_count" class="stat">
          <Icon icon="mdi:heart-outline" width="11" height="11" />
          {{ member.likes_count }}
        </span>
        <span v-if="member.valid_count" class="stat">
          <Icon icon="mdi:check-circle-outline" width="11" height="11" />
          {{ member.valid_count }}
        </span>
      </div>
    </div>
  </component>
</template>

<style scoped>
.card {
  background: #1a1d21;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

a.card {
  display: block;
  text-decoration: none;
  color: inherit;
  outline: none;
}

.card:hover {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

/* Photo */
.card-photo {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: #131517;
  overflow: hidden;
}

.card-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.card:hover .card-photo img {
  transform: scale(1.05);
}

.card-photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e2227 0%, #131517 100%);
  color: rgba(255, 255, 255, 0.3);
  font-size: 32px;
  font-weight: 700;
}

/* Online indicator */
.card-online {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 10px;
  height: 10px;
  background: #22c55e;
  border-radius: 50%;
  border: 2px solid #1a1d21;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
}

/* Badges */
.card-badges {
  position: absolute;
  top: 6px;
  left: 6px;
  display: flex;
  gap: 4px;
}

/* Live voyeur strip (watch count + duration) */
.card-live-voyeur {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px 7px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0.35) 55%, transparent 100%);
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

.card-live-voyeur-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.card-live-voyeur-time {
  font-weight: 500;
  opacity: 0.92;
}

/* Timed */
.card-timed {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 3px 6px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  border-radius: 4px;
  font-size: 9px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

/* Device */
.card-device {
  position: absolute;
  bottom: 6px;
  right: 6px;
  display: flex;
  gap: 3px;
  padding: 3px 5px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 4px;
}

.card-device .iconify {
  opacity: 0.9;
}

/* Info */
.card-info {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.card-name {
  font-size: 12px;
  font-weight: 600;
  color: white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.card-looking-for {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  flex-shrink: 0;
}

.card-ages {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  font-weight: 600;
}

.age-sep {
  color: rgba(255, 255, 255, 0.2);
  font-size: 11px;
}

.card-distance {
  font-size: 9px;
  font-weight: 500;
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
}

.card-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #6b7280;
  overflow: hidden;
}

.card-location-icon {
  flex-shrink: 0;
  color: #4b5563;
}

.card-location span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Stats */
.card-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #6b7280;
}

.stat svg {
  opacity: 0.6;
}

.card:hover .stat {
  color: #9ca3af;
}

.looking-for-couple {
  display: flex;
  align-items: center;
}
</style>
