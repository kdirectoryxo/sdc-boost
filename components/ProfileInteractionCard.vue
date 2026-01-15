<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
}

const props = defineProps<Props>();

const sender = computed(() => props.item.sender);
const receiver = computed(() => props.item.receiver);

// Determine action type and message
// Based on SDC source code action mappings:
// Action 3 = likeReceivedActionId
// Action 21 = validationReceivedStatusAcceptedActionId (receiver validated sender)
// Action 22 = matchLikeActionId (mutual match)
const getActionInfo = () => {
  switch (props.item.action) {
    case 3:
      // Like received: sender liked receiver
      return {
        title: `${sender.value?.account_id || 'Iemand'} heeft ${receiver.value?.account_id || 'jou'} een like gegeven`,
        icon: '❤️',
        type: 'like'
      };
    case 21:
      // Validation: "receiver validated sender" (receiver.accountId validated sender.accountId)
      return {
        title: `${receiver.value?.account_id || 'Iemand'} heeft ${sender.value?.account_id || 'jou'} gevalideerd`,
        icon: '✓',
        type: 'validation',
        subject: props.item.extra_data?.subject || ''
      };
    case 22:
      // Mutual match: both users liked each other
      return {
        title: 'Mutual match',
        icon: '💕',
        type: 'match'
      };
    default:
      return {
        title: 'Nieuwe interactie',
        icon: '🔔',
        type: 'unknown'
      };
  }
};

const actionInfo = computed(() => getActionInfo());

// For validation (action 21), the roles are reversed: receiver validated sender
// For like (action 3), sender liked receiver
// For match (action 22), both liked each other
const primaryProfile = computed(() => {
  if (actionInfo.value.type === 'validation') {
    return receiver.value; // The one who validated
  }
  return sender.value; // The one who liked
});

const secondaryProfile = computed(() => {
  if (actionInfo.value.type === 'validation') {
    return sender.value; // The one who was validated
  }
  return receiver.value; // The one who was liked
});

const primaryPhotoUrl = computed(() => {
  const profile = primaryProfile.value;
  if (profile?.primary_photo) {
    if (profile.primary_photo.startsWith('http')) {
      return profile.primary_photo;
    }
    if (profile.primary_photo !== '/thumbnail/') {
      return `https://pictures.sdc.com/photos/${profile.primary_photo}`;
    }
  }
  return null;
});

const secondaryPhotoUrl = computed(() => {
  const profile = secondaryProfile.value;
  if (profile?.primary_photo) {
    if (profile.primary_photo.startsWith('http')) {
      return profile.primary_photo;
    }
    return `https://pictures.sdc.com/photos/${profile.primary_photo}`;
  }
  return null;
});

// Parse age string (format: "35|32" or similar)
const parseAge = (ageStr: string | undefined) => {
  if (!ageStr) return { first: null, second: null };
  const parts = ageStr.split('|');
  return {
    first: parts[0]?.trim() || null,
    second: parts[1]?.trim() || null,
  };
};

const primaryAges = computed(() => parseAge(primaryProfile.value?.age));
const secondaryAges = computed(() => parseAge(secondaryProfile.value?.age));
const senderAges = computed(() => parseAge(sender.value?.age));
const receiverAges = computed(() => parseAge(receiver.value?.age));

// Get age color based on gender (1 = female = pink, 0 = male = blue)
const getAgeColor = (gender: number | undefined) => {
  return gender === 1 ? 'rgb(255, 96, 223)' : 'rgb(58, 151, 254)';
};

const formatDistance = (km: number | undefined) => {
  if (!km) return '';
  return `${km} km`;
};
</script>

<template>
  <div class="profile-interaction-card">
    <!-- Header -->
    <div class="profile-interaction-card-header">
      <div class="profile-interaction-card-header-content">
        <span class="profile-interaction-card-header-icon">{{ actionInfo.icon }}</span>
        <p class="profile-interaction-card-header-text">{{ actionInfo.title }}</p>
      </div>
      <p class="profile-interaction-card-header-time">{{ item.timed }}</p>
    </div>

    <!-- Content -->
    <div class="profile-interaction-card-content">
      <!-- For mutual match (action 22), show both profiles side by side -->
      <template v-if="actionInfo.type === 'match'">
        <div class="profile-interaction-card-profiles-grid">
          <!-- Sender Profile -->
          <div class="profile-interaction-card-profile-section">
            <div class="profile-interaction-card-profile-label">{{ sender?.account_id || 'Gebruiker 1' }}</div>
            <div class="profile-interaction-card-profile">
              <img
                v-if="sender?.primary_photo && sender.primary_photo !== '/thumbnail/'"
                :src="sender.primary_photo.startsWith('http') ? sender.primary_photo : `https://pictures.sdc.com/photos/${sender.primary_photo}`"
                :alt="sender?.account_id"
                class="profile-interaction-card-profile-img"
              />
              <div v-else class="profile-interaction-card-profile-placeholder">
                <span>{{ sender?.account_id?.charAt(0) || '?' }}</span>
              </div>
              <div class="profile-interaction-card-profile-info">
                <p class="profile-interaction-card-profile-name">{{ sender?.account_id || 'Onbekend' }}</p>
                
                <!-- Age with colors -->
                <div v-if="senderAges.first || senderAges.second" class="profile-interaction-card-age">
                  <span 
                    v-if="senderAges.first" 
                    class="profile-interaction-card-age-first"
                    :style="{ color: getAgeColor(sender?.gender1) }"
                  >
                    {{ senderAges.first }}
                  </span>
                  <span v-if="senderAges.first && senderAges.second" class="profile-interaction-card-age-separator"> | </span>
                  <span 
                    v-if="senderAges.second" 
                    class="profile-interaction-card-age-second"
                    :style="{ color: getAgeColor(sender?.gender2) }"
                  >
                    {{ senderAges.second }}
                  </span>
                </div>

                <!-- Location -->
                <div v-if="sender?.location && sender.location !== ', USA'" class="profile-interaction-card-profile-location">
                  <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="profile-interaction-card-location-icon" />
                  <span>{{ sender.location }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Receiver Profile -->
          <div class="profile-interaction-card-profile-section">
            <div class="profile-interaction-card-profile-label">{{ receiver?.account_id || 'Gebruiker 2' }}</div>
            <div class="profile-interaction-card-profile">
              <img
                v-if="receiver?.primary_photo && receiver.primary_photo !== '/thumbnail/'"
                :src="receiver.primary_photo.startsWith('http') ? receiver.primary_photo : `https://pictures.sdc.com/photos/${receiver.primary_photo}`"
                :alt="receiver?.account_id"
                class="profile-interaction-card-profile-img"
              />
              <div v-else class="profile-interaction-card-profile-placeholder">
                <span>{{ receiver?.account_id?.charAt(0) || '?' }}</span>
              </div>
              <div class="profile-interaction-card-profile-info">
                <p class="profile-interaction-card-profile-name">{{ receiver?.account_id || 'Onbekend' }}</p>
                
                <!-- Age with colors -->
                <div v-if="receiverAges.first || receiverAges.second" class="profile-interaction-card-age">
                  <span 
                    v-if="receiverAges.first" 
                    class="profile-interaction-card-age-first"
                    :style="{ color: getAgeColor(receiver?.gender1) }"
                  >
                    {{ receiverAges.first }}
                  </span>
                  <span v-if="receiverAges.first && receiverAges.second" class="profile-interaction-card-age-separator"> | </span>
                  <span 
                    v-if="receiverAges.second" 
                    class="profile-interaction-card-age-second"
                    :style="{ color: getAgeColor(receiver?.gender2) }"
                  >
                    {{ receiverAges.second }}
                  </span>
                </div>

                <!-- Location -->
                <div v-if="receiver?.location" class="profile-interaction-card-profile-location">
                  <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="profile-interaction-card-location-icon" />
                  <span>{{ receiver.location }}</span>
                  <span v-if="item.location_how_far" class="profile-interaction-card-profile-location-distance">
                    {{ formatDistance(item.location_how_far) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- For like and validation, show primary and secondary profiles -->
      <template v-else>
        <!-- Primary Profile (who did the action) -->
        <div class="profile-interaction-card-profile-section">
          <div class="profile-interaction-card-profile-label">{{ primaryProfile?.account_id || 'Iemand' }}</div>
          <div class="profile-interaction-card-profile">
            <img
              v-if="primaryPhotoUrl"
              :src="primaryPhotoUrl"
              :alt="primaryProfile?.account_id"
              class="profile-interaction-card-profile-img"
            />
            <div v-else class="profile-interaction-card-profile-placeholder">
              <span>{{ primaryProfile?.account_id?.charAt(0) || '?' }}</span>
            </div>
            <div class="profile-interaction-card-profile-info">
              <p class="profile-interaction-card-profile-name">{{ primaryProfile?.account_id || 'Onbekend' }}</p>
              
              <!-- Age with colors -->
              <div v-if="primaryAges.first || primaryAges.second" class="profile-interaction-card-age">
                <span 
                  v-if="primaryAges.first" 
                  class="profile-interaction-card-age-first"
                  :style="{ color: getAgeColor(primaryProfile?.gender1) }"
                >
                  {{ primaryAges.first }}
                </span>
                <span v-if="primaryAges.first && primaryAges.second" class="profile-interaction-card-age-separator"> | </span>
                <span 
                  v-if="primaryAges.second" 
                  class="profile-interaction-card-age-second"
                  :style="{ color: getAgeColor(primaryProfile?.gender2) }"
                >
                  {{ primaryAges.second }}
                </span>
              </div>

              <!-- Location -->
              <div v-if="primaryProfile?.location && primaryProfile.location !== ', USA'" class="profile-interaction-card-profile-location">
                <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="profile-interaction-card-location-icon" />
                <span>{{ primaryProfile.location }}</span>
              </div>

              <!-- Stats -->
              <div class="profile-interaction-card-profile-stats">
                <div v-if="primaryProfile?.photo_count" class="profile-interaction-card-stat">
                  <img src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg" alt="Foto's" class="profile-interaction-card-stat-icon" />
                  <span>{{ primaryProfile.photo_count }}</span>
                </div>
                <div v-if="primaryProfile?.likes_count" class="profile-interaction-card-stat">
                  <img src="https://www.sdc.com/react/assets/like_grid_card.c46847a1.svg" alt="Likes" class="profile-interaction-card-stat-icon" />
                  <span>{{ primaryProfile.likes_count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Secondary Profile (who received the action) -->
        <div class="profile-interaction-card-profile-section">
          <div class="profile-interaction-card-profile-label">{{ secondaryProfile?.account_id || 'Jij' }}</div>
          <div class="profile-interaction-card-profile">
            <img
              v-if="secondaryPhotoUrl"
              :src="secondaryPhotoUrl"
              :alt="secondaryProfile?.account_id"
              class="profile-interaction-card-profile-img"
            />
            <div v-else class="profile-interaction-card-profile-placeholder">
              <span>{{ secondaryProfile?.account_id?.charAt(0) || '?' }}</span>
            </div>
            <div class="profile-interaction-card-profile-info">
              <p class="profile-interaction-card-profile-name">{{ secondaryProfile?.account_id || 'Jij' }}</p>
              
              <!-- Age with colors -->
              <div v-if="secondaryAges.first || secondaryAges.second" class="profile-interaction-card-age">
                <span 
                  v-if="secondaryAges.first" 
                  class="profile-interaction-card-age-first"
                  :style="{ color: getAgeColor(secondaryProfile?.gender1) }"
                >
                  {{ secondaryAges.first }}
                </span>
                <span v-if="secondaryAges.first && secondaryAges.second" class="profile-interaction-card-age-separator"> | </span>
                <span 
                  v-if="secondaryAges.second" 
                  class="profile-interaction-card-age-second"
                  :style="{ color: getAgeColor(secondaryProfile?.gender2) }"
                >
                  {{ secondaryAges.second }}
                </span>
              </div>

              <!-- Location -->
              <div v-if="secondaryProfile?.location" class="profile-interaction-card-profile-location">
                <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="profile-interaction-card-location-icon" />
                <span>{{ secondaryProfile.location }}</span>
                <span v-if="item.location_how_far && actionInfo.type !== 'validation'" class="profile-interaction-card-profile-location-distance">
                  {{ formatDistance(item.location_how_far) }}
                </span>
              </div>

              <!-- Stats -->
              <div class="profile-interaction-card-profile-stats">
                <div v-if="secondaryProfile?.photo_count" class="profile-interaction-card-stat">
                  <img src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg" alt="Foto's" class="profile-interaction-card-stat-icon" />
                  <span>{{ secondaryProfile.photo_count }}</span>
                </div>
                <div v-if="secondaryProfile?.likes_count" class="profile-interaction-card-stat">
                  <img src="https://www.sdc.com/react/assets/like_grid_card.c46847a1.svg" alt="Likes" class="profile-interaction-card-stat-icon" />
                  <span>{{ secondaryProfile.likes_count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Validation Subject (for action 21) -->
        <div v-if="actionInfo.type === 'validation' && actionInfo.subject" class="profile-interaction-card-validation-subject">
          <p class="profile-interaction-card-validation-label">Bericht:</p>
          <p class="profile-interaction-card-validation-text">{{ actionInfo.subject }}</p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.profile-interaction-card {
  background-color: #1f1f1f;
  border-radius: 8px;
  border: 1px solid #333;
  overflow: hidden;
}

.profile-interaction-card-header {
  padding: 12px 16px;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.profile-interaction-card-header-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.profile-interaction-card-header-icon {
  font-size: 18px;
}

.profile-interaction-card-header-text {
  color: white;
  font-weight: 600;
  font-size: 14px;
  margin: 0;
}

.profile-interaction-card-header-time {
  color: #9ca3af;
  font-size: 12px;
  margin: 0;
}

.profile-interaction-card-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-interaction-card-profiles-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .profile-interaction-card-profiles-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.profile-interaction-card-profile-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-interaction-card-profile-label {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
}

.profile-interaction-card-profile {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.profile-interaction-card-profile-img {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.profile-interaction-card-profile-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  background-color: #2a2a2a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-interaction-card-profile-placeholder span {
  color: #9ca3af;
  font-size: 24px;
  font-weight: 600;
}

.profile-interaction-card-profile-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-interaction-card-profile-name {
  color: white;
  font-weight: 600;
  font-size: 14px;
  margin: 0;
}

.profile-interaction-card-age {
  font-size: 12px;
  display: inline-block;
}

.profile-interaction-card-age-first {
  font-weight: 500;
}

.profile-interaction-card-age-separator {
  color: white;
  margin: 0 2px;
}

.profile-interaction-card-age-second {
  font-weight: 500;
}

.profile-interaction-card-profile-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.profile-interaction-card-location-icon {
  width: 16px;
  height: 16px;
}

.profile-interaction-card-profile-location-distance {
  margin-left: 4px;
}

.profile-interaction-card-profile-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.profile-interaction-card-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.profile-interaction-card-stat-icon {
  width: 18px;
  height: 18px;
}

.profile-interaction-card-validation-subject {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid #333;
}

.profile-interaction-card-validation-label {
  font-size: 12px;
  color: #9ca3af;
  margin: 0 0 4px 0;
}

.profile-interaction-card-validation-text {
  color: white;
  font-size: 14px;
  margin: 0;
  font-style: italic;
}
</style>
