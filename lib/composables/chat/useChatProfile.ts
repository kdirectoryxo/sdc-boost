/**
 * Composable for fetching and caching profile data for chats
 * Provides reactive profile data that updates when profiles are synced
 */

import { ref, computed, watch, type Ref } from 'vue';
import type { ProfileUser } from '@/lib/sdc-api-types';
import { db } from '@/lib/db';
import { useLiveQuery } from '@/lib/composables/useLiveQuery';

/**
 * Fetch profile data for a chat user
 * Uses reactive liveQuery to automatically update when profiles are synced
 * @param dbId The user's DB_ID (can be a ref or a static value)
 * @returns Reactive profile data with loading and error states
 */
export function useChatProfile(dbId: Ref<number | null | undefined> | number | null | undefined) {
  const dbIdRef = typeof dbId === 'number' || dbId === null || dbId === undefined 
    ? ref(dbId) 
    : dbId;

  // Create a ref for the dbId to use in liveQuery dependencies
  const dbIdForQuery = computed(() => {
    const id = typeof dbIdRef === 'object' && 'value' in dbIdRef 
      ? (dbIdRef as Ref<number | null | undefined>).value 
      : (typeof dbIdRef === 'number' ? dbIdRef : null);
    return id && id > 0 ? id : null;
  });

  // Use liveQuery to reactively watch the profiles table
  // This will automatically update when profiles are synced
  const profileQuery = useLiveQuery(async () => {
    const id = dbIdForQuery.value;
    if (!id) {
      return null;
    }

    try {
      const profileEntity = await db.profiles.get(id);
      if (!profileEntity) {
        return null;
      }
      
      // ProfileUser includes db_id, so return it as-is
      return profileEntity as ProfileUser;
    } catch (error) {
      console.warn(`[useChatProfile] Failed to get profile ${id}:`, error);
      return null;
    }
  }, [dbIdForQuery]);

  // Computed properties for reactive access
  const profileData = computed(() => profileQuery.value || null);
  const isLoading = computed(() => false); // liveQuery handles loading internally
  const error = computed(() => null); // No error handling needed for cache-only

  // Check if dbId is valid (not null/undefined and not a broadcast)
  const isValidDbId = computed(() => {
    return dbIdForQuery.value !== null;
  });

  // Manual refresh function (for compatibility, but liveQuery handles reactivity)
  async function fetchProfile() {
    // liveQuery handles reactivity automatically, this is just for compatibility
    // The profileData will update automatically when the database changes
  }

  return {
    profileData,
    isLoading,
    error,
    fetchProfile,
    isValidDbId,
  };
}

/**
 * Helper function to get age color class based on gender
 * @param gender Gender value (1 = female = pink, 0 = male = blue)
 * @returns Tailwind CSS color class
 */
export function getAgeColorClass(gender: number | undefined): string {
  return gender === 1 ? 'text-pink-300' : 'text-blue-300';
}

/**
 * Helper function to format location with distance
 * @param location Location string
 * @param distance Distance in km
 * @returns Formatted location string
 */
export function formatLocation(location: string | undefined, distance: number | undefined): string {
  if (!location) return '';
  if (distance !== undefined && distance > 0) {
    return `${location} | ${distance} km`;
  }
  return location;
}

/**
 * Helper function to check if an age is valid (between 18-100)
 * @param age Age value
 * @returns True if age is valid
 */
export function isValidAge(age: number | undefined): boolean {
  if (age === undefined || age === null) return false;
  return age >= 18 && age <= 100;
}

/**
 * Helper function to check if gender2 is a real person
 * Gender2 is not real if age is > 100, undefined, or < 18
 * @param g2Age Gender2 age
 * @param g2Nick Gender2 nickname (optional, for additional validation)
 * @returns True if gender2 is a real person
 */
export function isGender2Real(g2Age: number | undefined, g2Nick?: string | undefined): boolean {
  if (!g2Age || g2Age > 100 || g2Age < 18) return false;
  
  // Additional check: if g2_nick is "Person 2" or similar placeholder, it's likely not real
  if (g2Nick && (g2Nick.toLowerCase().includes('person 2') || g2Nick.toLowerCase().includes('placeholder'))) {
    return false;
  }
  
  return true;
}
