<script lang="ts" setup>
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
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
  <div :class="['coming-soon-card', `coming-soon-card-${props.index !== undefined && props.index % 2 === 0 ? 'even' : 'odd'}`]">
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
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-left: 3px solid rgba(107, 114, 128, 0.4);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s ease;
  position: relative;
}

.coming-soon-card-even {
  background-color: rgba(255, 255, 255, 0.025);
}

.coming-soon-card-odd {
  background-color: rgba(255, 255, 255, 0.035);
}

.coming-soon-card:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  border-left-color: rgba(107, 114, 128, 0.6);
}

.coming-soon-card-header {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.02);
}

.coming-soon-card-header-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coming-soon-card-header-icon {
  font-size: 14px;
  line-height: 1;
}

.coming-soon-card-header-text {
  color: white;
  font-weight: 600;
  font-size: 14px;
  margin: 0;
  letter-spacing: -0.01em;
}

.coming-soon-card-header-time {
  color: #6b7280;
  font-size: 12px;
  margin: 0;
  font-weight: 500;
}

.coming-soon-card-content {
  padding: 32px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.coming-soon-card-placeholder {
  text-align: center;
  max-width: 320px;
}

.coming-soon-card-icon-large {
  font-size: 36px;
  margin-bottom: 12px;
  opacity: 0.6;
  filter: grayscale(0.3);
}

.coming-soon-card-title {
  color: white;
  font-weight: 600;
  font-size: 16px;
  margin: 0 0 6px 0;
  letter-spacing: -0.01em;
}

.coming-soon-card-description {
  color: #9ca3af;
  font-size: 13px;
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.coming-soon-card-details {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.coming-soon-card-detail-label {
  color: #6b7280;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.coming-soon-card-detail-value {
  color: #9ca3af;
  font-size: 10px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  margin: 0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}
</style>
