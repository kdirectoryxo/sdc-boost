import { ref, computed, watch } from 'vue';
import { chatStorage } from '@/lib/chat-storage';
import { messageStorage } from '@/lib/message-storage';
import { useChatState } from './useChatState';

export function useChatFilters() {
  const { chatList, selectedFolderId, showArchives } = useChatState();
  
  const searchQuery = ref('');
  const filterUnread = ref<boolean>(false);
  const filterPinned = ref<boolean>(false);
  const filterOnline = ref<boolean>(false);
  const filterLastMessageByMe = ref<boolean>(false);
  const filterLastMessageByOther = ref<boolean>(false);
  const filterOnlyMyMessages = ref<boolean>(false);
  const filterBlocked = ref<boolean>(false);
  const isFilterDropdownOpen = ref<boolean>(false);
  
  // Filtered chats using IndexedDB queries
  const filteredChats = ref<typeof chatList.value>([]);
  const isLoadingFilteredChats = ref(false);
  let currentSearchPromise: Promise<void> | null = null;
  let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Computed property to check if any filters are active
  const hasActiveFilters = computed(() => {
    return filterUnread.value || filterPinned.value || filterOnline.value || 
           filterLastMessageByMe.value || filterLastMessageByOther.value || filterOnlyMyMessages.value ||
           filterBlocked.value;
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
    return count;
  });
  
  /**
   * Function to search chats using IndexedDB
   */
  async function updateFilteredChats(): Promise<void> {
    // Capture the current search query at the start
    const currentQuery = searchQuery.value.trim();
    
    // If there's already a search in progress, wait for it to complete
    if (currentSearchPromise) {
      await currentSearchPromise;
      // After waiting, check if searchQuery has changed - if so, start a new search
      if (searchQuery.value.trim() !== currentQuery) {
        return updateFilteredChats();
      }
    }
    
    isLoadingFilteredChats.value = true;
    
    // Create a promise for this search
    currentSearchPromise = (async () => {
      try {
        const hasSearchQuery = currentQuery.length > 0;
      
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
              showArchives: showArchives.value,
            });
            
            // Filter to only include chats with matching messages
            messageSearchMatches = allChatsForMessages.filter(chat => matchingGroupIds.has(chat.group_id));
            
            // Remove chats that are already in chatMetadataMatches to avoid duplicates
            const chatMetadataGroupIds = new Set(chatMetadataMatches.map(c => c.group_id));
            messageSearchMatches = messageSearchMatches.filter(chat => !chatMetadataGroupIds.has(chat.group_id));
          }
        }
        
        // Combine results: exact matches first (from chatMetadataMatches), then partial chat matches, then message matches
        const allChats = [...chatMetadataMatches, ...messageSearchMatches];
        
        // Only update if searchQuery hasn't changed while we were searching
        if (searchQuery.value.trim() === currentQuery || (!hasSearchQuery && !searchQuery.value.trim())) {
          filteredChats.value = allChats;
        }
      } catch (error) {
        console.error('[useChatFilters] Error searching chats:', error);
        // Only update if searchQuery hasn't changed
        if (searchQuery.value.trim() === currentQuery || (!currentQuery && !searchQuery.value.trim())) {
          filteredChats.value = [];
        }
      } finally {
        isLoadingFilteredChats.value = false;
        currentSearchPromise = null;
      }
    })();
    
    await currentSearchPromise;
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
  }
  
  // Watch for changes that require re-searching
  watch([searchQuery, selectedFolderId, showArchives, filterUnread, filterPinned, filterOnline, filterLastMessageByMe, filterLastMessageByOther, filterOnlyMyMessages, filterBlocked], async (newValues, oldValues) => {
    // Clear previous timeout
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = null;
    }
    
    // Check if searchQuery changed (user is typing)
    const searchQueryChanged = !oldValues || newValues[0] !== oldValues[0];
    const hasSearchQuery = searchQuery.value.trim().length > 0;
    
    // Debounce search queries when user is typing, but execute immediately for folder/filter changes
    if (searchQueryChanged && hasSearchQuery) {
      // User is typing - debounce the search to wait for them to finish
      searchDebounceTimeout = setTimeout(async () => {
        // Double-check searchQuery still has value (user might have cleared it)
        if (searchQuery.value.trim()) {
          await updateFilteredChats();
        } else {
          // Search was cleared, update without query
          await updateFilteredChats();
        }
        searchDebounceTimeout = null;
      }, 500); // 500ms debounce to allow user to finish typing
    } else {
      // Folder/filter changed or search cleared - execute immediately
      await updateFilteredChats();
    }
  }, { immediate: false });
  
  // Also watch chatList to update filtered chats when chats are loaded
  watch(chatList, async () => {
    await updateFilteredChats();
  }, { immediate: false });
  
  /**
   * Clear the chat search query
   */
  function clearChatSearch() {
    searchQuery.value = '';
    updateFilteredChats();
  }

  return {
    searchQuery,
    filterUnread,
    filterPinned,
    filterOnline,
    filterLastMessageByMe,
    filterLastMessageByOther,
    filterOnlyMyMessages,
    filterBlocked,
    isFilterDropdownOpen,
    filteredChats,
    isLoadingFilteredChats,
    hasActiveFilters,
    activeFilterCount,
    updateFilteredChats,
    toggleFilter,
    clearAllFilters,
    clearChatSearch,
  };
}

