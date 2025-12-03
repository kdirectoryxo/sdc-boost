import { ref, watch } from 'vue';
import { syncAllChats, syncInboxChats, syncFolderChats, syncArchivesChats } from '@/lib/sdc-api';
import { chatStorage } from '@/lib/chat-storage';
import { countersManager } from '@/lib/counters-manager';
import { fetchAllMessages } from '@/lib/message-service';
import { messageStorage } from '@/lib/message-storage';
import { useChatState } from './useChatState';
import { useChatFolders } from './useChatFolders';
import { useChatFilters } from './useChatFilters';

export function useChatSync() {
  const { chatList, selectedFolderId, showArchives } = useChatState();
  const { refreshFolderCounts } = useChatFolders();
  const { updateFilteredChats } = useChatFilters();
  
  const isLoading = ref(false);
  const error = ref<string | null>(null); // Error for chat list operations
  const isRefreshing = ref(false);
  const isSyncingMessages = ref(false); // Track if we're syncing messages for multiple chats
  const isInitialLoad = ref(true);
  
  /**
   * Load chats from IndexedDB
   */
  async function loadChatsFromStorage(): Promise<void> {
    try {
      const chats = await chatStorage.getAllChats();
      chatList.value = chats;
      console.log(`[useChatSync] Loaded ${chats.length} chats from IndexedDB`);
      
      // Refresh folder counts from IndexedDB
      await refreshFolderCounts();
    } catch (err) {
      console.error('[useChatSync] Failed to load chats from storage:', err);
      error.value = 'Failed to load chats from storage.';
    }
  }
  
  /**
   * Sync inbox chats (messenger_latest) from API and store in IndexedDB
   * Updates UI progressively after each page
   */
  async function fetchInboxChats(): Promise<void> {
    if (isRefreshing.value) return;
    
    isRefreshing.value = true;
    error.value = null;

    try {
      // Pass callback to reload chats from storage after each page
      await syncInboxChats(async () => {
        await loadChatsFromStorage();
      });
      // Final reload to ensure everything is up to date
      await loadChatsFromStorage();
      // Refresh counters to update the count immediately
      await countersManager.refresh();
      // Refresh folder counts from IndexedDB
      await refreshFolderCounts();
    } catch (err) {
      console.error('[useChatSync] Failed to sync inbox chats:', err);
      await loadChatsFromStorage();
    } finally {
      isRefreshing.value = false;
    }
  }

  /**
   * Sync chats for a specific folder from API and store in IndexedDB
   * Updates UI progressively after each page
   * @param folderId The folder ID to sync chats for
   */
  async function fetchFolderChats(folderId: number): Promise<void> {
    if (isRefreshing.value) return;
    
    isRefreshing.value = true;
    error.value = null;

    try {
      // Pass callback to reload chats from storage after each page
      await syncFolderChats(folderId, async () => {
        await loadChatsFromStorage();
      });
      // Final reload to ensure everything is up to date
      await loadChatsFromStorage();
      // Refresh counters to update the count immediately
      await countersManager.refresh();
      // Refresh folder counts from IndexedDB
      await refreshFolderCounts();
    } catch (err) {
      console.error(`[useChatSync] Failed to sync folder ${folderId} chats:`, err);
      await loadChatsFromStorage();
    } finally {
      isRefreshing.value = false;
    }
  }

  /**
   * Sync archived chats from API and store in IndexedDB
   * Updates UI progressively after each page
   */
  async function fetchArchivesChats(): Promise<void> {
    if (isRefreshing.value) return;
    
    isRefreshing.value = true;
    error.value = null;

    try {
      // Pass callback to reload chats from storage after each page
      await syncArchivesChats(async () => {
        await loadChatsFromStorage();
      });
      // Final reload to ensure everything is up to date
      await loadChatsFromStorage();
      // Refresh counters to update the count immediately
      await countersManager.refresh();
    } catch (err) {
      console.error('[useChatSync] Failed to sync archived chats:', err);
      await loadChatsFromStorage();
    } finally {
      isRefreshing.value = false;
    }
  }

  /**
   * Sync all chats from API and store in IndexedDB
   * Syncs from messenger_latest and from each folder
   * Updates UI progressively after each page
   */
  async function fetchAllChats(): Promise<void> {
    if (isRefreshing.value) return;
    
    isRefreshing.value = true;
    error.value = null;

    try {
      // Pass callback to reload chats from storage after each page
      await syncAllChats(async () => {
        await loadChatsFromStorage();
      });
      // Final reload to ensure everything is up to date
      await loadChatsFromStorage();
      // Refresh counters to update the count immediately
      await countersManager.refresh();
      // Refresh folder counts from IndexedDB
      await refreshFolderCounts();
    } catch (err) {
      console.error('[useChatSync] Failed to sync chats:', err);
      error.value = 'Failed to load chats. Please try again.';
      await loadChatsFromStorage();
    } finally {
      isRefreshing.value = false;
    }
  }
  
  /**
   * Sync messages for all unsynced chats in the current folder or inbox
   * Only syncs chats that haven't been synced yet (checked via hasChatBeenFetched)
   */
  async function syncMessagesForCurrentFolder(): Promise<void> {
    if (isSyncingMessages.value) return;
    
    isSyncingMessages.value = true;
    error.value = null;
    
    // Cancel flag to stop sync operation
    let cancelled = false;
    
    // Access toast from global window
    const toast = (window as any).__sdcBoostToast;
    let progressToast: { update: (current: number, total: number, message?: string) => void; dismiss: () => void } | null = null;
    
    try {
      let chatsToSync: typeof chatList.value = [];
      
      // Determine which chats to sync based on selected folder
      if (showArchives.value) {
        // Archives - get archived chats
        chatsToSync = await chatStorage.searchChats({ showArchives: true });
      } else if (selectedFolderId.value === null) {
        // All chats - get all chats from all folders and inbox (excluding archives)
        chatsToSync = await chatStorage.searchChats({ showArchives: false });
      } else if (selectedFolderId.value === 0) {
        // Inbox - get chats with folder_id === 0 or null (excluding archives)
        chatsToSync = await chatStorage.searchChats({ folderId: 0, showArchives: false });
      } else {
        // Specific folder - get chats for that folder (excluding archives)
        chatsToSync = await chatStorage.searchChats({ folderId: selectedFolderId.value, showArchives: false });
      }
      
      // Filter to only include chats that haven't been synced
      const unsyncedChats: typeof chatList.value = [];
      for (const chat of chatsToSync) {
        if (cancelled) break;
        const hasBeenFetched = await messageStorage.hasChatBeenFetched(chat.group_id);
        if (!hasBeenFetched) {
          unsyncedChats.push(chat);
        }
      }
      
      if (unsyncedChats.length === 0) {
        console.log('[useChatSync] No unsynced chats found');
        if (toast) {
          toast.success('All chats are already synced');
        }
        return;
      }
      
      console.log(`[useChatSync] Syncing messages for ${unsyncedChats.length} unsynced chats...`);
      
      // Show progress toast with cancel button
      if (toast && toast.progress) {
        progressToast = toast.progress(unsyncedChats.length, () => {
          cancelled = true;
          console.log('[useChatSync] Sync cancelled by user');
        });
        if (progressToast) {
          progressToast.update(0, unsyncedChats.length, `Syncing messages... (0/${unsyncedChats.length})`);
        }
      }
      
      // Sync messages for each unsynced chat
      let syncedCount = 0;
      for (let i = 0; i < unsyncedChats.length; i++) {
        if (cancelled) {
          console.log('[useChatSync] Sync cancelled, stopping...');
          break;
        }
        
        const chat = unsyncedChats[i];
        try {
          // Update progress before syncing
          if (progressToast) {
            progressToast.update(i, unsyncedChats.length, `Syncing ${chat.account_id || `chat ${chat.group_id}`}... (${i}/${unsyncedChats.length})`);
          }
          
          await fetchAllMessages(chat);
          syncedCount++;
          
          // Update progress after syncing
          if (progressToast && !cancelled) {
            progressToast.update(syncedCount, unsyncedChats.length, `Synced ${chat.account_id || `chat ${chat.group_id}`}... (${syncedCount}/${unsyncedChats.length})`);
          }
          
          console.log(`[useChatSync] Synced messages for chat ${chat.group_id} (${syncedCount}/${unsyncedChats.length})`);
        } catch (err) {
          console.error(`[useChatSync] Failed to sync messages for chat ${chat.group_id}:`, err);
          // Continue with next chat even if one fails
          // Still update progress
          if (progressToast) {
            progressToast.update(i + 1, unsyncedChats.length, `Failed to sync ${chat.account_id || `chat ${chat.group_id}`}... (${i + 1}/${unsyncedChats.length})`);
          }
        }
      }
      
      // Dismiss progress toast
      if (progressToast) {
        progressToast.dismiss();
      }
      
      if (cancelled) {
        console.log(`[useChatSync] Sync cancelled. Synced ${syncedCount}/${unsyncedChats.length} chats before cancellation`);
        if (toast) {
          toast.error(`Sync cancelled. Synced ${syncedCount} chat${syncedCount !== 1 ? 's' : ''} before cancellation`);
        }
      } else {
        console.log(`[useChatSync] Successfully synced ${syncedCount}/${unsyncedChats.length} chats`);
        if (toast) {
          toast.success(`Synced messages for ${syncedCount} chat${syncedCount !== 1 ? 's' : ''}`);
        }
      }
    } catch (err) {
      console.error('[useChatSync] Failed to sync messages:', err);
      error.value = 'Failed to sync messages. Please try again.';
      
      // Dismiss progress toast if it exists
      if (progressToast) {
        progressToast.dismiss();
      }
      
      if (toast) {
        toast.error('Failed to sync messages');
      }
    } finally {
      isSyncingMessages.value = false;
    }
  }
  
  // Watch for folder selection changes to refetch in background
  watch([selectedFolderId, showArchives], async ([newFolderId, newShowArchives], [oldFolderId, oldShowArchives]) => {
    // Skip on initial load
    if (isInitialLoad.value) {
      return;
    }
    
    // Skip if already refreshing
    if (isRefreshing.value) {
      return;
    }
    
    // Refetch in background based on selection
    if (newShowArchives) {
      // Archives selected - refetch archived chats
      console.log('[useChatSync] Refetching archived chats in background...');
      fetchArchivesChats().catch(console.error);
    } else if (newFolderId === null) {
      // "All Chats" selected - refetch all chats
      console.log('[useChatSync] Refetching all chats in background...');
      fetchAllChats().catch(console.error);
    } else if (newFolderId === 0) {
      // "Inbox" selected - refetch inbox chats (messenger_latest)
      console.log('[useChatSync] Refetching inbox chats in background...');
      fetchInboxChats().catch(console.error);
    } else if (newFolderId !== null) {
      // Specific folder selected - refetch that folder's chats
      console.log(`[useChatSync] Refetching folder ${newFolderId} chats in background...`);
      fetchFolderChats(newFolderId).catch(console.error);
    }
  });
  
  return {
    isLoading,
    error,
    isRefreshing,
    isSyncingMessages,
    isInitialLoad,
    loadChatsFromStorage,
    fetchInboxChats,
    fetchFolderChats,
    fetchArchivesChats,
    fetchAllChats,
    syncMessagesForCurrentFolder,
  };
}

