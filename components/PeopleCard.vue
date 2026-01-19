<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import type { OnlineV2Member, ViewedV2Member } from '@/lib/sdc-api-types';

interface Props {
  member: OnlineV2Member | ViewedV2Member;
  isOnline?: boolean;
}

const props = defineProps<Props>();

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

// Handle card click
const handleClick = () => {
  const profileDialog = (window as any).__sdcBoostOpenProfileDialog;
  if (profileDialog && props.member.db_id) {
    profileDialog(props.member.db_id);
  } else {
    window.open(`https://www.sdc.com/react/#/profile?idUser=${props.member.db_id}`, '_blank');
  }
};

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

// Looking for icons type
type LookingForIcon = 
  | { type: 'couple-group'; icons: Array<{ icon: string; color: string }> }
  | { type: 'single-female' | 'single-male' | 'transgender'; icon: string; color: string };

// Parse summary_int to get looking for icons
const lookingForIcons = computed((): LookingForIcon[] => {
  if (!props.member.summary_int) return [];
  
  const e = props.member.summary_int.split('');
  const icons: LookingForIcon[] = [];
  
  // Couple Male-Female (blue + pink)
  if (e[0] === '1') {
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#3a97fe' }, // Blue for male
        { icon: 'fa6-solid:person', color: '#ff60df' }, // Pink for female
      ],
    });
  }
  
  // Couple Female-Female (pink + pink)
  if (e[1] === '1') {
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#ff60df' }, // Pink
        { icon: 'fa6-solid:person', color: '#ff60df' }, // Pink
      ],
    });
  }
  
  // Couple Male-Male (blue + blue)
  if (e[2] === '1') {
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#3a97fe' }, // Blue
        { icon: 'fa6-solid:person', color: '#3a97fe' }, // Blue
      ],
    });
  }
  
  // Single Male (blue)
  if (e[3] === '1') {
    icons.push({
      type: 'single-male',
      icon: 'fa6-solid:person',
      color: '#3a97fe',
    });
  }
  
  // Single Female (pink)
  if (e[4] === '1') {
    icons.push({
      type: 'single-female',
      icon: 'fa6-solid:person',
      color: '#ff60df',
    });
  }
  
  // Transgender
  if (e[5] === '1') {
    icons.push({
      type: 'transgender',
      icon: 'fa6-solid:person',
      color: '#9ca3af', // Gray for transgender
    });
  }
  
  return icons;
});
</script>

<template>
  <div class="card" @click="handleClick">
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
        <div v-if="hasLifetimeStatus" class="badge badge-lifetime" title="Lifetime Member">
          <Icon icon="mdi:star" width="12" height="12" />
        </div>
        <div v-if="hasSpeedDating" class="badge badge-speed" title="Speed Date">
          <Icon icon="mdi:lightning-bolt" width="12" height="12" />
        </div>
      </div>
      
      <!-- Timed -->
      <div v-if="timedText && !isOnline" class="card-timed">{{ timedText }}</div>
      
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
  </div>
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

.badge {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  font-size: 10px;
  backdrop-filter: blur(8px);
}

.badge-lifetime {
  background: rgba(234, 179, 8, 0.85);
}

.badge-speed {
  background: rgba(139, 92, 246, 0.85);
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
