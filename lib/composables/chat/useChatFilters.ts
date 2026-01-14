import { ref, computed, watch } from 'vue';
import { createGlobalState } from '@vueuse/core';
import { chatStorage } from '@/lib/chat-storage';
import { messageStorage } from '@/lib/message-storage';
import { useChatState } from './useChatState';
import { useLiveQuery } from '@/lib/composables/useLiveQuery';
import { db } from '@/lib/db';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { tagChangeTrigger } from '@/lib/sdc-db/tag-change-trigger';
import { useSDCDatabaseStore } from '@/lib/sdc-db/store';
import { getTagsForChat } from '@/lib/sdc-db/tags';
import { getChatKey } from './utils';

export const useChatFilters = createGlobalState(() => {
  const { chatList, selectedFolderId, showArchives } = useChatState();
  const { isReady: dbIsReady } = useSDCDatabaseStore();
  
  const searchQuery = ref('');
  const filterUnread = ref<boolean>(false);
  const filterPinned = ref<boolean>(false);
  const filterOnline = ref<boolean>(false);
  const filterLastMessageByMe = ref<boolean>(false);
  const filterLastMessageByOther = ref<boolean>(false);
  const filterOnlyMyMessages = ref<boolean>(false);
  const filterBlocked = ref<boolean>(false);
  const filterCouples = ref<boolean>(false);
  const filterFemales = ref<boolean>(false);
  const isFilterDropdownOpen = ref<boolean>(false);
  const selectedTagIds = ref<Set<number>>(new Set());
  
  // Computed to track selected tag IDs for reactivity (used in dependency array)
  // Convert Set to string for reliable dependency tracking
  const selectedTagIdsKey = computed(() => {
    return Array.from(selectedTagIds.value).sort().join(',');
  });
  
  // Sort state
  const sortByOnline = ref<'asc' | 'desc' | null>(null);
  const sortByDistance = ref<'asc' | 'desc' | null>(null);
  const disablePinnedSort = ref<boolean>(false); // If true, pinned chats won't be forced to top
  const isSortDropdownOpen = ref<boolean>(false);
  
  // Reactive filtered chats using liveQuery
  const filteredChats = useLiveQuery(async () => {
    const hasSearchQuery = searchQuery.value.trim().length > 0;
    const currentQuery = searchQuery.value.trim();
    
    // First, get chat metadata matches (exact matches will be prioritized in searchChats)
    const chatMetadataMatches = await chatStorage.searchChats({
      query: hasSearchQuery ? currentQuery : undefined,
      folderId: selectedFolderId.value === -1 ? null : selectedFolderId.value,
      unreadOnly: filterUnread.value,
      pinnedOnly: filterPinned.value,
      onlineOnly: filterOnline.value,
      lastMessageByMe: filterLastMessageByMe.value,
      lastMessageByOther: filterLastMessageByOther.value,
      onlyMyMessages: filterOnlyMyMessages.value,
      blockedOnly: filterBlocked.value,
      couplesOnly: filterCouples.value,
      femalesOnly: filterFemales.value,
      showArchives: showArchives.value,
    });
    
    // If we have a search query, also search in saved messages
    let messageSearchMatches: typeof chatList.value = [];
    if (hasSearchQuery) {
      const matchingGroupIds = await messageStorage.searchMessages(
        currentQuery,
        selectedFolderId.value ?? undefined
      );
    
      if (matchingGroupIds.size > 0) {
        // Get chats that match the message search, applying other filters
        const allChatsForMessages = await chatStorage.searchChats({
          folderId: selectedFolderId.value === -1 ? null : selectedFolderId.value,
          unreadOnly: filterUnread.value,
          pinnedOnly: filterPinned.value,
          onlineOnly: filterOnline.value,
          lastMessageByMe: filterLastMessageByMe.value,
      lastMessageByOther: filterLastMessageByOther.value,
      onlyMyMessages: filterOnlyMyMessages.value,
      blockedOnly: filterBlocked.value,
      couplesOnly: filterCouples.value,
      femalesOnly: filterFemales.value,
      showArchives: showArchives.value,
        });
        
        // Filter to only include chats with matching messages
        messageSearchMatches = allChatsForMessages.filter(chat => matchingGroupIds.has(chat.group_id));
        
        // Remove chats that are already in chatMetadataMatches to avoid duplicates
        // Use getChatKey for proper deduplication (handles broadcasts correctly)
        const chatMetadataKeys = new Set(chatMetadataMatches.map(c => getChatKey(c)));
        messageSearchMatches = messageSearchMatches.filter(chat => !chatMetadataKeys.has(getChatKey(chat)));
      }
    }
    
    // Combine results: exact matches first (from chatMetadataMatches), then partial chat matches, then message matches
    let combinedResults = [...chatMetadataMatches, ...messageSearchMatches];
    
    // Deduplicate using getChatKey (handles broadcasts correctly)
    const seenKeys = new Set<string>();
    combinedResults = combinedResults.filter(chat => {
      const key = getChatKey(chat);
      if (seenKeys.has(key)) {
        return false;
      }
      seenKeys.add(key);
      return true;
    });
    
    // Map to get latest chat objects from reactive chatList (with tags)
    // Use getChatKey for proper mapping (handles broadcasts correctly)
    const chatListMap = new Map(chatList.value.map(c => [getChatKey(c), c]));
    combinedResults = combinedResults.map(chat => chatListMap.get(getChatKey(chat)) || chat);
    
    // Apply tag filtering if any tags are selected
    if (selectedTagIds.value.size > 0 && dbIsReady.value) {
      combinedResults = combinedResults.filter(chat => {
        const chatTags = getTagsForChat(chat.group_id);
        const chatTagIds = new Set(chatTags.map(t => t.id));
        // Chat must have at least one of the selected tags
        return Array.from(selectedTagIds.value).some(tagId => chatTagIds.has(tagId));
      });
    }
    
    // Always apply sorting (includes default date_time sort when no sort is active)
    combinedResults = await applySorting(combinedResults);
    
    return combinedResults;
  }, [searchQuery, selectedFolderId, showArchives, filterUnread, filterPinned, filterOnline, filterLastMessageByMe, filterLastMessageByOther, filterOnlyMyMessages, filterBlocked, filterCouples, filterFemales, sortByOnline, sortByDistance, disablePinnedSort, chatList, selectedTagIdsKey, tagChangeTrigger, dbIsReady]);
  
  const isLoadingFilteredChats = ref(false);
  let currentSearchPromise: Promise<void> | null = null;
  let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Computed property to check if any filters are active
  const hasActiveFilters = computed(() => {
    return filterUnread.value || filterPinned.value || filterOnline.value || 
           filterLastMessageByMe.value || filterLastMessageByOther.value || filterOnlyMyMessages.value ||
           filterBlocked.value || filterCouples.value || filterFemales.value || selectedTagIds.value.size > 0;
  });
  
  // Computed property to count active filters
  const activeFilterCount = computed(() => {
    let count = 0;
    if (filterUnread.value) count++;
    if (filterPinned.value) count++;
    if (filterOnline.value) count++;
    if (filterLastMessageByMe.value) count++;
    if (filterLastMessageByOther.value) count++;
    if (filterOnlyMyMessages.value) count++;
    if (filterBlocked.value) count++;
    if (filterCouples.value) count++;
    if (filterFemales.value) count++;
    if (selectedTagIds.value.size > 0) count++;
    return count;
  });
  
  /**
   * Function to search chats using IndexedDB
   * @deprecated Filtered chats are now reactive via liveQuery
   */
  async function updateFilteredChats(): Promise<void> {
    // No-op: filteredChats are now reactive via liveQuery
    console.log('[useChatFilters] updateFilteredChats is deprecated - filtered chats are now reactive');
  }
  
  /**
   * Toggle a specific filter
   */
  function toggleFilter(filterType: 'unread' | 'pinned' | 'online'): void {
    switch (filterType) {
      case 'unread':
        filterUnread.value = !filterUnread.value;
        break;
      case 'pinned':
        filterPinned.value = !filterPinned.value;
        break;
      case 'online':
        filterOnline.value = !filterOnline.value;
        break;
    }
  }
  
  /**
   * Clear all active filters
   */
  function clearAllFilters(): void {
    filterUnread.value = false;
    filterPinned.value = false;
    filterOnline.value = false;
    filterLastMessageByMe.value = false;
    filterLastMessageByOther.value = false;
    filterOnlyMyMessages.value = false;
    filterBlocked.value = false;
    filterCouples.value = false;
    filterFemales.value = false;
    selectedTagIds.value.clear();
  }
  
  /**
   * Toggle tag filter selection
   */
  function toggleTagFilter(tagId: number): void {
    const newSet = new Set(selectedTagIds.value);
    if (newSet.has(tagId)) {
      newSet.delete(tagId);
    } else {
      newSet.add(tagId);
    }
    selectedTagIds.value = newSet;
  }
  
  // No need to watch for changes - liveQuery handles reactivity automatically
  
  /**
   * Clear the chat search query
   */
  function clearChatSearch() {
    searchQuery.value = '';
    // Filtered chats will update reactively
  }
  
  /**
   * Apply sorting to chats
   * Respects pinned chats (keeps them first) unless disablePinnedSort is true
   */
  async function applySorting(chats: MessengerChatItem[]): Promise<MessengerChatItem[]> {
    // If no sort is active and pinned sort is enabled, return chats as-is (they're already sorted by chatStorage)
    if (!sortByOnline.value && !sortByDistance.value && !disablePinnedSort.value) {
      return chats;
    }
    
    const sorted = [...chats];
    
    // Helper function to sort chats by online status
    function sortByOnlineStatus(chatsToSort: MessengerChatItem[]): MessengerChatItem[] {
      return chatsToSort.sort((a, b) => {
        const aOnline = a.online || 0;
        const bOnline = b.online || 0;
        if (sortByOnline.value === 'asc') {
          return bOnline - aOnline; // Online (1) first, then offline (0)
        } else {
          return aOnline - bOnline; // Offline (0) first, then online (1)
        }
      });
    }
    
    // Helper function to sort chats by distance
    async function sortByDistanceValue(chatsToSort: MessengerChatItem[]): Promise<MessengerChatItem[]> {
      // Fetch profile data for all chats that need distance sorting
      const dbIds = chatsToSort
        .filter(chat => !chat.broadcast && chat.type !== 100 && chat.db_id > 0)
        .map(chat => chat.db_id);
      
      const profiles = await db.profiles.bulkGet(dbIds);
      const profileMap = new Map(profiles.filter(p => p !== undefined).map(p => [p!.db_id, p!]));
      
      return chatsToSort.sort((a, b) => {
        // Broadcasts and invalid chats go to bottom
        const aIsValid = !a.broadcast && a.type !== 100 && a.db_id > 0;
        const bIsValid = !b.broadcast && b.type !== 100 && b.db_id > 0;
        
        if (!aIsValid && !bIsValid) return 0;
        if (!aIsValid) return 1; // a goes to bottom
        if (!bIsValid) return -1; // b goes to bottom
        
        const aProfile = profileMap.get(a.db_id);
        const bProfile = profileMap.get(b.db_id);
        
        const getDistance = (profile: typeof aProfile): number | null => {
          if (!profile) return null;
          const distance = profile.location_how_far 
            ?? (profile.location_how_far2 ? Number(profile.location_how_far2) : undefined);
          // Return 0 as a valid distance, only return null if distance is undefined/null
          return distance !== undefined && distance !== null ? distance : null;
        };
        
        const aDistance = getDistance(aProfile);
        const bDistance = getDistance(bProfile);
        
        // Chats without distance go to bottom
        if (aDistance === null && bDistance === null) return 0;
        if (aDistance === null) return 1; // a goes to bottom
        if (bDistance === null) return -1; // b goes to bottom
        
        // Sort by distance
        // Distance 0 is valid and should sort correctly (0 comes first in ascending, last in descending before null)
        if (sortByDistance.value === 'asc') {
          return aDistance - bDistance; // Closest first (0 comes first)
        } else {
          return bDistance - aDistance; // Farthest first (0 comes after other distances but before null)
        }
      });
    }
    
    // Helper function to sort by date_time
    function sortByDateTime(chatsToSort: MessengerChatItem[]): MessengerChatItem[] {
      return chatsToSort.sort((a, b) => {
        const getTime = (chat: MessengerChatItem): number => {
          if (!chat.date_time || chat.date_time === '') {
            return new Date('1900-01-01').getTime();
          }
          const parsed = new Date(chat.date_time).getTime();
          return isNaN(parsed) ? new Date('1900-01-01').getTime() : parsed;
        };
        return getTime(b) - getTime(a); // Descending order (newest first)
      });
    }
    
    // If pinned sort is disabled, sort all chats together
    if (disablePinnedSort.value) {
      if (sortByOnline.value) {
        return sortByOnlineStatus(sorted);
      } else if (sortByDistance.value) {
        return await sortByDistanceValue(sorted);
      } else {
        // No active sort, just sort by date_time
        return sortByDateTime(sorted);
      }
    }
    
    // Pinned sort is enabled - separate pinned and unpinned, sort each group
    const pinnedChats = sorted.filter(chat => (chat.pin_chat || 0) > 0);
    const unpinnedChats = sorted.filter(chat => (chat.pin_chat || 0) === 0);
    
    let sortedPinned = pinnedChats;
    let sortedUnpinned = unpinnedChats;
    
    // Apply sorting to both groups
    if (sortByOnline.value) {
      sortedPinned = sortByOnlineStatus(pinnedChats);
      sortedUnpinned = sortByOnlineStatus(unpinnedChats);
    } else if (sortByDistance.value) {
      sortedPinned = await sortByDistanceValue(pinnedChats);
      sortedUnpinned = await sortByDistanceValue(unpinnedChats);
    } else {
      // No active sort, sort by date_time
      sortedPinned = sortByDateTime(pinnedChats);
      sortedUnpinned = sortByDateTime(unpinnedChats);
    }
    
    // Combine: pinned first, then unpinned
    return [...sortedPinned, ...sortedUnpinned];
  }
  
  /**
   * Toggle disable pinned sort
   */
  function toggleDisablePinnedSort() {
    disablePinnedSort.value = !disablePinnedSort.value;
  }
  
  /**
   * Toggle sort by online (cycles through: asc -> desc -> null)
   */
  function toggleSortByOnline() {
    if (sortByOnline.value === null) {
      sortByOnline.value = 'asc';
      sortByDistance.value = null; // Disable other sort
    } else if (sortByOnline.value === 'asc') {
      sortByOnline.value = 'desc';
    } else {
      sortByOnline.value = null;
    }
  }
  
  /**
   * Toggle sort by distance (cycles through: asc -> desc -> null)
   */
  function toggleSortByDistance() {
    if (sortByDistance.value === null) {
      sortByDistance.value = 'asc';
      sortByOnline.value = null; // Disable other sort
    } else if (sortByDistance.value === 'asc') {
      sortByDistance.value = 'desc';
    } else {
      sortByDistance.value = null;
    }
  }
  
  /**
   * Clear all active sorts
   */
  function clearAllSorts(): void {
    sortByOnline.value = null;
    sortByDistance.value = null;
    disablePinnedSort.value = false;
  }
  
  /**
   * Check if any sort is active
   */
  const hasActiveSort = computed(() => {
    return sortByOnline.value !== null || sortByDistance.value !== null;
  });

  return {
    searchQuery,
    filterUnread,
    filterPinned,
    filterOnline,
    filterLastMessageByMe,
    filterLastMessageByOther,
    filterOnlyMyMessages,
    filterBlocked,
    filterCouples,
    filterFemales,
    isFilterDropdownOpen,
    sortByOnline,
    sortByDistance,
    disablePinnedSort,
    isSortDropdownOpen,
    hasActiveSort,
    selectedTagIds,
    filteredChats: computed(() => filteredChats.value || []),
    isLoadingFilteredChats,
    hasActiveFilters,
    activeFilterCount,
    updateFilteredChats,
    toggleFilter,
    clearAllFilters,
    clearAllSorts,
    clearChatSearch,
    toggleSortByOnline,
    toggleSortByDistance,
    toggleDisablePinnedSort,
    toggleTagFilter,
  };
});

