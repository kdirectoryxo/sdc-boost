<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
}

const props = defineProps<Props>();

const party = computed(() => props.item.party);
const receiver = computed(() => props.item.receiver);

const photoUrl = computed(() => {
  if (receiver.value?.primary_photo) {
    if (receiver.value.primary_photo.startsWith('http')) {
      return receiver.value.primary_photo;
    }
    // Skip placeholder thumbnails
    if (receiver.value.primary_photo === '/thumbnail/') {
      return null;
    }
    return `https://pictures.sdc.com/photos/${receiver.value.primary_photo}`;
  }
  return null;
});

// Removed splashPhotoUrl - API returns incorrect format that causes 404 errors
// Actual format requires hash: /events/public/{club_id}/{agenda_id}/{hash}.jpg?{timestamp}
// API only provides: /events/{club_id}/{agenda_id}.jpg which doesn't work

const formatDistance = (km: number | undefined) => {
  if (!km) return '';
  return `${km} km`;
};
</script>

<template>
  <div class="newsfeed-card">
    <!-- Header -->
    <div class="newsfeed-card-header">
      <p class="newsfeed-card-header-text">
        {{ receiver?.account_id }} heeft een nieuwe party toegevoegd
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
            <div v-if="receiver?.business_type" class="newsfeed-card-profile-type">
              {{ receiver.business_type }}
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
          </div>
        </div>
      </div>

      <!-- Right: Party Info -->
      <div class="newsfeed-card-section">
        <div class="newsfeed-card-party-info">
          <p class="newsfeed-card-party-type">Publieke Party</p>
          <p class="newsfeed-card-party-title">{{ party?.title }}</p>
          <p class="newsfeed-card-party-author">
            door <span class="newsfeed-card-party-author-name">{{ receiver?.account_id }}</span>
          </p>
          <p class="newsfeed-card-party-date">{{ party?.date_str }}</p>
          
          <div v-if="party?.location" class="newsfeed-card-party-location">
            <div class="newsfeed-card-party-location-text">
              <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="newsfeed-card-location-icon-small" />
              <span>{{ party.location }}</span>
            </div>
            <span v-if="party?.distance" class="newsfeed-card-party-distance">
              {{ formatDistance(party.distance) }}
            </span>
          </div>

          <button class="newsfeed-card-button">
            Voeg mij toe
          </button>
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
}

.newsfeed-card-profile-type {
  font-size: 12px;
  color: #fef08a;
  margin-top: 4px;
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
}

.newsfeed-card-party-author {
  font-size: 12px;
  color: #9ca3af;
}

.newsfeed-card-party-author-name {
  color: #fef08a;
  font-size: 12px;
}

.newsfeed-card-party-date {
  font-size: 12px;
  color: #9ca3af;
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

.newsfeed-card-button {
  width: 100%;
  margin-top: 12px;
  background-color: #3b82f6;
  color: white;
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.newsfeed-card-button:hover {
  background-color: #2563eb;
}
</style>
