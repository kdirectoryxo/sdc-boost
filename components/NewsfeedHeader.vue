<script lang="ts" setup>
import { ref, computed } from 'vue';
import Dropdown from './ui/Dropdown.vue';
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

// Content type filter options (first dropdown) - "Algemeen" (General area)
const contentFilters = [
  { key: 'group_post_blog', label: 'Groepen / Blogs', icon: 'users' },
  { key: 'speed_area', label: 'Speed Date', icon: 'zap' },
  { key: 'travelplans_area', label: 'Reisplannen', icon: 'map' },
  { key: 'my_parties', label: "Party's & Events", icon: 'party' },
];

// Activity filter options (second dropdown) - "Vrienden" (Friends area)
const activityFilters = [
  { key: 'likes_sent', label: 'Likes gegeven', icon: 'heart' },
  { key: 'group_joined', label: 'Groepslid geworden', icon: 'user-plus' },
  { key: 'photos_videos', label: "Foto's & Video's", icon: 'image' },
  { key: 'validations', label: 'Validaties', icon: 'check' },
  { key: 'birthday', label: 'Verjaardag', icon: 'cake' },
  { key: 'speedating', label: 'Speed Date (Vrienden)', icon: 'zap' },
  { key: 'travelplans', label: 'Reisplannen (Vrienden)', icon: 'map' },
  { key: 'parties', label: "Party's & Events", icon: 'party' },
  { key: 'member_services', label: 'Ledenservice', icon: 'info' },
  { key: 'friends_new', label: 'Nieuwe vrienden / volgers', icon: 'users' },
];

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

// Count active filters
const activeContentCount = computed(() => 
  contentFilters.filter(f => isContentFilterActive(f.key)).length
);

const activeActivityCount = computed(() => 
  activityFilters.filter(f => isActivityFilterActive(f.key)).length
);

// Check if all filters are selected
const allContentFiltersSelected = computed(() => 
  contentFilters.every(f => isContentFilterActive(f.key))
);

const allActivityFiltersSelected = computed(() => 
  activityFilters.every(f => isActivityFilterActive(f.key))
);

// Select all content filters
const selectAllContentFilters = () => {
  const newFilters = { ...props.filters };
  contentFilters.forEach(filter => {
    (newFilters as any)[filter.key] = true;
  });
  emit('filters-change', newFilters);
};

// Clear all content filters
const clearAllContentFilters = () => {
  const newFilters = { ...props.filters };
  contentFilters.forEach(filter => {
    (newFilters as any)[filter.key] = false;
  });
  emit('filters-change', newFilters);
};

// Select all activity filters
const selectAllActivityFilters = () => {
  const newFilters = { ...props.filters };
  activityFilters.forEach(filter => {
    (newFilters as any)[filter.key] = true;
  });
  emit('filters-change', newFilters);
};

// Clear all activity filters
const clearAllActivityFilters = () => {
  const newFilters = { ...props.filters };
  activityFilters.forEach(filter => {
    (newFilters as any)[filter.key] = false;
  });
  emit('filters-change', newFilters);
};
</script>

<template>
  <div class="newsfeed-header">
    <div class="newsfeed-header-filters">
      <!-- Content Type Filter Dropdown -->
      <Dropdown v-model="contentFilterOpen" placement="bottom" alignment="start" width="w-64" offset="mt-1">
        <template #trigger="{ toggle }">
          <button 
            @click.stop="toggle"
            :class="['filter-chip', { 'filter-chip-active': activeContentCount > 0 }]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <span class="filter-chip-value">Algemeen</span>
            <span v-if="activeContentCount > 0" class="filter-badge">{{ activeContentCount }}</span>
            <svg class="filter-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </template>
        <template #content>
          <div class="filter-dropdown">
            <div class="filter-dropdown-header">
              <span>Algemeen</span>
              <div class="filter-dropdown-actions">
                <button 
                  class="filter-action-button"
                  @click.stop="clearAllContentFilters"
                  :disabled="activeContentCount === 0"
                >
                  Wis alles
                </button>
                <button 
                  class="filter-action-button"
                  @click.stop="selectAllContentFilters"
                  :disabled="allContentFiltersSelected"
                >
                  Selecteer alles
                </button>
              </div>
            </div>
            <div class="filter-menu">
              <button
                v-for="filter in contentFilters"
                :key="filter.key"
                @click="toggleContentFilter(filter.key)"
                :class="['filter-menu-item', { active: isContentFilterActive(filter.key) }]"
              >
                <div class="filter-checkbox-wrapper">
                  <div :class="['filter-checkbox', { 'filter-checkbox-checked': isContentFilterActive(filter.key) }]">
                    <svg v-if="isContentFilterActive(filter.key)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
                <span>{{ filter.label }}</span>
              </button>
            </div>
          </div>
        </template>
      </Dropdown>

      <!-- Activity Filter Dropdown -->
      <Dropdown v-model="activityFilterOpen" placement="bottom" alignment="start" width="w-64" offset="mt-1">
        <template #trigger="{ toggle }">
          <button 
            @click.stop="toggle"
            :class="['filter-chip', { 'filter-chip-active': activeActivityCount > 0 }]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span class="filter-chip-value">Vrienden</span>
            <span v-if="activeActivityCount > 0" class="filter-badge">{{ activeActivityCount }}</span>
            <svg class="filter-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </template>
        <template #content>
          <div class="filter-dropdown">
            <div class="filter-dropdown-header">
              <span>Vrienden</span>
              <div class="filter-dropdown-actions">
                <button 
                  class="filter-action-button"
                  @click.stop="clearAllActivityFilters"
                  :disabled="activeActivityCount === 0"
                >
                  Wis alles
                </button>
                <button 
                  class="filter-action-button"
                  @click.stop="selectAllActivityFilters"
                  :disabled="allActivityFiltersSelected"
                >
                  Selecteer alles
                </button>
              </div>
            </div>
            <div class="filter-menu filter-menu-scrollable">
              <button
                v-for="filter in activityFilters"
                :key="filter.key"
                @click="toggleActivityFilter(filter.key)"
                :class="['filter-menu-item', { active: isActivityFilterActive(filter.key) }]"
              >
                <div class="filter-checkbox-wrapper">
                  <div :class="['filter-checkbox', { 'filter-checkbox-checked': isActivityFilterActive(filter.key) }]">
                    <svg v-if="isActivityFilterActive(filter.key)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
                <span>{{ filter.label }}</span>
              </button>
            </div>
          </div>
        </template>
      </Dropdown>
    </div>
  </div>
</template>

<style scoped>
.newsfeed-header {
  padding: 8px 14px;
}

.newsfeed-header-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Filter Chips (Dropdowns) - matching PeopleDialog */
.filter-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  color: #e5e7eb;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.filter-chip:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.filter-chip svg {
  color: #6b7280;
  flex-shrink: 0;
}

.filter-chip-value {
  color: white;
}

.filter-chip-active {
  background: rgba(96, 165, 250, 0.15);
  border-color: rgba(96, 165, 250, 0.3);
}

.filter-chip-active .filter-chip-value {
  color: white;
}

.filter-chip-active svg:first-child {
  color: #60a5fa;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  background: #ef4444;
  color: white;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
}

.filter-chevron {
  opacity: 0.5;
  margin-left: auto;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.filter-dropdown {
  padding: 4px;
}

.filter-dropdown-header {
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.filter-dropdown-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.filter-action-button {
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 500;
  color: #9ca3af;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.filter-action-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  color: #e5e7eb;
}

.filter-action-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Filter Menu - matching PeopleDialog */
.filter-menu {
  padding: 4px;
}

.filter-menu-scrollable {
  max-height: 280px;
  overflow-y: auto;
}

.filter-menu-scrollable::-webkit-scrollbar {
  width: 6px;
}

.filter-menu-scrollable::-webkit-scrollbar-track {
  background: transparent;
}

.filter-menu-scrollable::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.filter-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.1s ease;
}

.filter-menu-item .filter-checkbox-wrapper,
.filter-menu-item svg {
  flex-shrink: 0;
}

.filter-menu-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: white;
}

.filter-menu-item.active {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.filter-checkbox-wrapper {
  flex-shrink: 0;
}

.filter-checkbox {
  width: 16px;
  height: 16px;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.filter-checkbox svg {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

.filter-checkbox-checked {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: #3b82f6;
  color: white;
}

</style>
