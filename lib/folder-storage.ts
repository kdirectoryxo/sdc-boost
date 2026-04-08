/**
 * IndexedDB storage manager for folders using Dexie
 * Handles storing and retrieving folder list items
 */

import { db } from './db';
import type { MessengerFolder } from './sdc-api-types';

/** API/JSON sometimes returns folder ids as strings; coerce for Dexie + Vue props. */
export function normalizeMessengerFolder(folder: MessengerFolder): MessengerFolder {
    const idRaw = folder.id as unknown;
    const id =
        typeof idRaw === 'string' ? parseInt(idRaw, 10) : Number(idRaw);
    const nmRaw = folder.new_messages as unknown;
    const new_messages =
        typeof nmRaw === 'string' ? parseInt(nmRaw, 10) : Number(nmRaw);
    return {
        ...folder,
        id: Number.isFinite(id) ? id : (folder.id as number),
        new_messages: Number.isFinite(new_messages)
            ? new_messages
            : (folder.new_messages as number),
    };
}

class FolderStorage {
    /**
     * Upsert folders (insert or update)
     */
    async upsertFolders(folders: MessengerFolder[]): Promise<void> {
        await Promise.all(
            folders.map((folder) => db.folders.put(normalizeMessengerFolder(folder)))
        );
        
        console.log(`[FolderStorage] Upserted ${folders.length} folders`);
    }

    /**
     * Get all folders from IndexedDB
     */
    async getAllFolders(): Promise<MessengerFolder[]> {
        const folders = await db.folders.toArray();
        console.log(`[FolderStorage] Retrieved ${folders.length} folders from IndexedDB`);
        return folders.map(normalizeMessengerFolder);
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
        await db.folders.put(normalizeMessengerFolder(folder));
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
