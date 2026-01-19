<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
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
  <div :class="['newsfeed-card', `newsfeed-card-${props.index !== undefined && props.index % 2 === 0 ? 'even' : 'odd'}`]">
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
          <div class="newsfeed-card-party-title-row">
            <p class="newsfeed-card-party-title">{{ party?.title }}</p>
            <p v-if="party?.date_str" class="newsfeed-card-party-date-inline">{{ party.date_str }}</p>
          </div>
          <p class="newsfeed-card-party-author">
            door <span class="newsfeed-card-party-author-name">{{ receiver?.account_id }}</span>
          </p>
          
          <div v-if="party?.location" class="newsfeed-card-party-location">
            <div class="newsfeed-card-party-location-text">
              <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="newsfeed-card-location-icon-small" />
              <span>{{ party.location }}</span>
            </div>
            <span v-if="party?.distance" class="newsfeed-card-party-distance">
              {{ formatDistance(party.distance) }}
            </span>
          </div>

          <!-- <button class="newsfeed-card-button">
            Voeg mij toe
          </button> -->
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
  font-size: 14px;
  letter-spacing: -0.01em;
}

.newsfeed-card-header-time {
  color: #6b7280;
  font-size: 12px;
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
  width: 60px;
  height: 60px;
  border-radius: 8px;
  object-fit: cover;
  border: 2px solid rgba(255, 241, 165, 0.6);
  flex-shrink: 0;
}

.newsfeed-card-profile-info {
  flex: 1;
}

.newsfeed-card-profile-name {
  color: white;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.01em;
}

.newsfeed-card-profile-type {
  font-size: 12px;
  color: #fbbf24;
  margin-top: 4px;
  font-weight: 500;
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
  font-size: 12px;
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
  font-size: 12px;
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
  font-size: 14px;
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

.newsfeed-card-party-author {
  font-size: 10px;
  color: #9ca3af;
}

.newsfeed-card-party-author-name {
  color: #fbbf24;
  font-size: 10px;
  font-weight: 500;
}

.newsfeed-card-party-date {
  font-size: 10px;
  color: #9ca3af;
  font-weight: 500;
  display: none;
}

.newsfeed-card-party-location {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
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

.newsfeed-card-button {
  width: 100%;
  margin-top: 8px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.2);
}

.newsfeed-card-button:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(59, 130, 246, 0.3);
}

.newsfeed-card-button:active {
  transform: translateY(0);
}
</style>
