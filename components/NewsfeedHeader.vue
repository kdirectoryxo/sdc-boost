<script lang="ts" setup>
import { ref, computed } from 'vue';
import Dropdown from './ui/Dropdown.vue';
import Button from './ui/Button.vue';
import type { NewsfeedFilterOptions } from '@/lib/sdc-api/newsfeed';

interface Props {
  activeTab: 'feed' | 'admin';
  filters: Partial<NewsfeedFilterOptions>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'filters-change': [filters: Partial<NewsfeedFilterOptions>];
}>();

const contentFilterOpen = ref(false);
const activityFilterOpen = ref(false);

// Content type filter options (first dropdown)
const contentFilters = [
  { key: 'group_post_blog', label: 'Groepen / Blogs' },
  { key: 'speedating', label: 'Speed Date' },
  { key: 'travelplans', label: 'Reisplannen' },
  { key: 'parties', label: "Party's & Events" },
];

// Activity filter options (second dropdown)
const activityFilters = [
  { key: 'likes_sent', label: 'Likes gegeven' },
  { key: 'group_joined', label: 'Groepslid geworden' },
  { key: 'photos_videos', label: "Foto's & Video's" },
  { key: 'validations', label: 'Validaties' },
  { key: 'birthday', label: 'Verjaardag' },
  { key: 'speedating', label: 'Speed Date' },
  { key: 'travelplans', label: 'Reisplannen' },
  { key: 'parties', label: "Party's & Events" },
  { key: 'member_services', label: 'Ledenservice' },
  { key: 'friends_new', label: 'Nieuwe vrienden / volgers' },
];

const title = computed(() => {
  return props.activeTab === 'feed' ? 'Feed' : 'SDC Berichten';
});

const toggleContentFilter = (key: string) => {
  const newFilters = { ...props.filters };
  const currentValue = props.filters[key as keyof NewsfeedFilterOptions] ?? false;
  (newFilters as any)[key] = !currentValue;
  emit('filters-change', newFilters);
};

const toggleActivityFilter = (key: string) => {
  const newFilters = { ...props.filters };
  const currentValue = props.filters[key as keyof NewsfeedFilterOptions] ?? false;
  (newFilters as any)[key] = !currentValue;
  emit('filters-change', newFilters);
};

const isContentFilterActive = (key: string) => {
  return props.filters[key as keyof NewsfeedFilterOptions] ?? false;
};

const isActivityFilterActive = (key: string) => {
  return props.filters[key as keyof NewsfeedFilterOptions] ?? false;
};
</script>

<template>
  <div class="newsfeed-header">
    <h1 class="newsfeed-header-title">{{ title }}</h1>
    
    <div class="newsfeed-header-actions">
      <!-- Content Type Filter Dropdown -->
      <Dropdown v-model="contentFilterOpen" placement="bottom" alignment="end" width="w-56" :z-index="10000000">
        <template #trigger="{ toggle }">
          <Button 
            variant="outline" 
            size="sm"
            @click="toggle"
            class="text-sm"
          >
            Content Type
          </Button>
        </template>
        <template #content>
          <div class="newsfeed-filter-dropdown-content">
            <div 
              v-for="filter in contentFilters"
              :key="filter.key"
              class="newsfeed-filter-dropdown-item"
              @click="toggleContentFilter(filter.key)"
            >
              <input 
                type="checkbox" 
                :checked="isContentFilterActive(filter.key)"
                class="newsfeed-filter-dropdown-checkbox"
                @change="toggleContentFilter(filter.key)"
              />
              <span class="newsfeed-filter-dropdown-label">{{ filter.label }}</span>
            </div>
          </div>
        </template>
      </Dropdown>

      <!-- Activity Filter Dropdown -->
      <Dropdown v-model="activityFilterOpen" placement="bottom" alignment="end" width="w-56" :z-index="10000000">
        <template #trigger="{ toggle }">
          <Button 
            variant="outline" 
            size="sm"
            @click="toggle"
            class="text-sm"
          >
            Activity
          </Button>
        </template>
        <template #content>
          <div class="newsfeed-filter-dropdown-content" style="max-height: 384px; overflow-y: auto;">
            <div 
              v-for="filter in activityFilters"
              :key="filter.key"
              class="newsfeed-filter-dropdown-item"
              @click="toggleActivityFilter(filter.key)"
            >
              <input 
                type="checkbox" 
                :checked="isActivityFilterActive(filter.key)"
                class="newsfeed-filter-dropdown-checkbox"
                @change="toggleActivityFilter(filter.key)"
              />
              <span class="newsfeed-filter-dropdown-label">{{ filter.label }}</span>
            </div>
          </div>
        </template>
      </Dropdown>
    </div>
  </div>
</template>

<style scoped>
.newsfeed-header {
  background-color: #2E353B;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.newsfeed-header-title {
  font-size: 20px;
  font-weight: bold;
  color: white;
}

.newsfeed-header-actions {
  display: flex;
  gap: 8px;
}

.newsfeed-filter-dropdown-content {
  padding: 8px;
  max-height: 384px;
  overflow-y: auto;
}

.newsfeed-filter-dropdown-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.newsfeed-filter-dropdown-item:hover {
  background-color: #333;
}

.newsfeed-filter-dropdown-checkbox {
  width: 16px;
  height: 16px;
}

.newsfeed-filter-dropdown-label {
  font-size: 14px;
  color: white;
}
</style>
