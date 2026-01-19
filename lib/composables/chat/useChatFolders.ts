import { ref, computed } from 'vue';
import { createGlobalState } from '@vueuse/core';
import { getMessengerFolders, editFolder, createFolder as createFolderAPI, deleteFolder as deleteFolderAPI, addChatToFolder as addChatToFolderAPI, removeChatFromFolder as removeChatFromFolderAPI } from '@/lib/sdc-api';
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

  /**
   * Update folder name via API and update local storage
   */
  async function updateFolderName(folderId: number, name: string): Promise<void> {
    try {
      console.log(`[useChatFolders] Updating folder ${folderId} name to "${name}"...`);
      
      // Call API to update folder name
      const response = await editFolder(folderId, name);
      
      if (response.info.code === 200) {
        // Update folder in IndexedDB
        const folder = folders.value.find(f => f.id === folderId);
        if (folder) {
          const updatedFolder: MessengerFolder = {
            ...folder,
            name: name.trim(),
          };
          await folderStorage.updateFolder(updatedFolder);
          console.log(`[useChatFolders] Successfully updated folder ${folderId} name`);
        } else {
          console.warn(`[useChatFolders] Folder ${folderId} not found in local state, refreshing folders...`);
          // Refresh folders from API to get updated name
          await fetchFolders();
        }
      } else {
        throw new Error(response.info.message || 'Failed to update folder name');
      }
    } catch (err) {
      console.error(`[useChatFolders] Failed to update folder ${folderId} name:`, err);
      throw err;
    }
  }

  /**
   * Create a new folder via API and refresh folders list
   */
  async function createFolder(name: string): Promise<void> {
    try {
      console.log(`[useChatFolders] Creating folder with name "${name}"...`);
      
      // Call API to create folder
      const response = await createFolderAPI(name);
      
      if (response.info.code === 200) {
        // Refresh folders from API to get the new folder with its ID
        await fetchFolders();
        console.log(`[useChatFolders] Successfully created folder "${name}"`);
      } else {
        throw new Error(response.info.message || 'Failed to create folder');
      }
    } catch (err) {
      console.error(`[useChatFolders] Failed to create folder:`, err);
      throw err;
    }
  }

  /**
   * Delete a folder via API and refresh folders list
   */
  async function deleteFolder(folderId: number): Promise<void> {
    try {
      console.log(`[useChatFolders] Deleting folder ${folderId}...`);
      
      // Call API to delete folder
      const response = await deleteFolderAPI(folderId);
      
      if (response.info.code === 200) {
        // Move all chats from this folder back to inbox (folder_id = undefined)
        const chatsInFolder = await db.chats
          .where('folder_id')
          .equals(folderId)
          .toArray();
        
        if (chatsInFolder.length > 0) {
          // Update each chat individually to set folder_id to undefined (inbox)
          await Promise.all(
            chatsInFolder.map(chat => 
              db.chats.update(chat.id, { folder_id: undefined })
            )
          );
          console.log(`[useChatFolders] Moved ${chatsInFolder.length} chats from folder ${folderId} back to inbox`);
        }
        
        // Remove folder from IndexedDB
        await db.folders.delete(folderId);
        
        // Refresh folders from API to ensure consistency
        await fetchFolders();
        console.log(`[useChatFolders] Successfully deleted folder ${folderId}`);
      } else {
        throw new Error(response.info.message || 'Failed to delete folder');
      }
    } catch (err) {
      console.error(`[useChatFolders] Failed to delete folder ${folderId}:`, err);
      throw err;
    }
  }

  /**
   * Move a chat to a folder
   * @param groupId The group_id of the chat to move
   * @param folderId The ID of the folder to move to (null for inbox)
   */
  async function moveChatToFolder(groupId: number | string, folderId: number | null): Promise<void> {
    try {
      console.log(`[useChatFolders] Moving chat ${groupId} to folder ${folderId}...`);
      
      const chatId = `group_${groupId}`;
      const existingChat = await db.chats.get(chatId);
      
      // If moving to inbox (null), we need to remove from current folder first
      if (folderId === null) {
        if (existingChat && existingChat.folder_id) {
          // Remove from current folder using API
          await removeChatFromFolder(groupId, existingChat.folder_id);
        } else {
          // Already in inbox, no action needed
          console.log(`[useChatFolders] Chat ${groupId} is already in inbox`);
        }
        return;
      }
      
      // Call API to add chat to folder
      const response = await addChatToFolderAPI(groupId, folderId);
      
      if (response.info.code === 200) {
        // Update chat's folder_id in IndexedDB
        await db.chats.update(chatId, { folder_id: folderId });
        console.log(`[useChatFolders] Successfully moved chat ${groupId} to folder ${folderId}`);
      } else {
        throw new Error(response.info.message || 'Failed to move chat to folder');
      }
    } catch (err) {
      console.error(`[useChatFolders] Failed to move chat ${groupId} to folder:`, err);
      throw err;
    }
  }

  /**
   * Remove a chat from its current folder
   * @param groupId The group_id of the chat to remove
   * @param folderId The ID of the folder to remove from
   */
  async function removeChatFromFolder(groupId: number | string, folderId: number): Promise<void> {
    try {
      console.log(`[useChatFolders] Removing chat ${groupId} from folder ${folderId}...`);
      
      // Call API to remove chat from folder
      const response = await removeChatFromFolderAPI(groupId, folderId);
      
      if (response.info.code === 200) {
        // Update chat's folder_id to undefined (inbox) in IndexedDB
        const chatId = `group_${groupId}`;
        await db.chats.update(chatId, { folder_id: undefined });
        console.log(`[useChatFolders] Successfully removed chat ${groupId} from folder ${folderId}`);
      } else {
        throw new Error(response.info.message || 'Failed to remove chat from folder');
      }
    } catch (err) {
      console.error(`[useChatFolders] Failed to remove chat ${groupId} from folder:`, err);
      throw err;
    }
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
    updateFolderName,
    createFolder,
    deleteFolder,
    moveChatToFolder,
    removeChatFromFolder,
  };
});

