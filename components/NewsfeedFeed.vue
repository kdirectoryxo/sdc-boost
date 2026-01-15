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
      // Optionally show error toast
    } finally {
      filtersLoading.value = false;
    }
  }
};
</script>

<template>
  <div class="newsfeed-container">
    <NewsfeedHeader 
      :active-tab="activeTab"
      :filters="filters"
      @filters-change="handleFiltersChange"
    />
    <NewsfeedTabs 
      :active-tab="activeTab"
      @tab-change="handleTabChange"
    />
    <NewsfeedList 
      v-if="filtersReady"
      :active-tab="activeTab"
      :filters="filters"
    />
    <div v-else class="newsfeed-loading-filters">
      <p>Loading filters...</p>
    </div>
  </div>
</template>

<style scoped>
.newsfeed-container {
  background-color: #262B2F;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.newsfeed-loading-filters {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: #9ca3af;
}
</style>
