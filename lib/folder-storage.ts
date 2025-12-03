/**
 * IndexedDB storage manager for folders using Dexie
 * Handles storing and retrieving folder list items
 */

import { db } from './db';
import type { MessengerFolder } from './sdc-api-types';

class FolderStorage {
    /**
     * Upsert folders (insert or update)
     */
    async upsertFolders(folders: MessengerFolder[]): Promise<void> {
        await Promise.all(folders.map((folder) => db.folders.put(folder)));
        
        console.log(`[FolderStorage] Upserted ${folders.length} folders`);
    }

    /**
     * Get all folders from IndexedDB
     */
    async getAllFolders(): Promise<MessengerFolder[]> {
        const folders = await db.folders.toArray();
        console.log(`[FolderStorage] Retrieved ${folders.length} folders from IndexedDB`);
        return folders;
    }

    /**
     * Get a single folder by ID
     */
    async getFolderById(id: number): Promise<MessengerFolder | null> {
        return (await db.folders.get(id)) || null;
    }

    /**
     * Update a single folder
     */
    async updateFolder(folder: MessengerFolder): Promise<void> {
        await db.folders.put(folder);
    }

    /**
     * Clear all folders from IndexedDB
     */
    async clearAllFolders(): Promise<void> {
        await db.folders.clear();
        console.log('[FolderStorage] Cleared all folders');
    }
}

// Create singleton instance
export const folderStorage = new FolderStorage();
