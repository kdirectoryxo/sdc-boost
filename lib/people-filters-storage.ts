/**
 * People Filters Storage
 * Handles persistence of People dialog filters (viewed and online) in localStorage
 */
import type { ViewedFilters, OnlineFilters } from '@/components/PeopleList.vue';

// Re-export types for convenience
export type { ViewedFilters, OnlineFilters };

const STORAGE_KEY = 'sdc-boost-people-filters';

// Default values
const DEFAULT_VIEWED_FILTERS: ViewedFilters = {
  select: 1,  // Views (default)
  order: 1,   // Meest recente (default)
  gender: 9,  // Allemaal (default)
};

const DEFAULT_ONLINE_FILTERS: OnlineFilters = {
  genders: [2, 1, 0, 3],  // All genders selected (default)
  looking_for_me: 1,      // Enabled (default)
  business_profile: 0,     // Disabled (default)
  birthday: 0,             // Disabled (default)
  speed_dating: 0,         // Disabled (default)
  video: 0,               // Disabled (default)
  pictures: 0,             // Disabled (default)
};

interface PeopleFiltersStorage {
  viewedFilters?: ViewedFilters;
  onlineFilters?: OnlineFilters;
}

/**
 * Get viewed filters from storage
 * Returns default values if not stored
 */
export function getViewedFilters(): ViewedFilters {
  try {
    const storedStr = localStorage.getItem(STORAGE_KEY);
    if (storedStr) {
      const stored: PeopleFiltersStorage = JSON.parse(storedStr);
      if (stored.viewedFilters) {
        return { ...DEFAULT_VIEWED_FILTERS, ...stored.viewedFilters };
      }
    }
    return { ...DEFAULT_VIEWED_FILTERS };
  } catch (error) {
    console.error('[People Filters] Error getting viewed filters:', error);
    return { ...DEFAULT_VIEWED_FILTERS };
  }
}

/**
 * Set viewed filters in storage
 */
export function setViewedFilters(filters: ViewedFilters): void {
  try {
    const storedStr = localStorage.getItem(STORAGE_KEY);
    const stored: PeopleFiltersStorage = storedStr ? JSON.parse(storedStr) : {};
    stored.viewedFilters = filters;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.error('[People Filters] Error setting viewed filters:', error);
  }
}

/**
 * Get online filters from storage
 * Returns default values if not stored
 */
export function getOnlineFilters(): OnlineFilters {
  try {
    const storedStr = localStorage.getItem(STORAGE_KEY);
    if (storedStr) {
      const stored: PeopleFiltersStorage = JSON.parse(storedStr);
      if (stored.onlineFilters) {
        const loaded = { ...DEFAULT_ONLINE_FILTERS, ...stored.onlineFilters };
        // Ensure genders is always an array
        if (!Array.isArray(loaded.genders)) {
          loaded.genders = [...DEFAULT_ONLINE_FILTERS.genders];
        }
        return loaded;
      }
    }
    return { ...DEFAULT_ONLINE_FILTERS };
  } catch (error) {
    console.error('[People Filters] Error getting online filters:', error);
    return { ...DEFAULT_ONLINE_FILTERS };
  }
}

/**
 * Set online filters in storage
 */
export function setOnlineFilters(filters: OnlineFilters): void {
  try {
    const storedStr = localStorage.getItem(STORAGE_KEY);
    const stored: PeopleFiltersStorage = storedStr ? JSON.parse(storedStr) : {};
    stored.onlineFilters = filters;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.error('[People Filters] Error setting online filters:', error);
  }
}
