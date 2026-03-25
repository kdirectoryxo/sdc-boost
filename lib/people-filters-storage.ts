/**
 * People Filters Storage
 * Handles persistence of People dialog filters (viewed and online) in localStorage
 */
import type { ViewedFilters, OnlineFilters, LatestMembersFilters } from '@/components/PeopleList.vue';
import type { AgeFilterMode } from '@/lib/people-age-filter';

// Re-export types for convenience
export type { ViewedFilters, OnlineFilters, LatestMembersFilters };
export type { AgeFilterMode };

export interface ClientSideFilters {
  ageMin: number | null;
  ageMax: number | null;
  kmWithin: number | null;
  /** Which person’s age counts toward the range (couples: per gender1/gender2). */
  ageFilterMode: AgeFilterMode;
}

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

const DEFAULT_CLIENT_SIDE_FILTERS: ClientSideFilters = {
  ageMin: null,
  ageMax: null,
  kmWithin: null,
  ageFilterMode: 'any',
};

const DEFAULT_LATEST_MEMBERS_FILTERS: LatestMembersFilters = {
  gender: 1,  // Vrouw (default based on curl example)
  looking_for_me: 0,  // Disabled (default)
};

interface PeopleFiltersStorage {
  viewedFilters?: ViewedFilters;
  onlineFilters?: OnlineFilters;
  clientSideFilters?: ClientSideFilters;
  latestMembersFilters?: LatestMembersFilters;
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

/**
 * Get client-side filters from storage
 * Returns default values if not stored
 */
export function getClientSideFilters(): ClientSideFilters {
  try {
    const storedStr = localStorage.getItem(STORAGE_KEY);
    if (storedStr) {
      const stored: PeopleFiltersStorage = JSON.parse(storedStr);
      if (stored.clientSideFilters) {
        return { ...DEFAULT_CLIENT_SIDE_FILTERS, ...stored.clientSideFilters };
      }
    }
    return { ...DEFAULT_CLIENT_SIDE_FILTERS };
  } catch (error) {
    console.error('[People Filters] Error getting client-side filters:', error);
    return { ...DEFAULT_CLIENT_SIDE_FILTERS };
  }
}

/**
 * Set client-side filters in storage
 */
export function setClientSideFilters(filters: ClientSideFilters): void {
  try {
    const storedStr = localStorage.getItem(STORAGE_KEY);
    const stored: PeopleFiltersStorage = storedStr ? JSON.parse(storedStr) : {};
    stored.clientSideFilters = filters;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.error('[People Filters] Error setting client-side filters:', error);
  }
}

/**
 * Get latest members filters from storage
 * Returns default values if not stored
 */
export function getLatestMembersFilters(): LatestMembersFilters {
  try {
    const storedStr = localStorage.getItem(STORAGE_KEY);
    if (storedStr) {
      const stored: PeopleFiltersStorage = JSON.parse(storedStr);
      if (stored.latestMembersFilters) {
        return { ...DEFAULT_LATEST_MEMBERS_FILTERS, ...stored.latestMembersFilters };
      }
    }
    return { ...DEFAULT_LATEST_MEMBERS_FILTERS };
  } catch (error) {
    console.error('[People Filters] Error getting latest members filters:', error);
    return { ...DEFAULT_LATEST_MEMBERS_FILTERS };
  }
}

/**
 * Set latest members filters in storage
 */
export function setLatestMembersFilters(filters: LatestMembersFilters): void {
  try {
    const storedStr = localStorage.getItem(STORAGE_KEY);
    const stored: PeopleFiltersStorage = storedStr ? JSON.parse(storedStr) : {};
    stored.latestMembersFilters = filters;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.error('[People Filters] Error setting latest members filters:', error);
  }
}
