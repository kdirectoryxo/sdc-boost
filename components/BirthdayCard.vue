<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
}

const props = defineProps<Props>();

const receiver = computed(() => props.item.receiver);

const photoUrl = computed(() => {
  if (receiver.value?.primary_photo) {
    if (receiver.value.primary_photo.startsWith('http')) {
      return receiver.value.primary_photo;
    }
    if (receiver.value.primary_photo === '/thumbnail/') {
      return null;
    }
    return `https://pictures.sdc.com/photos/${receiver.value.primary_photo}`;
  }
  return null;
});

// Parse age string (format: "33|32" or similar)
const parseAge = () => {
  if (!receiver.value?.age) return { first: null, second: null };
  const parts = receiver.value.age.split('|');
  return {
    first: parts[0]?.trim() || null,
    second: parts[1]?.trim() || null,
  };
};

const ages = computed(() => parseAge());

// Check if second person age is real (not a placeholder)
const isGender2Real = computed(() => {
  if (!ages.value.second) return false;
  const age = parseInt(ages.value.second, 10);
  return !isNaN(age) && age >= 18 && age <= 100;
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
  return parts[0] === '1';
});

// Check if second person has birthday
const hasBirthdaySecond = computed(() => {
  const birthdayFor = receiver.value?.birthday_for;
  if (!birthdayFor) return false;
  const parts = birthdayFor.split('|');
  return parts[1] === '1';
});

const formatDistance = (km: number | undefined) => {
  if (!km) return '';
  return `${km} km`;
};

// Parse interests from summary_int
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

const receiverInterests = computed(() => {
  const interestsStr = receiver.value?.summary_int || '';
  return parseInterests(interestsStr);
});

// Get interests icons - only show couple icons if gender2 is real, otherwise filter them out
const receiverInterestsIcons = computed(() => {
  const icons: Array<{ type: string; url: string; width: number; height: number }> = [];
  
  if (isGender2Real.value && receiverInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple',
      url: 'https://www.sdc.com/react/assets/couple_male_female_icon.a2db86e4.svg',
      width: 14,
      height: 20,
    });
  }
  
  if (!isGender2Real.value) {
    if (receiverInterests.value.singleFemale) {
      icons.push({
        type: 'single-female',
        url: 'https://www.sdc.com/react/assets/single_female_icon.e150c7be.svg',
        width: 24,
        height: 20,
      });
    }
    
    if (receiverInterests.value.singleMale) {
      icons.push({
        type: 'single-male',
        url: 'https://www.sdc.com/react/assets/single_male_icon.6eca46f8.svg',
        width: 20,
        height: 20,
      });
    }
  }
  
  return icons;
});

// Determine birthday text based on who has birthday
const birthdayText = computed(() => {
  if (hasBirthdayFirst.value && hasBirthdaySecond.value) {
    return 'Hun verjaardag';
  } else if (hasBirthdayFirst.value) {
    return receiver.value?.gender1 === 1 ? 'Haar verjaardag' : 'Zijn verjaardag';
  } else if (hasBirthdaySecond.value) {
    return receiver.value?.gender2 === 1 ? 'Haar verjaardag' : 'Zijn verjaardag';
  }
  return 'Verjaardag';
});
</script>

<template>
  <div :class="['newsfeed-card', `newsfeed-card-${props.index !== undefined && props.index % 2 === 0 ? 'even' : 'odd'}`]">
    <!-- Header -->
    <div class="newsfeed-card-header">
      <p class="newsfeed-card-header-text">
        {{ receiver?.account_id }} in jouw omgeving heeft een verjaardag
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
          <div v-else class="newsfeed-card-profile-placeholder">
            <span>{{ receiver?.account_id?.charAt(0) || '?' }}</span>
          </div>
          <div class="newsfeed-card-profile-info">
            <div class="newsfeed-card-profile-header">
              <p class="newsfeed-card-profile-name">{{ receiver?.account_id }}</p>
              <div class="newsfeed-card-device-icons">
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
            </div>
            
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

            <!-- Interests -->
            <div v-if="receiverInterestsIcons.length > 0" class="newsfeed-card-interests">
              <p class="newsfeed-card-interests-label">Interesses</p>
              <div class="newsfeed-card-interests-icons">
                <img 
                  v-for="(icon, index) in receiverInterestsIcons" 
                  :key="index"
                  :src="icon.url" 
                  :alt="icon.type"
                  class="newsfeed-card-interests-icon"
                  :style="{ width: `${icon.width}px`, height: `${icon.height}px` }"
                />
              </div>
            </div>

            <!-- Location -->
            <div v-if="receiver?.location && receiver.location !== ', USA'" class="newsfeed-card-profile-location">
              <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="newsfeed-card-location-icon" />
              <span>{{ receiver.location }}</span>
              <span v-if="item.location_how_far" class="newsfeed-card-profile-location-distance">
                {{ formatDistance(item.location_how_far) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Birthday Info -->
      <div class="newsfeed-card-section">
        <div class="newsfeed-card-birthday-info">
          <div class="newsfeed-card-birthday-icon-wrapper">
            <img 
              src="https://www.sdc.com/react/assets/female_birthday_icon.fe78472e.svg" 
              alt="birthday cake" 
              class="newsfeed-card-birthday-cake-icon"
            />
          </div>
          <p class="newsfeed-card-birthday-text">{{ birthdayText }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.newsfeed-card {
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-left: 3px solid rgba(255, 192, 203, 0.4);
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
  border-left-color: rgba(255, 192, 203, 0.6);
}

.newsfeed-card-header {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.02);
}

.newsfeed-card-header-text {
  color: white;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: -0.01em;
}

.newsfeed-card-header-time {
  color: #6b7280;
  font-size: 10px;
  font-weight: 500;
}

.newsfeed-card-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  padding: 10px 12px;
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
  border: 2px solid rgba(255, 192, 203, 0.6);
  flex-shrink: 0;
}

.newsfeed-card-profile-placeholder {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(255, 192, 203, 0.15) 0%, rgba(255, 192, 203, 0.05) 100%);
  border: 2px solid rgba(255, 192, 203, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.newsfeed-card-profile-placeholder span {
  color: #ffb3d1;
  font-size: 20px;
  font-weight: 600;
}

.newsfeed-card-profile-info {
  flex: 1;
}

.newsfeed-card-profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.newsfeed-card-profile-name {
  color: white;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: -0.01em;
}

.newsfeed-card-device-icons {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
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

.newsfeed-card-profile-location-distance {
  margin-left: 4px;
  color: #6b7280;
}

.newsfeed-card-birthday-info {
  background: linear-gradient(135deg, rgba(255, 192, 203, 0.08) 0%, rgba(255, 192, 203, 0.03) 100%);
  border: 1px solid rgba(255, 192, 203, 0.15);
  border-radius: 6px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 120px;
}

.newsfeed-card-birthday-icon-wrapper {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 192, 203, 0.1);
  border-radius: 50%;
  color: #ffb3d1;
}

.newsfeed-card-birthday-cake-icon {
  width: 36px;
  height: 36px;
  filter: brightness(0) saturate(100%) invert(58%) sepia(100%) saturate(2000%) hue-rotate(200deg) brightness(1.2);
}

.newsfeed-card-birthday-text {
  color: white;
  font-weight: 600;
  font-size: 12px;
  text-align: center;
  margin: 0;
}
</style>
