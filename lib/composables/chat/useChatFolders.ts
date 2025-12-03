import { ref, computed } from 'vue';
import { createGlobalState } from '@vueuse/core';
import { getMessengerFolders } from '@/lib/sdc-api';
import type { MessengerFolder } from '@/lib/sdc-api-types';
import { folderStorage } from '@/lib/folder-storage';
import { chatStorage } from '@/lib/chat-storage';
import { useChatState } from './useChatState';
import { useLiveQuery } from '@/lib/composables/useLiveQuery';
import { db } from '@/lib/db';

export const useChatFolders = createGlobalState(() => {
  const { folders, selectedFolderId, showArchives } = useChatState();
  
  // Reactive folder unread counts - calculated from IndexedDB
  const folderUnreadCounts = useLiveQuery(async () => {
    const folderList = folders.value || [];
    const folderCounts = new Map<number, number>();
    
    // Get count for each folder
    for (const folder of folderList) {
      const count = await chatStorage.getFolderUnreadCount(folder.id);
      folderCounts.set(folder.id, count);
    }
    
    return folderCounts;
  }, [folders]);

  const inboxUnreadCount = useLiveQuery(async () => {
    return await chatStorage.getInboxUnreadCount();
  }, []);

  const totalUnreadCount = useLiveQuery(async () => {
    return await chatStorage.getTotalUnreadCount();
  }, []);
  
  /**
   * Fetch folders from API and store in IndexedDB
   * Folders will automatically update reactively
   */
  async function fetchFolders(): Promise<void> {
    try {
      console.log('[useChatFolders] Fetching folders from API...');
      const response = await getMessengerFolders();
      
      if (response.info.code === 200) {
        const folderList = response.info.folders || [];
        
        // Upsert to IndexedDB - reactivity will handle UI update
        await folderStorage.upsertFolders(folderList);
      }
    } catch (err) {
      console.error('[useChatFolders] Failed to fetch folders:', err);
    }
  }
  
  /**
   * Load folders from IndexedDB
   * @deprecated Folders are now reactive, this is no longer needed
   */
  async function loadFoldersFromStorage(): Promise<void> {
    // No-op: folders are now reactive via useChatState
    console.log('[useChatFolders] loadFoldersFromStorage is deprecated - folders are now reactive');
  }
  
  /**
   * Refresh folder unread counts from IndexedDB
   * @deprecated Counts are now reactive, this is no longer needed
   */
  async function refreshFolderCounts(): Promise<void> {
    // No-op: counts are now reactive
    console.log('[useChatFolders] refreshFolderCounts is deprecated - counts are now reactive');
  }
  
  /**
   * Get folder name by ID
   */
  function getFolderName(folderId: number | undefined | null): string {
    if (!folderId || folderId === 0) return '';
    const folder = folders.value.find(f => f.id === folderId);
    return folder ? folder.name : '';
  }
  
  /**
   * Get unread count for a folder
   * Returns count from IndexedDB (calculated in backend)
   */
  function getFolderUnreadCount(folderId: number): number {
    return folderUnreadCounts.value?.get(folderId) || 0;
  }
  
  /**
   * Get unread count for inbox (folder_id = 0 or null)
   * Returns count from IndexedDB (calculated in backend)
   */
  function getInboxUnreadCount(): number {
    return inboxUnreadCount.value || 0;
  }
  
  /**
   * Get total unread count across all chats
   * Returns count from IndexedDB (calculated in backend)
   */
  function getTotalUnreadCount(): number {
    return totalUnreadCount.value || 0;
  }

  /**
   * Handle folder selection
   */
  function handleSelectFolder(folderId: number | null) {
    selectedFolderId.value = folderId;
    showArchives.value = false;
  }

  /**
   * Handle archives selection
   */
  function handleSelectArchives() {
    showArchives.value = true;
    selectedFolderId.value = -1;
  }
  
  return {
    folders,
    folderUnreadCounts: computed(() => folderUnreadCounts.value || new Map()),
    inboxUnreadCount: computed(() => inboxUnreadCount.value || 0),
    totalUnreadCount: computed(() => totalUnreadCount.value || 0),
    fetchFolders,
    loadFoldersFromStorage,
    refreshFolderCounts,
    getFolderName,
    getFolderUnreadCount,
    getInboxUnreadCount,
    getTotalUnreadCount,
    handleSelectFolder,
    handleSelectArchives,
  };
});

