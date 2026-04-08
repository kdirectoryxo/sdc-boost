import { ref, watch } from 'vue';
import { createGlobalState } from '@vueuse/core';
import { syncAllChats, syncInboxChats, syncFolderChats, syncArchivesChats, syncUnsyncedChats, syncAllChatsFirstPageOnly } from '@/lib/sdc-api';
import { chatStorage } from '@/lib/chat-storage';
import { folderStorage } from '@/lib/folder-storage';
import { countersManager } from '@/lib/counters-manager';
import { fetchAllMessages, refreshLatestPage } from '@/lib/message-service';
import { messageStorage } from '@/lib/message-storage';
import { useChatState } from './useChatState';
import { useChatFolders } from './useChatFolders';
import { useChatFilters } from './useChatFilters';
import { toast } from '@/lib/toast';

export const useChatSync = createGlobalState(() => {
  const { chatList, selectedFolderId, showArchives } = useChatState();
  const { updateFilteredChats } = useChatFilters();
  
  const isLoading = ref(false);
  const error = ref<string | null>(null); // Error for chat list operations
  const isRefreshing = ref(false);
  const isSyncingMessages = ref(false); // Track if we're syncing messages for multiple chats
  const isInitialLoad = ref(true);

  /**
   * Check if an error is a rate limit (429) error
   */
  function isRateLimitError(err: any): boolean {
    if (!err) return false;
    
    // Check HTTP status code
    if (err.status === 429 || err.response?.status === 429) {
      return true;
    }
    
    // Check error message for rate limit indicators
    const errorMessage = err.message || err.toString() || '';
    if (
      errorMessage.includes('429') ||
      errorMessage.toLowerCase().includes('rate limit') ||
      errorMessage.toLowerCase().includes('too many requests') ||
      errorMessage.toLowerCase().includes('quota exceeded')
    ) {
      return true;
    }
    
    // Check API response code (if error has info.code)
    if (err.code === 429 || err.code === '429' || err.info?.code === 429 || err.info?.code === '429') {
      return true;
    }
    
    return false;
  }
  
  /**
   * Load chats from IndexedDB
   * @deprecated Chats are now reactive, this is no longer needed
   */
  async function loadChatsFromStorage(): Promise<void> {
    // No-op: chats are now reactive via useChatState
    console.log('[useChatSync] loadChatsFromStorage is deprecated - chats are now reactive');
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
      // Sync chats - reactivity will handle UI updates
      await syncInboxChats();
      // Messenger badge from IndexedDB (avoid duplicate /v1/counters vs initialize())
      await countersManager.recalculateMessengerCounter();
      // Folder counts are now reactive
    } catch (err) {
      console.error('[useChatSync] Failed to sync inbox chats:', err);
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
      // Sync chats - reactivity will handle UI updates
      await syncFolderChats(folderId);
      await countersManager.recalculateMessengerCounter();
      // Folder counts are now reactive
    } catch (err) {
      console.error(`[useChatSync] Failed to sync folder ${folderId} chats:`, err);
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
      // Sync chats - reactivity will handle UI updates
      await syncArchivesChats();
      await countersManager.recalculateMessengerCounter();
    } catch (err) {
      console.error('[useChatSync] Failed to sync archived chats:', err);
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
      // Sync chats - reactivity will handle UI updates
      await syncAllChats();
      await countersManager.recalculateMessengerCounter();
      // Folder counts are now reactive
    } catch (err) {
      console.error('[useChatSync] Failed to sync chats:', err);
      error.value = 'Failed to load chats. Please try again.';
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
        toast.success('All chats are already synced');
        return;
      }
      
      console.log(`[useChatSync] Syncing messages for ${unsyncedChats.length} unsynced chats...`);
      
      // Show progress toast with cancel button
      if (toast.progress) {
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
        toast.error(`Sync cancelled. Synced ${syncedCount} chat${syncedCount !== 1 ? 's' : ''} before cancellation`);
      } else {
        console.log(`[useChatSync] Successfully synced ${syncedCount}/${unsyncedChats.length} chats`);
        toast.success(`Synced messages for ${syncedCount} chat${syncedCount !== 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error('[useChatSync] Failed to sync messages:', err);
      error.value = 'Failed to sync messages. Please try again.';
      
      // Dismiss progress toast if it exists
      if (progressToast) {
        progressToast.dismiss();
      }
      
      toast.error('Failed to sync messages');
    } finally {
      isSyncingMessages.value = false;
    }
  }

  /**
   * Sync only chats that haven't been synced yet (no sync date)
   */
  async function syncUnsyncedChatsWrapper(): Promise<void> {
    if (isRefreshing.value) return;
    
    isRefreshing.value = true;
    error.value = null;

    let progressToast: { update: (current: number, total: number, message?: string) => void; dismiss: () => void } | null = null;
    
    // Count total items to sync
    let totalItems = 0;
    let syncedItems = 0;
    const itemsToSync: Array<{ name: string; type: 'inbox' | 'folder' | 'archives'; folderId?: number }> = [];
    
    try {
      // Count unsynced items first and track which ones to sync
      const inboxSyncTime = await chatStorage.getInboxLastSyncTime();
      if (!inboxSyncTime) {
        totalItems++;
        itemsToSync.push({ name: 'inbox', type: 'inbox' });
      }
      
      const archivesSyncTime = await chatStorage.getArchivesLastSyncTime();
      if (!archivesSyncTime) {
        totalItems++;
        itemsToSync.push({ name: 'archives', type: 'archives' });
      }
      
      const folderList = await folderStorage.getAllFolders();
      for (const folder of folderList) {
        const folderSyncTime = await chatStorage.getFolderLastSyncTime(folder.id);
        if (!folderSyncTime) {
          totalItems++;
          itemsToSync.push({ name: folder.name, type: 'folder', folderId: folder.id });
        }
      }
      
      if (totalItems === 0) {
        toast.success('All chats are already synced');
        return;
      }
      
      // Show progress toast
      if (toast.progress) {
        progressToast = toast.progress(totalItems, () => {
          // Cancel not supported for chat sync
        });
        if (progressToast) {
          progressToast.update(0, totalItems, 'Syncing unsynced chats... (0/' + totalItems + ')');
        }
      }
      
      // Sync with progress callbacks - track folder/area completion, not page completion
      await syncUnsyncedChats(
        undefined, // onPageSynced - not used for progress tracking
        async (folderName: string) => {
          syncedItems++;
          if (progressToast) {
            progressToast.update(syncedItems, totalItems, `Syncing ${folderName}... (${syncedItems}/${totalItems})`);
          }
        }
      );
      
      await countersManager.recalculateMessengerCounter();
      
      if (progressToast) {
        progressToast.dismiss();
      }
      
      toast.success(`Synced ${syncedItems} unsynced chat${syncedItems !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error('[useChatSync] Failed to sync unsynced chats:', err);
      
      // Check for rate limit error
      if (isRateLimitError(err)) {
        error.value = 'Rate limit exceeded. Please wait a moment and try again.';
        if (progressToast) {
          progressToast.dismiss();
        }
        toast.error('Sync stopped: Rate limit exceeded. Please wait a moment and try again.');
        return;
      }

      error.value = 'Failed to sync unsynced chats. Please try again.';
      
      if (progressToast) {
        progressToast.dismiss();
      }
      
      toast.error('Failed to sync unsynced chats');
    } finally {
      isRefreshing.value = false;
    }
  }

  /**
   * Force resync all chats (clears sync times and resyncs all pages)
   * Also syncs all messages for all chats
   */
  async function resyncAllChats(): Promise<void> {
    if (isRefreshing.value) return;
    
    isRefreshing.value = true;
    error.value = null;

    let progressToast: { update: (current: number, total: number, message?: string) => void; dismiss: () => void } | null = null;
    
    // Count total folders/areas to sync (inbox + folders + archives)
    let totalFolders = 0;
    let syncedFolders = 0;
    
    try {
      // Clear all sync times to force full resync
      await chatStorage.clearAllSyncTimes();
      
      // Count folders/areas
      totalFolders = 1; // inbox
      const folderList = await folderStorage.getAllFolders();
      totalFolders += folderList.length; // folders
      totalFolders += 1; // archives
      
      // Show progress toast
      if (toast.progress) {
        progressToast = toast.progress(totalFolders, () => {
          // Cancel not supported for chat sync
        });
        if (progressToast) {
          progressToast.update(0, totalFolders, 'Resyncing all chats...');
        }
      }
      
      // Phase 1: Sync all chat lists with progress showing folder/area
      await syncAllChats(
        undefined, // onPageSynced - not used for progress tracking
        async (folderName: string) => {
          syncedFolders++;
          if (progressToast) {
            progressToast.update(syncedFolders, totalFolders, `Resyncing ${folderName}... (${syncedFolders}/${totalFolders})`);
          }
        }
      );
      
      await countersManager.recalculateMessengerCounter();
      
      // Phase 2: Sync all messages for all chats (including archived)
      const allChats = await chatStorage.getAllChats();
      const totalChats = allChats.length;
      let syncedChats = 0;
      
      if (progressToast) {
        progressToast.dismiss();
      }
      
      // Show new progress toast for message syncing
      if (toast.progress && totalChats > 0) {
        progressToast = toast.progress(totalChats, () => {
          // Cancel not supported for message sync
        });
        if (progressToast) {
          progressToast.update(0, totalChats, `Syncing messages for all chats... (0/${totalChats})`);
        }
      }
      
      // Sync messages for each chat
      for (let i = 0; i < allChats.length; i++) {
        const chat = allChats[i];
        try {
          const chatName = chat.account_id || `chat ${chat.group_id}`;
          if (progressToast) {
            progressToast.update(i, totalChats, `Syncing messages for ${chatName}... (${i}/${totalChats})`);
          }
          
          await fetchAllMessages(chat);
          syncedChats++;
          
          if (progressToast) {
            progressToast.update(syncedChats, totalChats, `Synced messages for ${chatName}... (${syncedChats}/${totalChats})`);
          }
          
          console.log(`[useChatSync] Synced messages for chat ${chat.group_id} (${syncedChats}/${totalChats})`);
        } catch (err) {
          // Check for rate limit error - stop syncing immediately
          if (isRateLimitError(err)) {
            console.error(`[useChatSync] Rate limit exceeded while syncing chat ${chat.group_id}`);
            if (progressToast) {
              progressToast.dismiss();
            }
            toast.error('Sync stopped: Rate limit exceeded. Please wait a moment and try again.');
            error.value = 'Rate limit exceeded. Please wait a moment and try again.';
            return;
          }

          console.error(`[useChatSync] Failed to sync messages for chat ${chat.group_id}:`, err);
          // Continue with next chat even if one fails (unless it's a rate limit)
          if (progressToast) {
            progressToast.update(i + 1, totalChats, `Failed to sync ${chat.account_id || `chat ${chat.group_id}`}... (${i + 1}/${totalChats})`);
          }
        }
      }
      
      if (progressToast) {
        progressToast.dismiss();
      }
      
      toast.success(`Resynced all chats and ${syncedChats} chat${syncedChats !== 1 ? 's' : ''} messages`);
    } catch (err) {
      console.error('[useChatSync] Failed to resync all chats:', err);
      
      // Check for rate limit error
      if (isRateLimitError(err)) {
        error.value = 'Rate limit exceeded. Please wait a moment and try again.';
        if (progressToast) {
          progressToast.dismiss();
        }
        toast.error('Sync stopped: Rate limit exceeded. Please wait a moment and try again.');
        return;
      }

      error.value = 'Failed to resync all chats. Please try again.';
      
      if (progressToast) {
        progressToast.dismiss();
      }
      
      toast.error('Failed to resync all chats');
    } finally {
      isRefreshing.value = false;
    }
  }

  /**
   * Force resync newest chats (syncs page 0/latest page of messages for all chats)
   */
  async function resyncNewestChats(): Promise<void> {
    if (isRefreshing.value) return;
    
    isRefreshing.value = true;
    error.value = null;

    let progressToast: { update: (current: number, total: number, message?: string) => void; dismiss: () => void } | null = null;
    
    try {
      // Get all chats from storage
      const allChats = await chatStorage.getAllChats();
      const totalChats = allChats.length;
      let syncedChats = 0;
      
      if (totalChats === 0) {
        toast.success('No chats to sync');
        return;
      }
      
      // Show progress toast for message syncing
      if (toast.progress) {
        progressToast = toast.progress(totalChats, () => {
          // Cancel not supported for message sync
        });
        if (progressToast) {
          progressToast.update(0, totalChats, `Syncing latest messages for all chats... (0/${totalChats})`);
        }
      }
      
      // Sync page 0 (latest page) of messages for each chat
      for (let i = 0; i < allChats.length; i++) {
        const chat = allChats[i];
        try {
          const chatName = chat.account_id || `chat ${chat.group_id}`;
          if (progressToast) {
            progressToast.update(i, totalChats, `Syncing latest messages for ${chatName}... (${i}/${totalChats})`);
          }
          
          await refreshLatestPage(chat);
          syncedChats++;
          
          if (progressToast) {
            progressToast.update(syncedChats, totalChats, `Synced latest messages for ${chatName}... (${syncedChats}/${totalChats})`);
          }
          
          console.log(`[useChatSync] Synced latest messages for chat ${chat.group_id} (${syncedChats}/${totalChats})`);
        } catch (err) {
          // Check for rate limit error - stop syncing immediately
          if (isRateLimitError(err)) {
            console.error(`[useChatSync] Rate limit exceeded while syncing chat ${chat.group_id}`);
            if (progressToast) {
              progressToast.dismiss();
            }
            toast.error('Sync stopped: Rate limit exceeded. Please wait a moment and try again.');
            error.value = 'Rate limit exceeded. Please wait a moment and try again.';
            return;
          }

          console.error(`[useChatSync] Failed to sync latest messages for chat ${chat.group_id}:`, err);
          // Continue with next chat even if one fails (unless it's a rate limit)
          if (progressToast) {
            progressToast.update(i + 1, totalChats, `Failed to sync ${chat.account_id || `chat ${chat.group_id}`}... (${i + 1}/${totalChats})`);
          }
        }
      }
      
      if (progressToast) {
        progressToast.dismiss();
      }
      
      toast.success(`Resynced latest messages for ${syncedChats} chat${syncedChats !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error('[useChatSync] Failed to resync newest chats:', err);
      
      // Check for rate limit error
      if (isRateLimitError(err)) {
        error.value = 'Rate limit exceeded. Please wait a moment and try again.';
        if (progressToast) {
          progressToast.dismiss();
        }
        toast.error('Sync stopped: Rate limit exceeded. Please wait a moment and try again.');
        return;
      }

      error.value = 'Failed to resync newest chats. Please try again.';
      
      if (progressToast) {
        progressToast.dismiss();
      }
      
      toast.error('Failed to resync newest chats');
    } finally {
      isRefreshing.value = false;
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
    syncUnsyncedChats: syncUnsyncedChatsWrapper,
    resyncAllChats,
    resyncNewestChats,
  };
});

