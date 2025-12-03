import { ref, computed, watch } from 'vue';
import { createGlobalState } from '@vueuse/core';
import { chatStorage } from '@/lib/chat-storage';
import { messageStorage } from '@/lib/message-storage';
import { useChatState } from './useChatState';
import { useLiveQuery } from '@/lib/composables/useLiveQuery';

export const useChatFilters = createGlobalState(() => {
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
    return [...chatMetadataMatches, ...messageSearchMatches];
  }, [searchQuery, selectedFolderId, showArchives, filterUnread, filterPinned, filterOnline, filterLastMessageByMe, filterLastMessageByOther, filterOnlyMyMessages, filterBlocked, chatList]);
  
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
  }
  
  // No need to watch for changes - liveQuery handles reactivity automatically
  
  /**
   * Clear the chat search query
   */
  function clearChatSearch() {
    searchQuery.value = '';
    // Filtered chats will update reactively
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
    filteredChats: computed(() => filteredChats.value || []),
    isLoadingFilteredChats,
    hasActiveFilters,
    activeFilterCount,
    updateFilteredChats,
    toggleFilter,
    clearAllFilters,
    clearChatSearch,
  };
});

