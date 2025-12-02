/**
 * IndexedDB storage manager for chats
 * Handles storing and retrieving chat list items
 */

import type { MessengerChatItem } from './sdc-api-types';

const DB_NAME = 'sdc-boost-chats';
const DB_VERSION = 1;
const STORE_NAME = 'chats';

class ChatStorage {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    /**
     * Initialize IndexedDB
     */
    private async init(): Promise<void> {
        if (this.db) {
            return;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[ChatStorage] Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[ChatStorage] IndexedDB opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    // Create indexes for efficient querying
                    store.createIndex('group_id', 'group_id', { unique: false });
                    store.createIndex('db_id', 'db_id', { unique: false });
                    store.createIndex('date_time', 'date_time', { unique: false });
                    store.createIndex('pin_chat', 'pin_chat', { unique: false });
                    store.createIndex('account_id', 'account_id', { unique: false });
                    console.log('[ChatStorage] Object store created');
                }
            };
        });

        return this.initPromise;
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
        await this.init();

        if (!this.db) {
            throw new Error('IndexedDB not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            let completed = 0;
            let hasError = false;

            chats.forEach((chat) => {
                const chatWithId = {
                    ...chat,
                    id: this.getChatId(chat),
                };

                const request = store.put(chatWithId);

                request.onsuccess = () => {
                    completed++;
                    if (completed === chats.length && !hasError) {
                        console.log(`[ChatStorage] Upserted ${chats.length} chats`);
                        resolve();
                    }
                };

                request.onerror = () => {
                    if (!hasError) {
                        hasError = true;
                        console.error('[ChatStorage] Failed to upsert chat:', request.error);
                        reject(request.error);
                    }
                };
            });

            // Handle case where chats array is empty
            if (chats.length === 0) {
                resolve();
            }
        });
    }

    /**
     * Get all chats from IndexedDB
     */
    async getAllChats(): Promise<MessengerChatItem[]> {
        await this.init();

        if (!this.db) {
            throw new Error('IndexedDB not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const chats = request.result.map((item: any) => {
                    // Remove the 'id' field we added for IndexedDB
                    const { id, ...chat } = item;
                    return chat as MessengerChatItem;
                });
                console.log(`[ChatStorage] Retrieved ${chats.length} chats from IndexedDB`);
                resolve(chats);
            };

            request.onerror = () => {
                console.error('[ChatStorage] Failed to get chats:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get a single chat by ID
     */
    async getChatById(id: string): Promise<MessengerChatItem | null> {
        await this.init();

        if (!this.db) {
            throw new Error('IndexedDB not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                if (request.result) {
                    const { id: _, ...chat } = request.result;
                    resolve(chat as MessengerChatItem);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('[ChatStorage] Failed to get chat:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Update a single chat
     */
    async updateChat(chat: MessengerChatItem): Promise<void> {
        await this.init();

        if (!this.db) {
            throw new Error('IndexedDB not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const chatWithId = {
                ...chat,
                id: this.getChatId(chat),
            };

            const request = store.put(chatWithId);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error('[ChatStorage] Failed to update chat:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Clear all chats from IndexedDB
     */
    async clearAllChats(): Promise<void> {
        await this.init();

        if (!this.db) {
            throw new Error('IndexedDB not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('[ChatStorage] Cleared all chats');
                resolve();
            };

            request.onerror = () => {
                console.error('[ChatStorage] Failed to clear chats:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Delete a chat by ID
     */
    async deleteChat(id: string): Promise<void> {
        await this.init();

        if (!this.db) {
            throw new Error('IndexedDB not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error('[ChatStorage] Failed to delete chat:', request.error);
                reject(request.error);
            };
        });
    }
}

// Create singleton instance
export const chatStorage = new ChatStorage();

