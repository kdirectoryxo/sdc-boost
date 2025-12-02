/**
 * IndexedDB storage manager for chat messages
 * Handles storing and retrieving messages for a specific chat
 */

import { getDB } from './db';
import type { MessengerMessage } from './sdc-api-types';

const STORE_NAME = 'messages';

/**
 * Get a unique key for a message
 */
function getMessageKey(groupId: number, messageId: number): string {
    return `${groupId}_${messageId}`;
}

class MessageStorage {
    /**
     * Get the shared database instance
     */
    private async getDB() {
        const db = await getDB();
        // Ensure messages store exists
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            // Database needs upgrade - this should be handled in db.ts migrations
            // For now, we'll create it dynamically if needed
            console.warn('[MessageStorage] Messages store does not exist. Database may need upgrade.');
        }
        return db;
    }

    /**
     * Upsert messages (insert or update)
     */
    async upsertMessages(groupId: number, messages: MessengerMessage[]): Promise<void> {
        const db = await this.getDB();
        
        // Check if store exists, if not we'll need to handle it differently
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.warn('[MessageStorage] Messages store not available. Skipping storage.');
            return;
        }

        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        await Promise.all(
            messages.map((message) => {
                const messageWithKey = {
                    ...message,
                    id: getMessageKey(groupId, message.message_id),
                    group_id: groupId,
                };
                return store.put(messageWithKey);
            })
        );

        await tx.done;
        console.log(`[MessageStorage] Upserted ${messages.length} messages for group ${groupId}`);
    }

    /**
     * Get all messages for a specific chat/group
     */
    async getMessages(groupId: number): Promise<MessengerMessage[]> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            return [];
        }

        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        // Get all messages and filter by group_id
        const allMessages = await store.getAll();
        const groupMessages = allMessages
            .filter((item: any) => item.group_id === groupId)
            .map((item: any) => {
                const { id, group_id, ...message } = item;
                return message as MessengerMessage;
            })
            .sort((a, b) => a.date2 - b.date2); // Sort by timestamp ascending (oldest first)

        console.log(`[MessageStorage] Retrieved ${groupMessages.length} messages for group ${groupId}`);
        return groupMessages;
    }

    /**
     * Add a single message
     */
    async addMessage(groupId: number, message: MessengerMessage): Promise<void> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.warn('[MessageStorage] Messages store not available. Skipping storage.');
            return;
        }

        const messageWithKey = {
            ...message,
            id: getMessageKey(groupId, message.message_id),
            group_id: groupId,
        };
        
        await db.put(STORE_NAME, messageWithKey);
        console.log(`[MessageStorage] Added message ${message.message_id} for group ${groupId}`);
    }

    /**
     * Update a message (e.g., seen status)
     */
    async updateMessage(groupId: number, messageId: number, updates: Partial<MessengerMessage>): Promise<void> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            return;
        }

        const key = getMessageKey(groupId, messageId);
        const existing = await db.get(STORE_NAME, key);
        
        if (existing) {
            const updated = {
                ...existing,
                ...updates,
                id: key,
                group_id: groupId,
            };
            await db.put(STORE_NAME, updated);
            console.log(`[MessageStorage] Updated message ${messageId} for group ${groupId}`);
        }
    }

    /**
     * Clear all messages for a specific chat/group
     */
    async clearMessages(groupId: number): Promise<void> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            return;
        }

        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const allMessages = await store.getAll();
        
        const keysToDelete = allMessages
            .filter((item: any) => item.group_id === groupId)
            .map((item: any) => item.id);
        
        await Promise.all(keysToDelete.map((key: string) => store.delete(key)));
        await tx.done;
        
        console.log(`[MessageStorage] Cleared ${keysToDelete.length} messages for group ${groupId}`);
    }

    /**
     * Clear all messages
     */
    async clearAllMessages(): Promise<void> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            return;
        }

        await db.clear(STORE_NAME);
        console.log('[MessageStorage] Cleared all messages');
    }
}

// Create singleton instance
export const messageStorage = new MessageStorage();

