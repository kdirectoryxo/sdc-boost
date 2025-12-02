/**
 * IndexedDB storage manager for chats
 * Handles storing and retrieving chat list items
 */

import { getDB } from './db';
import type { MessengerChatItem } from './sdc-api-types';

const STORE_NAME = 'chats';

/**
 * Helper function to deduplicate chats
 * For regular chats: use group_id
 * For broadcast messages (clubs/companies): use id_broadcast if available, otherwise db_id
 */
function deduplicateChats(chats: MessengerChatItem[]): MessengerChatItem[] {
    const seen = new Map<string, MessengerChatItem>();
    for (const chat of chats) {
        // For broadcast messages (clubs/companies), use id_broadcast if available
        // Otherwise fall back to db_id (for broadcasts without id_broadcast)
        // For regular chats, use group_id
        const isBroadcast = chat.broadcast || chat.type === 100;
        let key: string;
        
        if (isBroadcast) {
            // Use id_broadcast if available (unique per broadcast), otherwise db_id
            if (chat.id_broadcast !== undefined && chat.id_broadcast !== null) {
                key = `broadcast_${chat.db_id}_${chat.id_broadcast}`;
            } else {
                key = `broadcast_${chat.db_id}`;
            }
        } else {
            key = `group_${chat.group_id}`;
        }
        
        if (!seen.has(key)) {
            seen.set(key, chat);
        } else {
            // Keep the one with more recent date_time
            const existing = seen.get(key)!;
            const getTime = (c: MessengerChatItem): number => {
                if (!c.date_time || c.date_time === '') return 0;
                const parsed = new Date(c.date_time).getTime();
                return isNaN(parsed) ? 0 : parsed;
            };
            const existingTime = getTime(existing);
            const newTime = getTime(chat);
            if (newTime > existingTime) {
                seen.set(key, chat);
            }
        }
    }
    return Array.from(seen.values());
}

class ChatStorage {
    /**
     * Get the shared database instance
     */
    private async getDB() {
        return getDB();
    }

    /**
     * Get a unique ID for a chat item
     */
    private getChatId(chat: MessengerChatItem): string {
        const isBroadcast = chat.broadcast || chat.type === 100;
        if (isBroadcast) {
            // For broadcasts, use db_id and id_broadcast if available
            if (chat.id_broadcast !== undefined && chat.id_broadcast !== null) {
                return `broadcast_${chat.db_id}_${chat.id_broadcast}`;
            }
            return `broadcast_${chat.db_id}`;
        }
        return `group_${chat.group_id}`;
    }

    /**
     * Upsert chats (insert or update)
     */
    async upsertChats(chats: MessengerChatItem[]): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        await Promise.all(
            chats.map((chat) => {
                const chatWithId = {
                    ...chat,
                    id: this.getChatId(chat),
                };
                return store.put(chatWithId);
            })
        );

        await tx.done;
        console.log(`[ChatStorage] Upserted ${chats.length} chats`);
    }

    /**
     * Get all chats from IndexedDB
     */
    async getAllChats(): Promise<MessengerChatItem[]> {
        const db = await this.getDB();
        const chats = await db.getAll(STORE_NAME);
        
        // Remove the 'id' field we added for IndexedDB
        const result = chats.map((item) => {
            const { id, ...chat } = item;
            return chat as MessengerChatItem;
        });
        
        console.log(`[ChatStorage] Retrieved ${result.length} chats from IndexedDB`);
        return result;
    }

    /**
     * Get a single chat by ID
     */
    async getChatById(id: string): Promise<MessengerChatItem | null> {
        const db = await this.getDB();
        const item = await db.get(STORE_NAME, id);
        
        if (!item) {
            return null;
        }
        
        const { id: _, ...chat } = item;
        return chat as MessengerChatItem;
    }

    /**
     * Update a single chat
     */
    async updateChat(chat: MessengerChatItem): Promise<void> {
        const db = await this.getDB();
        const chatWithId = {
            ...chat,
            id: this.getChatId(chat),
        };
        await db.put(STORE_NAME, chatWithId);
    }

    /**
     * Clear all chats from IndexedDB
     */
    async clearAllChats(): Promise<void> {
        const db = await this.getDB();
        await db.clear(STORE_NAME);
        console.log('[ChatStorage] Cleared all chats');
    }

    /**
     * Delete a chat by ID
     */
    async deleteChat(id: string): Promise<void> {
        const db = await this.getDB();
        await db.delete(STORE_NAME, id);
    }

    /**
     * Sync chats from an endpoint with pagination, upserting after each page
     * @param fetchFn Function to fetch a page, returns response with chat_list and url_more
     * @param onProgress Optional callback called after each page is upserted
     * @returns Total number of chats synced
     */
    async syncChatsFromEndpoint(
        fetchFn: (page: number) => Promise<{ info: { chat_list?: MessengerChatItem[]; url_more?: string } }>,
        onProgress?: (pageChats: MessengerChatItem[], totalSynced: number) => void
    ): Promise<number> {
        let totalSynced = 0;
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const response = await fetchFn(page);
            const chats = response.info.chat_list || [];
            
            if (chats.length === 0) {
                hasMore = false;
                break;
            }

            // Deduplicate this page's chats
            const deduplicatedPageChats = deduplicateChats(chats);

            // Upsert this page's chats immediately
            await this.upsertChats(deduplicatedPageChats);
            totalSynced += deduplicatedPageChats.length;

            // Call progress callback if provided
            if (onProgress) {
                onProgress(deduplicatedPageChats, totalSynced);
            }
            
            // Check if there are more pages
            const urlMore = response.info.url_more;
            if (!urlMore || urlMore === '-1' || urlMore === '') {
                hasMore = false;
            } else {
                // Extract next page number from url_more
                const match = urlMore.match(/page=(\d+)/);
                if (match) {
                    const nextPage = parseInt(match[1], 10);
                    if (nextPage > page) {
                        page = nextPage;
                    } else {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }
        }

        return totalSynced;
    }

    /**
     * Remove chats by folder ID
     * @param folderId The folder ID to remove chats for
     */
    async removeChatsByFolderId(folderId: number): Promise<void> {
        const allChats = await this.getAllChats();
        const chatsToRemove = allChats.filter(chat => (chat.folder_id || 0) === folderId);
        
        // Delete each chat individually
        const db = await this.getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        await Promise.all(
            chatsToRemove.map(chat => {
                const id = this.getChatId(chat);
                return store.delete(id);
            })
        );
        
        await tx.done;
        console.log(`[ChatStorage] Removed ${chatsToRemove.length} chats from folder ${folderId}`);
    }

    /**
     * Remove inbox chats (folder_id === 0 or null)
     */
    async removeInboxChats(): Promise<void> {
        const allChats = await this.getAllChats();
        const chatsToRemove = allChats.filter(chat => (chat.folder_id || 0) === 0);
        
        // Delete each chat individually
        const db = await this.getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        await Promise.all(
            chatsToRemove.map(chat => {
                const id = this.getChatId(chat);
                return store.delete(id);
            })
        );
        
        await tx.done;
        console.log(`[ChatStorage] Removed ${chatsToRemove.length} inbox chats`);
    }
}

// Create singleton instance
export const chatStorage = new ChatStorage();
