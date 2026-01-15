<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import NewsfeedHeader from './NewsfeedHeader.vue';
import NewsfeedTabs from './NewsfeedTabs.vue';
import NewsfeedList from './NewsfeedList.vue';
import { getNewsfeedFilters, updateNewsfeedFilters } from '@/lib/sdc-api/newsfeed';
import type { NewsfeedFilterOptions } from '@/lib/sdc-api/newsfeed';
import { getCachedFilters, setCachedFilters } from '@/lib/newsfeed-filter-cache';

const activeTab = ref<'feed' | 'admin'>('feed');
const filters = ref<Partial<NewsfeedFilterOptions>>({});
const filtersLoading = ref(false);
const filtersReady = ref(false);

// Load initial filters (with caching)
onMounted(async () => {
  // Try to load from cache first
  const cachedFilters = getCachedFilters();
  if (cachedFilters) {
    filters.value = cachedFilters;
    filtersReady.value = true;
    console.log('[NewsfeedFeed] Loaded filters from cache');
  }

  // Always fetch fresh filters in background and update cache
  try {
    const response = await getNewsfeedFilters();
    filters.value = response.info.options;
    setCachedFilters(response.info.options);
    filtersReady.value = true;
    console.log('[NewsfeedFeed] Loaded filters from API and cached');
  } catch (error) {
    console.error('[NewsfeedFeed] Failed to load filters:', error);
    // If we have cached filters, use them; otherwise mark as ready with empty filters
    if (!cachedFilters) {
      filtersReady.value = true;
    }
  }
});

const handleTabChange = (tab: 'feed' | 'admin') => {
  activeTab.value = tab;
};

const handleFiltersChange = async (newFilters: Partial<NewsfeedFilterOptions>) => {
  filters.value = { ...filters.value, ...newFilters };
  
  // Update cache immediately for faster subsequent loads
  setCachedFilters(filters.value as NewsfeedFilterOptions);
  
  // Update filters on server
  if (!filtersLoading.value) {
    filtersLoading.value = true;
    try {
      await updateNewsfeedFilters(filters.value);
      // Update cache after successful server update
      setCachedFilters(filters.value as NewsfeedFilterOptions);
    } catch (error) {
      console.error('[NewsfeedFeed] Failed to update filters:', error);
    } finally {
      filtersLoading.value = false;
    }
  }
};
</script>

<template>
  <div class="newsfeed-container">
    <!-- Tabs and Filters Section -->
    <div class="newsfeed-controls">
      <NewsfeedTabs 
        :active-tab="activeTab"
        @tab-change="handleTabChange"
      />
      <NewsfeedHeader 
        :active-tab="activeTab"
        :filters="filters"
        @filters-change="handleFiltersChange"
      />
    </div>
    
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
  background-color: #1a1d21;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.newsfeed-controls {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
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
