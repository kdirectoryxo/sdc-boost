/**
 * Newsfeed Filter Cache
 * Caches newsfeed filter options to avoid waiting on API calls
 */
import type { NewsfeedFilterOptions } from '@/lib/sdc-api/newsfeed';

const CACHE_KEY = 'sdc-boost-newsfeed-filters';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CachedFilters {
  filters: NewsfeedFilterOptions;
  timestamp: number;
}

/**
 * Get cached filters if they exist and are not expired
 */
export function getCachedFilters(): NewsfeedFilterOptions | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedFilters = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired
    if (now - parsed.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.filters;
  } catch (error) {
    console.error('[NewsfeedFilterCache] Failed to read cache:', error);
    return null;
  }
}

/**
 * Cache filters
 */
export function setCachedFilters(filters: NewsfeedFilterOptions): void {
  try {
    const cached: CachedFilters = {
      filters,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.error('[NewsfeedFilterCache] Failed to write cache:', error);
  }
}

/**
 * Clear cached filters
 */
export function clearCachedFilters(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('[NewsfeedFilterCache] Failed to clear cache:', error);
  }
}
