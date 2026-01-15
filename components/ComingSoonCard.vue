<script lang="ts" setup>
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
}

const props = defineProps<Props>();

// Get action type label for display
const getActionLabel = () => {
  switch (props.item.action) {
    case 2:
      return "Foto's";
    case 5:
      return "Foto's & Video's";
    case 6:
      return 'Validaties';
    case 8:
      return 'Nieuwe vrienden / volgers';
    case 9:
      return 'Speed Date';
    case 13:
      return 'Reisplannen';
    case 14:
      return "Party's & Events";
    case 17:
      return 'Likes gegeven';
    case 18:
      return 'Groepslid geworden';
    case 21:
      return 'Verjaardag';
    case 22:
      return 'Reisplannen';
    case 23:
      return 'Ledenservice';
    case 300:
      return 'Groepen / Blogs';
    case 600:
      return 'Gastenlijst';
    case 903:
      return 'Onbekende actie';
    case 904:
      return 'Speed Date';
    case 906:
      return 'Onbekende actie';
    default:
      return `Actie ${props.item.action}`;
  }
};

const actionLabel = getActionLabel();
</script>

<template>
  <div class="coming-soon-card">
    <!-- Header -->
    <div class="coming-soon-card-header">
      <div class="coming-soon-card-header-content">
        <span class="coming-soon-card-header-icon">🚧</span>
        <p class="coming-soon-card-header-text">{{ actionLabel }}</p>
      </div>
      <p class="coming-soon-card-header-time">{{ item.timed }}</p>
    </div>

    <!-- Content -->
    <div class="coming-soon-card-content">
      <div class="coming-soon-card-placeholder">
        <div class="coming-soon-card-icon-large">⏳</div>
        <p class="coming-soon-card-title">Coming Soon</p>
        <p class="coming-soon-card-description">
          Deze actie wordt binnenkort ondersteund. We werken eraan!
        </p>
        <div class="coming-soon-card-details">
          <p class="coming-soon-card-detail-label">Actie ID:</p>
          <p class="coming-soon-card-detail-value">{{ item.action }}</p>
        </div>
        <div v-if="item.action_id" class="coming-soon-card-details">
          <p class="coming-soon-card-detail-label">Action ID:</p>
          <p class="coming-soon-card-detail-value">{{ item.action_id }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.coming-soon-card {
  background-color: #1f1f1f;
  border-radius: 8px;
  border: 1px solid #333;
  overflow: hidden;
}

.coming-soon-card-header {
  padding: 12px 16px;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.coming-soon-card-header-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coming-soon-card-header-icon {
  font-size: 18px;
}

.coming-soon-card-header-text {
  color: white;
  font-weight: 600;
  font-size: 14px;
  margin: 0;
}

.coming-soon-card-header-time {
  color: #9ca3af;
  font-size: 12px;
  margin: 0;
}

.coming-soon-card-content {
  padding: 48px 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.coming-soon-card-placeholder {
  text-align: center;
  max-width: 400px;
}

.coming-soon-card-icon-large {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.7;
}

.coming-soon-card-title {
  color: white;
  font-weight: 600;
  font-size: 18px;
  margin: 0 0 8px 0;
}

.coming-soon-card-description {
  color: #9ca3af;
  font-size: 14px;
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.coming-soon-card-details {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

.coming-soon-card-detail-label {
  color: #6b7280;
  font-size: 12px;
  margin: 0;
}

.coming-soon-card-detail-value {
  color: #9ca3af;
  font-size: 12px;
  font-family: monospace;
  margin: 0;
  background-color: #2a2a2a;
  padding: 4px 8px;
  border-radius: 4px;
}
</style>
