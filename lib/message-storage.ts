/**
 * IndexedDB storage manager for chat messages
 * Handles storing and retrieving messages for a specific chat
 */

import { getDB } from './db';
import type { MessengerMessage } from './sdc-api-types';

const STORE_NAME = 'messages';
const METADATA_STORE_NAME = 'chat_metadata';

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

    /**
     * Check if chat has been fetched before
     */
    async hasChatBeenFetched(groupId: number): Promise<boolean> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
            return false;
        }

        try {
            const metadata = await db.get(METADATA_STORE_NAME, groupId);
            return metadata?.messages_fetched === true;
        } catch (error) {
            console.error(`[MessageStorage] Error checking fetch status for chat ${groupId}:`, error);
            return false;
        }
    }

    /**
     * Mark chat as fetched
     */
    async markChatFetched(groupId: number): Promise<void> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
            console.warn('[MessageStorage] Chat metadata store not available. Skipping.');
            return;
        }

        try {
            // Get existing metadata to preserve isBlocked and isArchived flags
            const existing = await db.get(METADATA_STORE_NAME, groupId) as any;
            await db.put(METADATA_STORE_NAME, {
                group_id: groupId,
                messages_fetched: true,
                last_fetched_at: Date.now(),
                ...(existing?.isBlocked ? { isBlocked: existing.isBlocked } : {}),
                ...(existing?.isArchived ? { isArchived: existing.isArchived } : {}),
            });
            console.log(`[MessageStorage] Marked chat ${groupId} as fetched`);
        } catch (error) {
            console.error(`[MessageStorage] Error marking chat ${groupId} as fetched:`, error);
        }
    }

    /**
     * Set blocked status for a chat
     */
    async setChatBlocked(groupId: number, isBlocked: boolean): Promise<void> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
            console.warn('[MessageStorage] Chat metadata store not available. Skipping.');
            return;
        }

        try {
            // Get existing metadata to preserve other fields
            const existing = await db.get(METADATA_STORE_NAME, groupId) as any;
            await db.put(METADATA_STORE_NAME, {
                group_id: groupId,
                messages_fetched: existing?.messages_fetched || false,
                last_fetched_at: existing?.last_fetched_at,
                isBlocked: isBlocked,
                ...(existing?.isArchived ? { isArchived: existing.isArchived } : {}),
            });
            console.log(`[MessageStorage] Set chat ${groupId} blocked status to ${isBlocked}`);
        } catch (error) {
            console.error(`[MessageStorage] Error setting blocked status for chat ${groupId}:`, error);
        }
    }

    /**
     * Get blocked status for a chat
     */
    async isChatBlocked(groupId: number): Promise<boolean> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
            return false;
        }

        try {
            const metadata = await db.get(METADATA_STORE_NAME, groupId) as any;
            return metadata?.isBlocked === true;
        } catch (error) {
            console.error(`[MessageStorage] Error checking blocked status for chat ${groupId}:`, error);
            return false;
        }
    }

    /**
     * Set archived status for a chat
     */
    async setChatArchived(groupId: number, isArchived: boolean): Promise<void> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
            console.warn('[MessageStorage] Chat metadata store not available. Skipping.');
            return;
        }

        try {
            // Get existing metadata to preserve other fields
            const existing = await db.get(METADATA_STORE_NAME, groupId) as any;
            await db.put(METADATA_STORE_NAME, {
                group_id: groupId,
                messages_fetched: existing?.messages_fetched || false,
                last_fetched_at: existing?.last_fetched_at,
                ...(existing?.isBlocked ? { isBlocked: existing.isBlocked } : {}),
                isArchived: isArchived,
            });
            console.log(`[MessageStorage] Set chat ${groupId} archived status to ${isArchived}`);
        } catch (error) {
            console.error(`[MessageStorage] Error setting archived status for chat ${groupId}:`, error);
        }
    }

    /**
     * Get archived status for a chat
     */
    async isChatArchived(groupId: number): Promise<boolean> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
            return false;
        }

        try {
            const metadata = await db.get(METADATA_STORE_NAME, groupId) as any;
            return metadata?.isArchived === true;
        } catch (error) {
            console.error(`[MessageStorage] Error checking archived status for chat ${groupId}:`, error);
            return false;
        }
    }

    /**
     * Get the highest message ID for a chat (to determine if we have new messages)
     */
    async getLatestMessageId(groupId: number): Promise<number | null> {
        const messages = await this.getMessages(groupId);
        if (messages.length === 0) {
            return null;
        }
        // Messages are sorted by date2 ascending, so last one is newest
        return messages[messages.length - 1].message_id;
    }

    /**
     * Delete a specific message
     */
    async deleteMessage(groupId: number, messageId: number): Promise<void> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.warn('[MessageStorage] Messages store not available. Skipping deletion.');
            return;
        }

        const key = getMessageKey(groupId, messageId);
        await db.delete(STORE_NAME, key);
        console.log(`[MessageStorage] Deleted message ${messageId} for group ${groupId}`);
    }

    /**
     * Get the last message for a specific chat/group efficiently
     * Uses IndexedDB index to get only the last message without loading all messages
     * @param groupId The group ID
     * @returns The last message or null if no messages exist
     */
    async getLastMessage(groupId: number): Promise<MessengerMessage | null> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            return null;
        }

        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const groupIndex = store.index('group_id');
        
        // Get all messages for this group_id
        const groupMessages = await groupIndex.getAll(groupId);
        
        if (groupMessages.length === 0) {
            return null;
        }
        
        // Find the message with the highest date2 (most recent)
        let lastMessage = groupMessages[0];
        for (const msg of groupMessages) {
            if (msg.date2 > lastMessage.date2) {
                lastMessage = msg;
            }
        }
        
        // Remove internal fields
        const { id, group_id, ...message } = lastMessage;
        return message as MessengerMessage;
    }

    /**
     * Check if a chat has only messages from the current user (sender === 0)
     * Uses IndexedDB queries efficiently without loading all messages
     * @param groupId The group ID
     * @returns true if all messages are from sender 0, false otherwise
     */
    async hasOnlyMyMessages(groupId: number): Promise<boolean> {
        const db = await this.getDB();
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            return false;
        }

        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const groupIndex = store.index('group_id');
        
        // Get all messages for this group_id
        const groupMessages = await groupIndex.getAll(groupId);
        
        if (groupMessages.length === 0) {
            return false; // No messages means it's not "only my messages"
        }
        
        // Check if any message has sender !== 0
        const hasOtherSender = groupMessages.some((msg: any) => msg.sender !== 0);
        return !hasOtherSender;
    }

    /**
     * Get last message sender info for multiple chats efficiently
     * Uses IndexedDB queries to get only necessary data without loading all messages
     * @param groupIds Array of group IDs to check
     * @returns Map of groupId -> { lastMessageSender: 0 | 1 | null, hasOnlyMyMessages: boolean }
     */
    async getLastMessageInfoForChats(groupIds: number[]): Promise<Map<number, { lastMessageSender: 0 | 1 | null; hasOnlyMyMessages: boolean }>> {
        const db = await this.getDB();
        const result = new Map<number, { lastMessageSender: 0 | 1 | null; hasOnlyMyMessages: boolean }>();
        
        if (!db.objectStoreNames.contains(STORE_NAME) || groupIds.length === 0) {
            // Initialize all with null
            groupIds.forEach(id => result.set(id, { lastMessageSender: null, hasOnlyMyMessages: false }));
            return result;
        }

        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const groupIndex = store.index('group_id');
        
        // Process each group efficiently
        await Promise.all(
            groupIds.map(async (groupId) => {
                try {
                    // Get messages for this group using index
                    const messages = await groupIndex.getAll(groupId);
                    
                    if (messages.length === 0) {
                        result.set(groupId, { lastMessageSender: null, hasOnlyMyMessages: false });
                        return;
                    }
                    
                    // Find last message (highest date2) - only need to track the last one
                    let lastMessage = messages[0];
                    let hasOtherSender = messages[0].sender !== 0;
                    
                    // Single pass through messages to find last and check for other senders
                    for (let i = 1; i < messages.length; i++) {
                        const msg = messages[i];
                        if (msg.date2 > lastMessage.date2) {
                            lastMessage = msg;
                        }
                        if (msg.sender !== 0) {
                            hasOtherSender = true;
                        }
                    }
                    
                    result.set(groupId, {
                        lastMessageSender: lastMessage.sender as 0 | 1,
                        hasOnlyMyMessages: !hasOtherSender
                    });
                } catch (error) {
                    console.error(`[MessageStorage] Error getting message info for group ${groupId}:`, error);
                    result.set(groupId, { lastMessageSender: null, hasOnlyMyMessages: false });
                }
            })
        );
        
        return result;
    }

    /**
     * Search messages across all chats and return group IDs that have matching messages
     * Uses IndexedDB queries for efficient searching
     * @param query Search query string
     * @param folderId Optional folder ID to limit search to chats in that folder
     * @returns Set of group IDs that have messages matching the query
     */
    async searchMessages(query: string, folderId?: number | null): Promise<Set<number>> {
        const db = await this.getDB();
        const matchingGroupIds = new Set<number>();
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            return matchingGroupIds;
        }

        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('group_id');
        
        const lowerQuery = query.toLowerCase();
        
        // If folderId is specified, we need to get chats in that folder first
        let groupIdsToSearch: number[] | null = null;
        if (folderId !== undefined && folderId !== null) {
            const chatStore = db.transaction('chats', 'readonly').objectStore('chats');
            const folderIndex = chatStore.index('folder_id');
            const folderChats = await folderIndex.getAll(folderId);
            groupIdsToSearch = folderChats.map((chat: any) => chat.group_id);
        }
        
        // Get all messages (or messages for specific groups if folderId specified)
        const allMessages = await store.getAll();
        
        // Filter messages by group_id if folderId specified
        const messagesToSearch = groupIdsToSearch 
            ? allMessages.filter((item: any) => groupIdsToSearch!.includes(item.group_id))
            : allMessages;
        
        // Group messages by group_id and check if any message matches
        const groupMessages = new Map<number, any[]>();
        messagesToSearch.forEach((item: any) => {
            const groupId = item.group_id;
            if (!groupMessages.has(groupId)) {
                groupMessages.set(groupId, []);
            }
            groupMessages.get(groupId)!.push(item);
        });
        
        // Check each group for matching messages
        groupMessages.forEach((messages, groupId) => {
            const hasMatch = messages.some((item: any) => {
                const messageText = (item.message || '').toLowerCase();
                return messageText.includes(lowerQuery);
            });
            
            if (hasMatch) {
                matchingGroupIds.add(groupId);
            }
        });
        
        console.log(`[MessageStorage] Found ${matchingGroupIds.size} chats with messages matching "${query}"`);
        return matchingGroupIds;
    }
}

// Create singleton instance
export const messageStorage = new MessageStorage();

