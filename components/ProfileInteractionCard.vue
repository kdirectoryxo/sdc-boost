<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
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
      // Like received: receiver liked sender (from profile owner's perspective)
      // API returns: sender = profile owner, receiver = the one who liked
      return {
        title: `${receiver.value?.account_id || 'Iemand'} heeft ${sender.value?.account_id || 'jouw profiel'} een like gegeven`,
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
// For like (action 3), receiver liked sender (from profile owner's perspective)
//   API returns: sender = profile owner, receiver = the one who liked
// For match (action 22), both liked each other
const primaryProfile = computed(() => {
  if (actionInfo.value.type === 'validation') {
    return receiver.value; // The one who validated
  }
  if (actionInfo.value.type === 'like') {
    return receiver.value; // The one who liked (receiver in API response)
  }
  return sender.value; // For match, use sender
});

const secondaryProfile = computed(() => {
  if (actionInfo.value.type === 'validation') {
    return sender.value; // The one who was validated
  }
  if (actionInfo.value.type === 'like') {
    return sender.value; // The one who was liked (sender in API response = profile owner)
  }
  return receiver.value; // For match, use receiver
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

// Check if second person age is real (not a placeholder)
// Gender2 is not real if age is > 100, undefined, or < 18
const isSecondAgeReal = (ageSecond: string | null) => {
  if (!ageSecond) return false;
  const age = parseInt(ageSecond, 10);
  return !isNaN(age) && age >= 18 && age <= 100;
};

const primaryAges = computed(() => parseAge(primaryProfile.value?.age));
const secondaryAges = computed(() => parseAge(secondaryProfile.value?.age));
const senderAges = computed(() => parseAge(sender.value?.age));
const receiverAges = computed(() => parseAge(receiver.value?.age));

// Check if each profile has a real second person
const isPrimaryGender2Real = computed(() => isSecondAgeReal(primaryAges.value.second));
const isSecondaryGender2Real = computed(() => isSecondAgeReal(secondaryAges.value.second));
const isSenderGender2Real = computed(() => isSecondAgeReal(senderAges.value.second));
const isReceiverGender2Real = computed(() => isSecondAgeReal(receiverAges.value.second));

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
  <div :class="['profile-interaction-card', `profile-interaction-card-${props.index !== undefined && props.index % 2 === 0 ? 'even' : 'odd'}`]">
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
      <!-- All profile types use 2-column grid layout -->
      <div class="profile-interaction-card-profiles-grid">
        <!-- For match: show sender and receiver -->
        <template v-if="actionInfo.type === 'match'">
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
                
                <!-- Age with colors - only show second if real -->
                <div v-if="senderAges.first" class="profile-interaction-card-age">
                  <span 
                    class="profile-interaction-card-age-first"
                    :style="{ color: getAgeColor(sender?.gender1) }"
                  >
                    {{ senderAges.first }}
                  </span>
                  <template v-if="isSenderGender2Real">
                    <span class="profile-interaction-card-age-separator"> | </span>
                    <span 
                      class="profile-interaction-card-age-second"
                      :style="{ color: getAgeColor(sender?.gender2) }"
                    >
                      {{ senderAges.second }}
                    </span>
                  </template>
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
                
                <!-- Age with colors - only show second if real -->
                <div v-if="receiverAges.first" class="profile-interaction-card-age">
                  <span 
                    class="profile-interaction-card-age-first"
                    :style="{ color: getAgeColor(receiver?.gender1) }"
                  >
                    {{ receiverAges.first }}
                  </span>
                  <template v-if="isReceiverGender2Real">
                    <span class="profile-interaction-card-age-separator"> | </span>
                    <span 
                      class="profile-interaction-card-age-second"
                      :style="{ color: getAgeColor(receiver?.gender2) }"
                    >
                      {{ receiverAges.second }}
                    </span>
                  </template>
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
        </template>

        <!-- For like and validation: show primary and secondary profiles side by side -->
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
                
                <!-- Age with colors - only show second if real -->
                <div v-if="primaryAges.first" class="profile-interaction-card-age">
                  <span 
                    class="profile-interaction-card-age-first"
                    :style="{ color: getAgeColor(primaryProfile?.gender1) }"
                  >
                    {{ primaryAges.first }}
                  </span>
                  <template v-if="isPrimaryGender2Real">
                    <span class="profile-interaction-card-age-separator"> | </span>
                    <span 
                      class="profile-interaction-card-age-second"
                      :style="{ color: getAgeColor(primaryProfile?.gender2) }"
                    >
                      {{ primaryAges.second }}
                    </span>
                  </template>
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
                
                <!-- Age with colors - only show second if real -->
                <div v-if="secondaryAges.first" class="profile-interaction-card-age">
                  <span 
                    class="profile-interaction-card-age-first"
                    :style="{ color: getAgeColor(secondaryProfile?.gender1) }"
                  >
                    {{ secondaryAges.first }}
                  </span>
                  <template v-if="isSecondaryGender2Real">
                    <span class="profile-interaction-card-age-separator"> | </span>
                    <span 
                      class="profile-interaction-card-age-second"
                      :style="{ color: getAgeColor(secondaryProfile?.gender2) }"
                    >
                      {{ secondaryAges.second }}
                    </span>
                  </template>
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
        </template>
      </div>

      <!-- Validation Subject (for action 21) - shown below the grid -->
      <div v-if="actionInfo.type === 'validation' && actionInfo.subject" class="profile-interaction-card-validation-subject">
        <p class="profile-interaction-card-validation-label">Bericht:</p>
        <p class="profile-interaction-card-validation-text">{{ actionInfo.subject }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-interaction-card {
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-left: 3px solid rgba(168, 85, 247, 0.4);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s ease;
  position: relative;
}

.profile-interaction-card-even {
  background-color: rgba(255, 255, 255, 0.025);
}

.profile-interaction-card-odd {
  background-color: rgba(255, 255, 255, 0.035);
}

.profile-interaction-card:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  border-left-color: rgba(168, 85, 247, 0.6);
}

.profile-interaction-card-header {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.02);
}

.profile-interaction-card-header-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.profile-interaction-card-header-icon {
  font-size: 14px;
  line-height: 1;
}

.profile-interaction-card-header-text {
  color: white;
  font-weight: 600;
  font-size: 14px;
  margin: 0;
  letter-spacing: -0.01em;
}

.profile-interaction-card-header-time {
  color: #6b7280;
  font-size: 12px;
  margin: 0;
  font-weight: 500;
}

.profile-interaction-card-content {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-interaction-card-profiles-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 600px) {
  .profile-interaction-card-profiles-grid {
    grid-template-columns: 1fr;
  }
}

.profile-interaction-card-profile-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-interaction-card-profile-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.profile-interaction-card-profile {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.profile-interaction-card-profile-img {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid rgba(168, 85, 247, 0.6);
}

.profile-interaction-card-profile-placeholder {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%);
  border: 2px solid rgba(168, 85, 247, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-interaction-card-profile-placeholder span {
  color: #60a5fa;
  font-size: 20px;
  font-weight: 600;
}

.profile-interaction-card-profile-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-interaction-card-profile-name {
  color: white;
  font-weight: 600;
  font-size: 14px;
  margin: 0;
  letter-spacing: -0.01em;
}

.profile-interaction-card-age {
  font-size: 13px;
  display: inline-block;
  font-weight: 500;
}

.profile-interaction-card-age-first {
  font-weight: 600;
}

.profile-interaction-card-age-separator {
  color: rgba(255, 255, 255, 0.4);
  margin: 0 3px;
}

.profile-interaction-card-age-second {
  font-weight: 600;
}

.profile-interaction-card-profile-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.profile-interaction-card-location-icon {
  width: 12px;
  height: 12px;
  opacity: 0.7;
}

.profile-interaction-card-profile-location-distance {
  margin-left: 4px;
  color: #6b7280;
}

.profile-interaction-card-profile-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.profile-interaction-card-stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #9ca3af;
}

.profile-interaction-card-stat-icon {
  width: 14px;
  height: 14px;
  opacity: 0.8;
}

.profile-interaction-card-validation-subject {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.profile-interaction-card-validation-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 6px 0;
}

.profile-interaction-card-validation-text {
  color: #e5e7eb;
  font-size: 11px;
  margin: 0;
  font-style: italic;
  line-height: 1.5;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  border-left: 2px solid rgba(59, 130, 246, 0.4);
}
</style>
