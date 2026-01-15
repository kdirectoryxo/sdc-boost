<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
}

const props = defineProps<Props>();

const receiver = computed(() => props.item.receiver);
const party = computed(() => props.item.party);

const photoUrl = computed(() => {
  if (receiver.value?.primary_photo) {
    if (receiver.value.primary_photo.startsWith('http')) {
      return receiver.value.primary_photo;
    }
    return `https://pictures.sdc.com/photos/${receiver.value.primary_photo}`;
  }
  return null;
});

const partyPhotoUrl = computed(() => {
  if (party.value?.primary_photo) {
    if (party.value.primary_photo.startsWith('http')) {
      return party.value.primary_photo;
    }
    return `https://pictures.sdc.com/photos/${party.value.primary_photo}`;
  }
  return null;
});

// Parse age string (format: "38|48" or similar)
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
// Gender2 is not real if age is > 100, undefined, or < 18
const isGender2Real = computed(() => {
  if (!ages.value.second) return false;
  const age = parseInt(ages.value.second, 10);
  return !isNaN(age) && age >= 18 && age <= 100;
});

// Get age color based on gender (1 = female = pink, 0 = male = blue)
const getAgeColor = (gender: number | undefined) => {
  return gender === 1 ? 'rgb(255, 96, 223)' : 'rgb(58, 151, 254)';
};

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

const receiverInterests = computed(() => {
  const interestsStr = receiver.value?.summary_int || '';
  return parseInterests(interestsStr);
});

const partyInterests = computed(() => {
  // Party interests are determined by filter_couple, filter_female, filter_male, filter_trans
  return {
    coupleMaleFemale: party.value?.filter_couple === 1,
    singleFemale: party.value?.filter_female === 1,
    singleMale: party.value?.filter_male === 1,
    transgender: party.value?.filter_trans === 1,
  };
});

// Get receiver interests icons
const receiverInterestsIcons = computed(() => {
  const icons: Array<{ type: string; url: string; width: number; height: number }> = [];
  
  if (receiverInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple',
      url: 'https://www.sdc.com/react/assets/couple_male_female_icon.a2db86e4.svg',
      width: 14,
      height: 20,
    });
  }
  
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
      width: 24,
      height: 20,
    });
  }
  
  return icons;
});

// Get party welcome interests icons
const partyInterestsIcons = computed(() => {
  const icons: Array<{ type: string; url: string; width: number; height: number }> = [];
  
  if (partyInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple',
      url: 'https://www.sdc.com/react/assets/couple_male_female_icon.a2db86e4.svg',
      width: 14,
      height: 20,
    });
  }
  
  if (partyInterests.value.singleFemale) {
    icons.push({
      type: 'single-female',
      url: 'https://www.sdc.com/react/assets/single_female_icon.e150c7be.svg',
      width: 24,
      height: 20,
    });
  }
  
  if (partyInterests.value.singleMale) {
    icons.push({
      type: 'single-male',
      url: 'https://www.sdc.com/react/assets/single_male_icon.6eca46f8.svg',
      width: 24,
      height: 20,
    });
  }
  
  if (partyInterests.value.transgender) {
    icons.push({
      type: 'transgender',
      url: 'https://www.sdc.com/react/assets/transgender_icon.e29c4d6d.svg',
      width: 24,
      height: 20,
    });
  }
  
  return icons;
});

const handleRemoveFromGuestList = () => {
  // TODO: Implement API call to remove from guest list
  console.log('Remove from guest list', party.value?.agenda_id);
};
</script>

<template>
  <div :class="['newsfeed-card', `newsfeed-card-${props.index !== undefined && props.index % 2 === 0 ? 'even' : 'odd'}`]">
    <!-- Header -->
    <div class="newsfeed-card-header">
      <p class="newsfeed-card-header-text">
        Lid is toegevoegd aan een gastenlijst
      </p>
      <p class="newsfeed-card-header-time">{{ item.timed }}</p>
    </div>

    <!-- Content -->
    <div class="newsfeed-card-content">
      <!-- Left: Member Profile -->
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
                  v-if="receiver?.online === 1" 
                  src="https://www.sdc.com/react/assets/messenger_online_icon.0a87dd19.svg" 
                  alt="user-is-online" 
                  class="newsfeed-card-device-icon"
                  title="Chat nu"
                />
              </div>
            </div>
            
            <!-- Age with colors - only show second if real -->
            <div v-if="ages.first" class="newsfeed-card-age">
              <span 
                class="newsfeed-card-age-first"
                :style="{ color: getAgeColor(receiver?.gender1) }"
              >
                {{ ages.first }}
              </span>
              <template v-if="isGender2Real">
                <span class="newsfeed-card-age-separator"> | </span>
                <span 
                  class="newsfeed-card-age-second"
                  :style="{ color: getAgeColor(receiver?.gender2) }"
                >
                  {{ ages.second }}
                </span>
              </template>
            </div>

            <!-- Stats with icons -->
            <div class="newsfeed-card-profile-stats">
              <div v-if="receiver?.photo_count" class="newsfeed-card-stat">
                <img src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg" alt="Foto's" class="newsfeed-card-stat-icon" />
                <span>{{ receiver.photo_count }}</span>
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
            <div v-if="receiver?.location" class="newsfeed-card-profile-location">
              <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="newsfeed-card-location-icon" />
              <span>{{ receiver.location }}</span>
              <span v-if="item.location_how_far" class="newsfeed-card-profile-location-distance">
                {{ formatDistance(item.location_how_far) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Party Event -->
      <div class="newsfeed-card-section">
        <div class="newsfeed-card-party-container">
          <div class="newsfeed-card-party-info">
            <p class="newsfeed-card-party-type">{{ party?.event_type === 1 ? 'Publieke Party' : 'Privé Party' }}</p>
            <p class="newsfeed-card-party-title">{{ party?.title }}</p>
            <p class="newsfeed-card-party-author">
              door <span class="newsfeed-card-party-author-name">{{ party?.accountid }}</span>
            </p>
            <p class="newsfeed-card-party-date">{{ party?.date_str }}</p>
            
            <!-- Welcome Interests -->
            <div v-if="partyInterestsIcons.length > 0" class="newsfeed-card-party-welcome">
              <p class="newsfeed-card-party-welcome-label">Welkom</p>
              <div class="newsfeed-card-party-welcome-icons">
                <img 
                  v-for="(icon, index) in partyInterestsIcons" 
                  :key="index"
                  :src="icon.url" 
                  :alt="icon.type"
                  class="newsfeed-card-interests-icon"
                  :style="{ width: `${icon.width}px`, height: `${icon.height}px` }"
                />
              </div>
            </div>

            <!-- Location and Distance -->
            <div v-if="party?.location" class="newsfeed-card-party-location">
              <div class="newsfeed-card-party-location-text">
                <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="newsfeed-card-location-icon-small" />
                <span>{{ party.location }}</span>
              </div>
              <span v-if="party?.distance" class="newsfeed-card-party-distance">
                {{ formatDistance(party.distance) }}
              </span>
            </div>

            <!-- Remove Button -->
            <div class="newsfeed-card-party-actions">
              <button class="newsfeed-card-remove-button" @click="handleRemoveFromGuestList">
                <img src="https://www.sdc.com/react/assets/remove_white_icon.f1e5b75d.svg" alt="remove_me_from_guest_list" class="newsfeed-card-remove-icon" />
                <span>verwijder mij</span>
              </button>
            </div>
          </div>
          
          <!-- Party Icon -->
          <div class="newsfeed-card-party-icon-wrapper">
            <img src="https://www.sdc.com/react/assets/parties_blue_icon.2df43137.svg" alt="party" class="newsfeed-card-party-icon" />
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
  border-left: 3px solid rgba(255, 241, 165, 0.4);
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
  border-left-color: rgba(255, 241, 165, 0.6);
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
  gap: 8px;
}

/* Left Side: Profile */
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
  border: 2px solid rgba(255, 241, 165, 0.6);
  flex-shrink: 0;
}

.newsfeed-card-profile-placeholder {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(255, 241, 165, 0.15) 0%, rgba(255, 241, 165, 0.05) 100%);
  border: 2px solid rgba(255, 241, 165, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.newsfeed-card-profile-placeholder span {
  color: #fbbf24;
  font-size: 20px;
  font-weight: 600;
}

.newsfeed-card-profile-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.newsfeed-card-profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  display: inline-block;
  font-weight: 500;
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

.newsfeed-card-interests {
  display: flex;
  align-items: center;
  gap: 8px;
}

.newsfeed-card-interests-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.newsfeed-card-interests-icons {
  display: flex;
  align-items: center;
  gap: 5px;
}

.newsfeed-card-interests-icon {
  display: inline-block;
}

.newsfeed-card-profile-location {
  display: flex;
  align-items: center;
  gap: 4px;
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

.newsfeed-card-profile-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
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

/* Right Side: Party */
.newsfeed-card-party-container {
  position: relative;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 6px;
  padding: 10px;
  min-height: 120px;
}

.newsfeed-card-party-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.newsfeed-card-party-type {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.newsfeed-card-party-title {
  color: white;
  font-weight: 600;
  font-size: 12px;
  margin: 0;
  letter-spacing: -0.01em;
  line-height: 1.4;
}

.newsfeed-card-party-author {
  font-size: 10px;
  color: #9ca3af;
  margin: 0;
}

.newsfeed-card-party-author-name {
  color: #fbbf24;
  font-size: 10px;
  font-weight: 500;
  overflow-wrap: break-word;
}

.newsfeed-card-party-date {
  font-size: 10px;
  color: #9ca3af;
  margin: 0;
  font-weight: 500;
}

.newsfeed-card-party-welcome {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.newsfeed-card-party-welcome-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.newsfeed-card-party-welcome-icons {
  display: flex;
  align-items: center;
  gap: 5px;
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

.newsfeed-card-location-icon-small {
  width: 12px;
  height: 12px;
  opacity: 0.7;
}

.newsfeed-card-party-distance {
  font-size: 10px;
  color: #6b7280;
  font-weight: 500;
}

.newsfeed-card-party-actions {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.newsfeed-card-remove-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
  font-size: 11px;
  font-weight: 500;
  padding: 6px 10px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  justify-content: center;
}

.newsfeed-card-remove-button:hover {
  background-color: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.newsfeed-card-remove-icon {
  width: 12px;
  height: 12px;
}

.newsfeed-card-party-icon-wrapper {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.15);
  border-radius: 4px;
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.newsfeed-card-party-icon {
  width: 12px;
  height: 12px;
}
</style>
