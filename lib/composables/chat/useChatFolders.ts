import { ref, computed } from 'vue';
import { createGlobalState } from '@vueuse/core';
import { getMessengerFolders } from '@/lib/sdc-api';
import type { MessengerFolder } from '@/lib/sdc-api-types';
import { folderStorage } from '@/lib/folder-storage';
import { chatStorage } from '@/lib/chat-storage';
import { useChatState } from './useChatState';

export const useChatFolders = createGlobalState(() => {
  const { folders, selectedFolderId, showArchives } = useChatState();
  
  // Folder unread counts - calculated from IndexedDB
  const folderUnreadCounts = ref<Map<number, number>>(new Map()); // Map of folderId -> unread count
  const inboxUnreadCount = ref<number>(0); // Inbox (folder_id = 0) unread count
  const totalUnreadCount = ref<number>(0); // Total unread count across all chats
  
  /**
   * Fetch folders from API and store in IndexedDB
   */
  async function fetchFolders(): Promise<void> {
    try {
      console.log('[useChatFolders] Fetching folders from API...');
      const response = await getMessengerFolders();
      
      if (response.info.code === 200) {
        const folderList = response.info.folders || [];
        
        // Upsert to IndexedDB
        await folderStorage.upsertFolders(folderList);
        
        // Load from IndexedDB and update UI
        await loadFoldersFromStorage();
      }
    } catch (err) {
      console.error('[useChatFolders] Failed to fetch folders:', err);
      // Try to load from storage anyway
      await loadFoldersFromStorage();
    }
  }
  
  /**
   * Load folders from IndexedDB
   */
  async function loadFoldersFromStorage(): Promise<void> {
    try {
      const folderList = await folderStorage.getAllFolders();
      folders.value = folderList;
      console.log(`[useChatFolders] Loaded ${folderList.length} folders from IndexedDB`);
      
      // Refresh folder counts after folders are loaded
      await refreshFolderCounts();
    } catch (err) {
      console.error('[useChatFolders] Failed to load folders from storage:', err);
    }
  }
  
  /**
   * Refresh folder unread counts from IndexedDB
   * This calculates counts directly from stored chats, so they're available immediately
   */
  async function refreshFolderCounts(): Promise<void> {
    try {
      // Get counts for all folders
      const folderCounts = new Map<number, number>();
      
      // Get count for inbox (folder_id = 0)
      const inboxCount = await chatStorage.getInboxUnreadCount();
      inboxUnreadCount.value = inboxCount;
      
      // Get count for each folder
      for (const folder of folders.value) {
        const count = await chatStorage.getFolderUnreadCount(folder.id);
        folderCounts.set(folder.id, count);
      }
      
      folderUnreadCounts.value = folderCounts;
      
      // Get total count
      const totalCount = await chatStorage.getTotalUnreadCount();
      totalUnreadCount.value = totalCount;
      
      console.log('[useChatFolders] Refreshed folder counts from IndexedDB', {
        inbox: inboxCount,
        folders: Object.fromEntries(folderCounts),
        total: totalCount
      });
    } catch (err) {
      console.error('[useChatFolders] Failed to refresh folder counts:', err);
    }
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
    return folderUnreadCounts.value.get(folderId) || 0;
  }
  
  /**
   * Get unread count for inbox (folder_id = 0 or null)
   * Returns count from IndexedDB (calculated in backend)
   */
  function getInboxUnreadCount(): number {
    return inboxUnreadCount.value;
  }
  
  /**
   * Get total unread count across all chats
   * Returns count from IndexedDB (calculated in backend)
   */
  function getTotalUnreadCount(): number {
    return totalUnreadCount.value;
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
    folderUnreadCounts,
    inboxUnreadCount,
    totalUnreadCount,
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

