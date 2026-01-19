<script lang="ts" setup>
import NewsfeedList from './NewsfeedList.vue';
import type { NewsfeedFilterOptions } from '@/lib/sdc-api/newsfeed';

interface Props {
  activeTab: 'feed' | 'admin';
  filters: Partial<NewsfeedFilterOptions>;
  filtersReady: boolean;
}

defineProps<Props>();
</script>

<template>
  <div class="newsfeed-container">
    <!-- Feed Content -->
    <div class="newsfeed-content">
      <NewsfeedList 
        v-if="filtersReady"
        :active-tab="activeTab"
        :filters="filters"
      />
      <div v-else class="newsfeed-loading-filters">
        <div class="loading-spinner"></div>
        <p>Loading filters...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.newsfeed-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.newsfeed-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* Custom scrollbar */
.newsfeed-content::-webkit-scrollbar {
  width: 8px;
}

.newsfeed-content::-webkit-scrollbar-track {
  background: transparent;
}

.newsfeed-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}

.newsfeed-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.12);
}

.newsfeed-loading-filters {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  gap: 16px;
  color: #6b7280;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
