<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
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

// Get message content - prefer body, but if PlaceToMeet exists and is different, show both
const messageContent = computed(() => {
  // If PlaceToMeet exists and is different from body, use PlaceToMeet
  // Otherwise use body
  if (extraData.value?.PlaceToMeet && extraData.value.PlaceToMeet !== props.item.body) {
    return extraData.value.PlaceToMeet;
  }
  return props.item.body || '';
});
</script>

<template>
  <div class="newsfeed-card">
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
          <p v-if="availableDates" class="newsfeed-card-party-title">
            {{ availableDates }}
          </p>
          
          <!-- Message Content (only show once) -->
          <div v-if="messageContent" class="newsfeed-card-message">
            <p class="newsfeed-card-message-text">{{ messageContent }}</p>
          </div>

          <!-- Location and Distance -->
          <div v-if="extraData?.location" class="newsfeed-card-party-location">
            <div class="newsfeed-card-party-location-text">
              <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="newsfeed-card-location-icon-small" />
              <span>{{ extraData.location }}</span>
            </div>
            <span v-if="extraData?.distance" class="newsfeed-card-party-distance">
              {{ formatDistance(extraData.distance) }}
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
  background-color: #1f1f1f;
  border-radius: 8px;
  border: 1px solid #333;
  overflow: hidden;
}

.newsfeed-card-header {
  padding: 12px 16px;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.newsfeed-card-header-text {
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.newsfeed-card-header-time {
  color: #9ca3af;
  font-size: 12px;
}

.newsfeed-card-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 16px;
}

@media (min-width: 768px) {
  .newsfeed-card-content {
    grid-template-columns: 1fr 1fr;
  }
}

.newsfeed-card-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.newsfeed-card-profile {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.newsfeed-card-profile-img {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
}

.newsfeed-card-profile-info {
  flex: 1;
}

.newsfeed-card-profile-name {
  color: white;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.newsfeed-card-age {
  font-size: 12px;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.newsfeed-card-age-row {
  display: inline-block;
  white-space: nowrap; /* Prevent age from wrapping */
}

.newsfeed-card-age-first {
  font-weight: 500;
}

.newsfeed-card-age-separator {
  color: white;
  margin: 0 2px;
}

.newsfeed-card-age-second {
  font-weight: 500;
}

.newsfeed-card-birthday-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.newsfeed-card-birthday-icon {
  width: 16px;
  height: 16px;
}

.newsfeed-card-device-icons {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  float: right;
}

.newsfeed-card-device-icon {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.newsfeed-card-profile-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}

.newsfeed-card-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.newsfeed-card-stat-icon {
  width: 20px;
  height: 22px;
}

.newsfeed-card-profile-location {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
}

.newsfeed-card-location-icon {
  width: 20px;
  height: 20px;
}

.newsfeed-card-location-icon-small {
  width: 18px;
  height: 18px;
}

.newsfeed-card-profile-location-distance {
  margin-left: 8px;
}

.newsfeed-card-interests {
  margin-top: 8px;
}

.newsfeed-card-interests-label {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.newsfeed-card-interests-icons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.newsfeed-card-interests-icon {
  display: inline-block;
  object-fit: contain; /* Maintain aspect ratio when resizing */
  flex-shrink: 0; /* Prevent icons from shrinking */
}

.newsfeed-card-party-info {
  background-color: #2a2a2a;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.newsfeed-card-party-type {
  font-size: 12px;
  color: #9ca3af;
}

.newsfeed-card-party-title {
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.newsfeed-card-message {
  margin-top: 12px;
}

.newsfeed-card-message-text {
  color: white;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.newsfeed-card-party-location {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.newsfeed-card-party-location-text {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.newsfeed-card-party-distance {
  font-size: 12px;
  color: #9ca3af;
}

.newsfeed-card-party-interests {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.newsfeed-card-party-interests-label {
  font-size: 12px;
  color: #9ca3af;
}

.newsfeed-card-party-interests-icons {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
