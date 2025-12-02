/**
 * IndexedDB storage manager for folders
 * Handles storing and retrieving folder list items
 */

import { getDB } from './db';
import type { MessengerFolder } from './sdc-api-types';

const STORE_NAME = 'folders';

class FolderStorage {
    /**
     * Get the shared database instance
     */
    private async getDB() {
        return getDB();
    }

    /**
     * Upsert folders (insert or update)
     */
    async upsertFolders(folders: MessengerFolder[]): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        await Promise.all(folders.map((folder) => store.put(folder)));
        await tx.done;
        
        console.log(`[FolderStorage] Upserted ${folders.length} folders`);
    }

    /**
     * Get all folders from IndexedDB
     */
    async getAllFolders(): Promise<MessengerFolder[]> {
        const db = await this.getDB();
        const folders = await db.getAll(STORE_NAME);
        console.log(`[FolderStorage] Retrieved ${folders.length} folders from IndexedDB`);
        return folders;
    }

    /**
     * Get a single folder by ID
     */
    async getFolderById(id: number): Promise<MessengerFolder | null> {
        const db = await this.getDB();
        return (await db.get(STORE_NAME, id)) || null;
    }

    /**
     * Update a single folder
     */
    async updateFolder(folder: MessengerFolder): Promise<void> {
        const db = await this.getDB();
        await db.put(STORE_NAME, folder);
    }

    /**
     * Clear all folders from IndexedDB
     */
    async clearAllFolders(): Promise<void> {
        const db = await this.getDB();
        await db.clear(STORE_NAME);
        console.log('[FolderStorage] Cleared all folders');
    }
}

// Create singleton instance
export const folderStorage = new FolderStorage();
