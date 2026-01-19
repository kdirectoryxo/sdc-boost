<script lang="ts" setup>
import { computed } from 'vue';
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

// Check if second person age is real (not a placeholder)
const isSecondAgeReal = (ageSecond: string | null) => {
  if (!ageSecond) return false;
  const age = parseInt(ageSecond, 10);
  return !isNaN(age) && age >= 18 && age <= 100;
};

const isGender2Real = computed(() => isSecondAgeReal(ages.value.second));

// Get age color based on gender (1 = female = pink, 0 = male = blue)
const getAgeColor = (gender: number | undefined) => {
  return gender === 1 ? '#ff60df' : '#3a97fe';
};

// Get photo URL
const photoUrl = computed(() => {
  if (!props.member.primary_photo || props.member.primary_photo === '/thumbnail/') {
    return null;
  }
  if (props.member.primary_photo.startsWith('http')) {
    return props.member.primary_photo;
  }
  return `https://pictures.sdc.com/photos/${props.member.primary_photo}`;
});

// Format location with distance
const locationText = computed(() => {
  const location = props.member.location;
  const distance = 'location_how_far' in props.member ? props.member.location_how_far : 0;
  if (!location) return '';
  return location;
});

const distanceText = computed(() => {
  const distance = 'location_how_far' in props.member ? props.member.location_how_far : 0;
  if (distance > 0) {
    return `${distance} km`;
  }
  return '';
});

// Get timed text (for viewed members - shows when they viewed)
const timedText = computed(() => {
  if ('timed' in props.member && props.member.timed) {
    return props.member.timed;
  }
  return '';
});

// Check if member has lifetime status
const hasLifetimeStatus = computed(() => {
  return props.member.lifetime_status === true;
});

// Check if member has speed dating active
const hasSpeedDating = computed(() => {
  return props.member.speed === 1;
});

// Parse interests from summary_int (6 characters: Couple M/F, Couple F/F, Couple M/M, Single F, Single M, Transgender)
const parseInterests = (interests: string | undefined) => {
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
};

const interests = computed(() => parseInterests(props.member.summary_int));

// Get interests icons ("Op zoek naar")
const interestsIcons = computed(() => {
  const icons: Array<{ type: string; url: string; title: string }> = [];
  
  if (interests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple',
      url: 'https://www.sdc.com/react/assets/couple_male_female_icon.a2db86e4.svg',
      title: 'Stellen',
    });
  }
  
  if (interests.value.singleFemale) {
    icons.push({
      type: 'single-female',
      url: 'https://www.sdc.com/react/assets/single_female_icon.e150c7be.svg',
      title: 'Single vrouwen',
    });
  }
  
  if (interests.value.singleMale) {
    icons.push({
      type: 'single-male',
      url: 'https://www.sdc.com/react/assets/single_male_icon.6eca46f8.svg',
      title: 'Single mannen',
    });
  }
  
  return icons;
});

// Handle card click - open profile dialog
const handleClick = () => {
  // Access global profile dialog opener (set up in content.ts)
  const profileDialog = (window as any).__sdcBoostOpenProfileDialog;
  if (profileDialog && props.member.db_id) {
    profileDialog(props.member.db_id);
  } else {
    // Fallback: navigate to profile page
    window.open(`https://www.sdc.com/react/#/profile?idUser=${props.member.db_id}`, '_blank');
  }
};

// Determine profile type label
const profileTypeLabel = computed(() => {
  // gender1 + gender2 determines profile type
  // 1+0 = female + male = couple (F leads)
  // 0+1 = male + female = couple (M leads)
  // 1+1 = female + female = lesbian couple
  // 0+0 = male + male = gay couple
  // 1+2 = single female
  // 0+2 = single male
  const g1 = props.member.gender1;
  const g2 = props.member.gender2;
  
  if (!isGender2Real.value) {
    // Single
    return g1 === 1 ? 'Single vrouw' : 'Single man';
  }
  
  // Couple
  if (g1 === 1 && g2 === 0) return 'Stel';
  if (g1 === 0 && g2 === 1) return 'Stel';
  if (g1 === 1 && g2 === 1) return 'Lesbisch stel';
  if (g1 === 0 && g2 === 0) return 'Gay stel';
  
  return 'Stel';
});
</script>

<template>
  <div 
    class="people-card"
    @click="handleClick"
  >
    <!-- Photo Section -->
    <div class="people-card-photo-section">
      <img
        v-if="photoUrl"
        :src="photoUrl"
        :alt="member.account_id"
        class="people-card-photo"
      />
      <div v-else class="people-card-photo-placeholder">
        <span>{{ member.account_id?.charAt(0) || '?' }}</span>
      </div>
      
      <!-- Top left badges -->
      <div class="people-card-badges-left">
        <!-- Lifetime badge -->
        <div v-if="hasLifetimeStatus" class="people-card-badge people-card-badge-lifetime" title="Lifetime lid">
          <span>⭐</span>
        </div>
        <!-- Speed dating badge -->
        <div v-if="hasSpeedDating" class="people-card-badge people-card-badge-speed" title="Speed dating actief">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
      </div>
      
      <!-- Online Indicator -->
      <div v-if="member.online === 1" class="people-card-online-indicator" title="Online">
        <span class="people-card-online-pulse"></span>
      </div>
      
      <!-- Timed badge (when they viewed - for viewed tab) -->
      <div v-if="timedText && !isOnline" class="people-card-timed">
        {{ timedText }}
      </div>
      
      <!-- Device Icons -->
      <div class="people-card-device-icons">
        <img
          v-if="member.is_web_user"
          src="https://www.sdc.com/react/assets/web_user_icon.d5f27f46.svg"
          alt="Web user"
          class="people-card-device-icon"
          title="Web gebruiker"
        />
        <img
          v-if="member.is_app_user"
          src="https://www.sdc.com/react/assets/mobile_user_icon.07eafea0.svg"
          alt="App user"
          class="people-card-device-icon"
          title="App gebruiker"
        />
      </div>
    </div>

    <!-- Info Section -->
    <div class="people-card-info">
      <!-- Header row: Name + Profile type -->
      <div class="people-card-header">
        <h3 class="people-card-name">{{ member.account_id }}</h3>
        <span class="people-card-type">{{ profileTypeLabel }}</span>
      </div>
      
      <!-- Age with colors -->
      <div class="people-card-age-row">
        <div v-if="ages.first || (ages.second && isGender2Real)" class="people-card-age">
          <span 
            v-if="ages.first" 
            class="people-card-age-value"
            :style="{ color: getAgeColor(member.gender1) }"
          >
            {{ ages.first }}
          </span>
          <span v-if="ages.first && ages.second && isGender2Real" class="people-card-age-separator">|</span>
          <span 
            v-if="ages.second && isGender2Real" 
            class="people-card-age-value"
            :style="{ color: getAgeColor(member.gender2) }"
          >
            {{ ages.second }}
          </span>
        </div>
        
        <!-- Interests icons (Op zoek naar) -->
        <div v-if="interestsIcons.length > 0" class="people-card-interests">
          <img
            v-for="icon in interestsIcons"
            :key="icon.type"
            :src="icon.url"
            :alt="icon.title"
            :title="icon.title"
            class="people-card-interest-icon"
          />
        </div>
      </div>

      <!-- Location row -->
      <div v-if="locationText" class="people-card-location-row">
        <div class="people-card-location">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="people-card-location-icon">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>{{ locationText }}</span>
        </div>
        <span v-if="distanceText" class="people-card-distance">{{ distanceText }}</span>
      </div>

      <!-- Stats Row -->
      <div class="people-card-stats">
        <div v-if="member.photo_count" class="people-card-stat" title="Foto's">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span>{{ member.photo_count }}</span>
        </div>
        <div v-if="member.likes_count" class="people-card-stat" title="Likes">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <span>{{ member.likes_count }}</span>
        </div>
        <div v-if="'follows_counter' in member && member.follows_counter" class="people-card-stat" title="Volgers">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>{{ member.follows_counter }}</span>
        </div>
        <div v-if="member.valid_count" class="people-card-stat" title="Validaties">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>{{ member.valid_count }}</span>
        </div>
        <div v-if="member.video_count" class="people-card-stat" title="Video's">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          <span>{{ member.video_count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.people-card {
  background: linear-gradient(145deg, #1e1e1e 0%, #151515 100%);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.people-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.4);
}

.people-card-photo-section {
  position: relative;
  width: 100%;
  height: 180px;
  background-color: #1a1a1a;
  overflow: hidden;
}

.people-card-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.people-card:hover .people-card-photo {
  transform: scale(1.05);
}

.people-card-photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
  color: rgba(255, 255, 255, 0.4);
  font-size: 40px;
  font-weight: 700;
}

/* Badges container - top left */
.people-card-badges-left {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 6px;
  z-index: 2;
}

.people-card-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  font-size: 12px;
  backdrop-filter: blur(8px);
}

.people-card-badge-lifetime {
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.9) 0%, rgba(161, 98, 7, 0.9) 100%);
  box-shadow: 0 2px 8px rgba(234, 179, 8, 0.3);
}

.people-card-badge-speed {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(109, 40, 217, 0.9) 100%);
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
  color: white;
}

.people-card-badge-speed svg {
  fill: currentColor;
}

/* Online indicator - top right */
.people-card-online-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 14px;
  height: 14px;
  background-color: #22c55e;
  border-radius: 50%;
  border: 2px solid #151515;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
  z-index: 2;
}

.people-card-online-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background-color: rgba(34, 197, 94, 0.4);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.5);
    opacity: 0;
  }
}

/* Timed badge - for viewed members */
.people-card-timed {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  border-radius: 6px;
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  z-index: 2;
}

/* Device icons */
.people-card-device-icons {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 4px 6px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 6px;
  z-index: 2;
}

.people-card-device-icon {
  width: 14px;
  height: 14px;
  opacity: 0.9;
}

/* Info section */
.people-card-info {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  background: linear-gradient(180deg, rgba(30, 30, 30, 0) 0%, rgba(20, 20, 20, 1) 100%);
}

/* Header with name and type */
.people-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.people-card-name {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.people-card-type {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Age row with interests */
.people-card-age-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.people-card-age {
  display: flex;
  align-items: center;
  gap: 4px;
}

.people-card-age-value {
  font-size: 15px;
  font-weight: 600;
}

.people-card-age-separator {
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
}

.people-card-interests {
  display: flex;
  gap: 2px;
  align-items: center;
  padding: 3px 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.people-card-interest-icon {
  width: 16px;
  height: 14px;
  opacity: 0.85;
}

/* Location row */
.people-card-location-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.people-card-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  min-width: 0;
  overflow: hidden;
}

.people-card-location span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.people-card-location-icon {
  flex-shrink: 0;
  color: #60a5fa;
  opacity: 0.8;
}

.people-card-distance {
  font-size: 10px;
  font-weight: 500;
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.15);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Stats row */
.people-card-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.people-card-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  transition: color 0.2s ease;
}

.people-card-stat svg {
  width: 13px;
  height: 13px;
  opacity: 0.6;
  flex-shrink: 0;
}

.people-card:hover .people-card-stat {
  color: rgba(255, 255, 255, 0.8);
}

.people-card:hover .people-card-stat svg {
  opacity: 0.8;
}
</style>
