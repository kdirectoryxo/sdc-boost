<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
}

const props = defineProps<Props>();

const receiver = computed(() => props.item.receiver);
const extraData = computed(() => props.item.extra_data);

const photoUrl = computed(() => {
  if (receiver.value?.primary_photo) {
    if (receiver.value.primary_photo.startsWith('http')) {
      return receiver.value.primary_photo;
    }
    return `https://pictures.sdc.com/photos/${receiver.value.primary_photo}`;
  }
  return null;
});

// Parse age string (format: "35|32" or similar)
const parseAge = () => {
  if (!receiver.value?.age) return { first: null, second: null };
  const parts = receiver.value.age.split('|');
  return {
    first: parts[0]?.trim() || null,
    second: parts[1]?.trim() || null,
  };
};

const ages = computed(() => parseAge());

// Check if gender2 is a real person (not a placeholder)
// Gender2 is not real if age is > 100, undefined, or < 18
const isGender2Real = computed(() => {
  if (!ages.value.second) return false;
  const g2Age = parseInt(ages.value.second, 10);
  // If age is > 100 or < 18, it's not a real person
  return !isNaN(g2Age) && g2Age <= 100 && g2Age >= 18;
});

// Get age color based on gender (1 = female = pink, 0 = male = blue)
const getAgeColor = (gender: number | undefined) => {
  return gender === 1 ? 'rgb(255, 96, 223)' : 'rgb(58, 151, 254)';
};

// Check if first person has birthday
const hasBirthdayFirst = computed(() => {
  const birthdayFor = receiver.value?.birthday_for;
  if (!birthdayFor) return false;
  const parts = birthdayFor.split('|');
  return parts[0] === '1' && receiver.value?.gender1 === 1;
});

// Check if second person has birthday
const hasBirthdaySecond = computed(() => {
  const birthdayFor = receiver.value?.birthday_for;
  if (!birthdayFor) return false;
  const parts = birthdayFor.split('|');
  return parts[1] === '1' && receiver.value?.gender2 === 1;
});

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  // Return date as-is in MM/DD/YYYY format
  return dateStr.trim();
};

// Format all available dates
const formatAvailableDates = () => {
  const availableDays = extraData.value?.AvailableDays;
  if (!availableDays) return '';
  
  // Split by comma and filter out empty strings
  const dates = availableDays.split(',').filter((d: string) => d.trim());
  if (dates.length === 0) return '';
  
  // Format each date and join with " - "
  const formattedDates = dates.map((date: string) => formatDate(date.trim())).filter((d: string) => d);
  return formattedDates.join(' - ');
};

const availableDates = computed(() => formatAvailableDates());

const formatDistance = (km: number | undefined) => {
  if (!km) return '';
  return `${km} km`;
};

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

// Interests for left side (profile) - use summary_int
const profileInterests = computed(() => {
  const interestsStr = receiver.value?.summary_int || '';
  return parseInterests(interestsStr);
});

// Interests for right side (MET section) - use extra_data.interests
// For action 8, interests is in extra_data.interests
// For action 904, interests might be in extra_data.interests or elsewhere
const metInterests = computed(() => {
  const interestsStr = extraData.value?.interests || '';
  return parseInterests(interestsStr);
});

// Get interests icons for profile (left side) - normalize all to same size
// Only show couple icons if gender2 is real, otherwise filter them out
const profileInterestsIcons = computed(() => {
  const icons: Array<{ type: string; url: string; width: number; height: number }> = [];
  
  // Only show couple icons if this is actually a couple (gender2 is real)
  if (isGender2Real.value && profileInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple',
      url: 'https://www.sdc.com/react/assets/couple_male_female_icon.a2db86e4.svg',
      width: 14, // Original width
      height: 20, // Normalized height
    });
  }
  
  // Only show single icons if this is actually a single profile (gender2 is not real)
  if (!isGender2Real.value) {
    if (profileInterests.value.singleFemale) {
      icons.push({
        type: 'single-female',
        url: 'https://www.sdc.com/react/assets/single_female_icon.e150c7be.svg',
        width: 24, // Original width
        height: 20, // Normalized height
      });
    }
    
    if (profileInterests.value.singleMale) {
      icons.push({
        type: 'single-male',
        url: 'https://www.sdc.com/react/assets/single_male_icon.6eca46f8.svg',
        width: 20, // Original width
        height: 20, // Normalized height
      });
    }
  }
  
  return icons;
});

// Get interests icons for MET section (right side) - normalize all to same size
// MET section shows what they're looking for, so show all interests regardless of profile type
const metInterestsIcons = computed(() => {
  const icons: Array<{ type: string; url: string; width: number; height: number }> = [];
  
  if (metInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple',
      url: 'https://www.sdc.com/react/assets/couple_male_female_icon.a2db86e4.svg',
      width: 14, // Original width
      height: 20, // Normalized height
    });
  }
  
  if (metInterests.value.singleFemale) {
    icons.push({
      type: 'single-female',
      url: 'https://www.sdc.com/react/assets/single_female_icon.e150c7be.svg',
      width: 24, // Original width
      height: 20, // Normalized height
    });
  }
  
  if (metInterests.value.singleMale) {
    icons.push({
      type: 'single-male',
      url: 'https://www.sdc.com/react/assets/single_male_icon.6eca46f8.svg',
      width: 20, // Original width
      height: 20, // Normalized height
    });
  }
  
  return icons;
});

// Decode HTML entities (handles both &#39; and &#39 without semicolon)
const decodeHtmlEntities = (text: string) => {
  if (!text) return '';
  // First fix incomplete entities (like &#39 without semicolon)
  let fixed = text.replace(/&#(\d+)(?!;)/g, '&#$1;');
  // Then decode using textarea method
  const textarea = document.createElement('textarea');
  textarea.innerHTML = fixed;
  return textarea.value;
};

// Check if this is action 8 (Vrienden speed dating) vs 904 (Algemeen speed dating)
const isAction8 = computed(() => props.item.action === 8);

// Get message content - prefer body, but if PlaceToMeet exists and is different, show both
// For action 8, use personal_text from extra_data
const messageContent = computed(() => {
  let content = '';
  
  // For action 8, use personal_text
  if (isAction8.value && extraData.value?.personal_text) {
    content = extraData.value.personal_text;
  } else if (extraData.value?.PlaceToMeet && extraData.value.PlaceToMeet !== props.item.body) {
    content = extraData.value.PlaceToMeet;
  } else {
    content = props.item.body || '';
  }
  // Decode HTML entities
  return decodeHtmlEntities(content);
});

// Get date string - for action 8, use date_list from extra_data
const speedDatingDate = computed(() => {
  if (isAction8.value && extraData.value?.date_list) {
    // date_list format: "Jan 17,2026 | " - remove trailing " | "
    return extraData.value.date_list.replace(/\s*\|\s*$/, '').trim();
  }
  return availableDates.value;
});

// Get location - for action 8, use location from extra_data
const speedDatingLocation = computed(() => {
  if (isAction8.value && extraData.value?.location) {
    return extraData.value.location;
  }
  return extraData.value?.location || '';
});

// Get distance - for action 8, use how_far from extra_data
const speedDatingDistance = computed(() => {
  if (isAction8.value && extraData.value?.how_far !== undefined) {
    return extraData.value.how_far;
  }
  return extraData.value?.distance;
});
</script>

<template>
  <div :class="['newsfeed-card', `newsfeed-card-${props.index !== undefined && props.index % 2 === 0 ? 'even' : 'odd'}`]">
    <!-- Header -->
    <div class="newsfeed-card-header">
      <p class="newsfeed-card-header-text">
        Nieuwe speed date in jouw omgeving
      </p>
      <p class="newsfeed-card-header-time">{{ item.timed }}</p>
    </div>

    <!-- Content -->
    <div class="newsfeed-card-content">
      <!-- Left: Profile Info -->
      <div class="newsfeed-card-section">
        <div class="newsfeed-card-profile">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            :alt="receiver?.account_id"
            class="newsfeed-card-profile-img"
          />
          <div class="newsfeed-card-profile-info">
            <p class="newsfeed-card-profile-name">{{ receiver?.account_id }}</p>
            
            <!-- Age with colors and birthday icon -->
            <div v-if="ages.first || (ages.second && isGender2Real)" class="newsfeed-card-age">
              <div class="newsfeed-card-age-row">
                <span 
                  v-if="ages.first" 
                  class="newsfeed-card-age-first"
                  :style="{ color: getAgeColor(receiver?.gender1) }"
                >
                  {{ ages.first }}
                </span>
                <span v-if="ages.first && ages.second && isGender2Real" class="newsfeed-card-age-separator"> | </span>
                <span 
                  v-if="ages.second && isGender2Real" 
                  class="newsfeed-card-age-second"
                  :style="{ color: getAgeColor(receiver?.gender2) }"
                >
                  {{ ages.second }}
                </span>
              </div>
              <div v-if="hasBirthdayFirst || hasBirthdaySecond" class="newsfeed-card-birthday-row">
                <img 
                  v-if="hasBirthdayFirst" 
                  src="https://www.sdc.com/react/assets/female_birthday_icon.fe78472e.svg" 
                  alt="cake" 
                  title="Is jarig"
                  class="newsfeed-card-birthday-icon"
                />
                <img 
                  v-if="hasBirthdaySecond" 
                  src="https://www.sdc.com/react/assets/female_birthday_icon.fe78472e.svg" 
                  alt="cake" 
                  title="Is jarig"
                  class="newsfeed-card-birthday-icon"
                />
              </div>
            </div>

            <!-- Device Icons -->
            <div v-if="receiver?.is_web_user || receiver?.speed || receiver?.online" class="newsfeed-card-device-icons">
              <img 
                v-if="receiver?.is_web_user" 
                src="https://www.sdc.com/react/assets/web_user_icon.d5f27f46.svg" 
                alt="is-web-user" 
                class="newsfeed-card-device-icon"
                title="Web-gebruiker"
              />
              <img 
                v-if="receiver?.speed" 
                src="https://www.sdc.com/react/assets/speed_white.3176d40b.svg" 
                alt="is-speed-date" 
                class="newsfeed-card-device-icon"
                title="Speed Date"
              />
              <img 
                v-if="receiver?.online === 1" 
                src="https://www.sdc.com/react/assets/messenger_online_icon.0a87dd19.svg" 
                alt="user-is-online" 
                class="newsfeed-card-device-icon"
                title="Chat nu"
              />
            </div>

            <!-- Stats with icons -->
            <div class="newsfeed-card-profile-stats">
              <div v-if="receiver?.photo_count" class="newsfeed-card-stat">
                <img src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg" alt="Foto's" class="newsfeed-card-stat-icon" />
                <span>{{ receiver.photo_count }}</span>
              </div>
              <div v-if="receiver?.video_count" class="newsfeed-card-stat">
                <img src="https://www.sdc.com/react/assets/videos_white_icon.67fc13b6.svg" alt="Video's" class="newsfeed-card-stat-icon" />
                <span>{{ receiver.video_count }}</span>
              </div>
              <div v-if="receiver?.valid_count" class="newsfeed-card-stat">
                <img src="https://www.sdc.com/react/assets/validate_grid_card.d90f25d9.svg" alt="Validaties" class="newsfeed-card-stat-icon" />
                <span>{{ receiver.valid_count }}</span>
              </div>
              <div v-if="receiver?.likes_count" class="newsfeed-card-stat">
                <img src="https://www.sdc.com/react/assets/like_grid_card.c46847a1.svg" alt="Likes" class="newsfeed-card-stat-icon" />
                <span>{{ receiver.likes_count }}</span>
              </div>
            </div>

            <!-- Location -->
            <div v-if="receiver?.location" class="newsfeed-card-profile-location">
              <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="newsfeed-card-location-icon" />
              <span>{{ receiver.location }}</span>
              <span v-if="item.location_how_far" class="newsfeed-card-profile-location-distance">
                {{ formatDistance(item.location_how_far) }}
              </span>
            </div>

            <!-- Interests -->
            <div v-if="profileInterestsIcons.length > 0" class="newsfeed-card-interests">
              <p class="newsfeed-card-interests-label">Interesses</p>
              <div class="newsfeed-card-interests-icons">
                <img 
                  v-for="(icon, index) in profileInterestsIcons" 
                  :key="index"
                  :src="icon.url" 
                  :alt="icon.type"
                  class="newsfeed-card-interests-icon"
                  :style="{ width: `${icon.width}px`, height: `${icon.height}px` }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Speed Dating Details -->
      <div class="newsfeed-card-section">
        <div class="newsfeed-card-party-info">
          <p class="newsfeed-card-party-type">Privé locatie</p>
          <div v-if="speedDatingDate" class="newsfeed-card-party-title-row">
            <p class="newsfeed-card-party-title">{{ isAction8 ? 'WANNEER:' : 'Beschikbaar' }}</p>
            <p class="newsfeed-card-party-date-inline">
              {{ speedDatingDate }}
              <span v-if="isAction8 && speedDatingLocation" style="color: #6b7280; margin-left: 4px;">
                at {{ speedDatingLocation }}
              </span>
            </p>
          </div>
          
          <!-- Message Content (only show once) -->
          <div v-if="messageContent" class="newsfeed-card-message">
            <p class="newsfeed-card-message-text">{{ messageContent }}</p>
          </div>

          <!-- Location and Distance (for action 904, not action 8) -->
          <div v-if="!isAction8 && speedDatingLocation" class="newsfeed-card-party-location">
            <div class="newsfeed-card-party-location-text">
              <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="newsfeed-card-location-icon-small" />
              <span>{{ speedDatingLocation }}</span>
            </div>
            <span v-if="speedDatingDistance !== undefined" class="newsfeed-card-party-distance">
              {{ formatDistance(speedDatingDistance) }}
            </span>
          </div>

          <!-- Interests for speed date -->
          <div v-if="metInterestsIcons.length > 0" class="newsfeed-card-party-interests">
            <p class="newsfeed-card-party-interests-label">MET:</p>
            <div class="newsfeed-card-party-interests-icons">
              <img 
                v-for="(icon, index) in metInterestsIcons" 
                :key="index"
                :src="icon.url" 
                :alt="icon.type"
                class="newsfeed-card-interests-icon"
                :style="{ width: `${icon.width}px`, height: `${icon.height}px` }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.newsfeed-card {
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-left: 3px solid rgba(168, 85, 247, 0.4);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s ease;
  position: relative;
}

.newsfeed-card-even {
  background-color: rgba(255, 255, 255, 0.025);
}

.newsfeed-card-odd {
  background-color: rgba(255, 255, 255, 0.035);
}

.newsfeed-card:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  border-left-color: rgba(168, 85, 247, 0.6);
}

.newsfeed-card-header {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.02);
}

.newsfeed-card-header-text {
  color: white;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: -0.01em;
}

.newsfeed-card-header-time {
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
}

.newsfeed-card-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 12px 14px;
}

@media (min-width: 768px) {
  .newsfeed-card-content {
    grid-template-columns: 1fr 1fr;
  }
}

.newsfeed-card-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.newsfeed-card-profile {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.newsfeed-card-profile-img {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  object-fit: cover;
  border: 2px solid rgba(168, 85, 247, 0.6);
  flex-shrink: 0;
}

.newsfeed-card-profile-info {
  flex: 1;
}

.newsfeed-card-profile-name {
  color: white;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 4px;
  letter-spacing: -0.01em;
}

.newsfeed-card-age {
  font-size: 11px;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.newsfeed-card-age-row {
  display: inline-block;
  white-space: nowrap;
}

.newsfeed-card-age-first {
  font-weight: 600;
}

.newsfeed-card-age-separator {
  color: rgba(255, 255, 255, 0.4);
  margin: 0 3px;
}

.newsfeed-card-age-second {
  font-weight: 600;
}

.newsfeed-card-birthday-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.newsfeed-card-birthday-icon {
  width: 12px;
  height: 12px;
}

.newsfeed-card-device-icons {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  float: right;
}

.newsfeed-card-device-icon {
  width: 14px;
  height: 14px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.newsfeed-card-device-icon:hover {
  opacity: 1;
}

.newsfeed-card-profile-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.newsfeed-card-stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #9ca3af;
}

.newsfeed-card-stat-icon {
  width: 14px;
  height: 14px;
  opacity: 0.8;
}

.newsfeed-card-profile-location {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 10px;
  color: #9ca3af;
}

.newsfeed-card-location-icon {
  width: 12px;
  height: 12px;
  opacity: 0.7;
}

.newsfeed-card-location-icon-small {
  width: 12px;
  height: 12px;
  opacity: 0.7;
}

.newsfeed-card-profile-location-distance {
  margin-left: 4px;
  color: #6b7280;
}

.newsfeed-card-interests {
  margin-top: 6px;
}

.newsfeed-card-interests-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.newsfeed-card-interests-icons {
  display: flex;
  align-items: center;
  gap: 5px;
}

.newsfeed-card-interests-icon {
  display: inline-block;
  object-fit: contain;
  flex-shrink: 0;
}

.newsfeed-card-party-info {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.newsfeed-card-party-type {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.newsfeed-card-party-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.newsfeed-card-party-title {
  color: white;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: -0.01em;
  line-height: 1.4;
  flex: 1;
  min-width: 0;
}

.newsfeed-card-party-date-inline {
  color: #9ca3af;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.newsfeed-card-message {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  border-left: 2px solid rgba(59, 130, 246, 0.4);
}

.newsfeed-card-message-text {
  color: #e5e7eb;
  font-size: 11px;
  line-height: 1.5;
}

.newsfeed-card-party-location {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.newsfeed-card-party-location-text {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #9ca3af;
}

.newsfeed-card-party-distance {
  font-size: 10px;
  color: #6b7280;
  font-weight: 500;
}

.newsfeed-card-party-interests {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.newsfeed-card-party-interests-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.newsfeed-card-party-interests-icons {
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>
