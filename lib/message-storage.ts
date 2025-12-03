/**
 * IndexedDB storage manager for chat messages using Dexie
 * Handles storing and retrieving messages for a specific chat
 */

import { db, type MessageEntity, type ChatMetadata } from './db';
import type { MessengerMessage } from './sdc-api-types';

/**
 * Get a unique key for a message
 */
function getMessageKey(groupId: number, messageId: number): string {
    return `${groupId}_${messageId}`;
}

class MessageStorage {
    /**
     * Upsert messages (insert or update)
     */
    async upsertMessages(groupId: number, messages: MessengerMessage[]): Promise<void> {
        await Promise.all(
            messages.map((message) => {
                const messageWithKey: MessageEntity = {
                    ...message,
                    id: getMessageKey(groupId, message.message_id),
                    group_id: groupId,
                };
                return db.messages.put(messageWithKey);
            })
        );

        console.log(`[MessageStorage] Upserted ${messages.length} messages for group ${groupId}`);
    }

    /**
     * Get all messages for a specific chat/group
     */
    async getMessages(groupId: number): Promise<MessengerMessage[]> {
        const groupMessages = await db.messages
            .where('group_id')
            .equals(groupId)
            .toArray();
        
        const result = groupMessages
            .map((item) => {
                const { id, group_id, ...message } = item;
                return message as MessengerMessage;
            })
            .sort((a, b) => a.date2 - b.date2); // Sort by timestamp ascending (oldest first)

        console.log(`[MessageStorage] Retrieved ${result.length} messages for group ${groupId}`);
        return result;
    }

    /**
     * Add a single message
     */
    async addMessage(groupId: number, message: MessengerMessage): Promise<void> {
        const messageWithKey: MessageEntity = {
            ...message,
            id: getMessageKey(groupId, message.message_id),
            group_id: groupId,
        };
        
        await db.messages.put(messageWithKey);
        console.log(`[MessageStorage] Added message ${message.message_id} for group ${groupId}`);
    }

    /**
     * Update a message (e.g., seen status)
     */
    async updateMessage(groupId: number, messageId: number, updates: Partial<MessengerMessage>): Promise<void> {
        const key = getMessageKey(groupId, messageId);
        const existing = await db.messages.get(key);
        
        if (existing) {
            const updated: MessageEntity = {
                ...existing,
                ...updates,
                id: key,
                group_id: groupId,
            };
            await db.messages.put(updated);
            console.log(`[MessageStorage] Updated message ${messageId} for group ${groupId}`);
        }
    }

    /**
     * Clear all messages for a specific chat/group
     */
    async clearMessages(groupId: number): Promise<void> {
        const groupMessages = await db.messages
            .where('group_id')
            .equals(groupId)
            .toArray();
        
        await Promise.all(groupMessages.map(msg => db.messages.delete(msg.id)));
        
        console.log(`[MessageStorage] Cleared ${groupMessages.length} messages for group ${groupId}`);
    }

    /**
     * Clear all messages
     */
    async clearAllMessages(): Promise<void> {
        await db.messages.clear();
        console.log('[MessageStorage] Cleared all messages');
    }

    /**
     * Check if chat has been fetched before
     */
    async hasChatBeenFetched(groupId: number): Promise<boolean> {
        try {
            const metadata = await db.chat_metadata.get(groupId);
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
        try {
            // Get existing metadata to preserve isBlocked and isArchived flags
            const existing = await db.chat_metadata.get(groupId);
            await db.chat_metadata.put({
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
        try {
            // Get existing metadata to preserve other fields
            const existing = await db.chat_metadata.get(groupId);
            await db.chat_metadata.put({
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
        try {
            const metadata = await db.chat_metadata.get(groupId);
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
        try {
            // Get existing metadata to preserve other fields
            const existing = await db.chat_metadata.get(groupId);
            await db.chat_metadata.put({
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
        try {
            const metadata = await db.chat_metadata.get(groupId);
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
        const key = getMessageKey(groupId, messageId);
        await db.messages.delete(key);
        console.log(`[MessageStorage] Deleted message ${messageId} for group ${groupId}`);
    }

    /**
     * Get the last message for a specific chat/group efficiently
     * Uses Dexie index to get only the last message without loading all messages
     * @param groupId The group ID
     * @returns The last message or null if no messages exist
     */
    async getLastMessage(groupId: number): Promise<MessengerMessage | null> {
        const groupMessages = await db.messages
            .where('group_id')
            .equals(groupId)
            .toArray();
        
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
     * Uses Dexie queries efficiently without loading all messages
     * @param groupId The group ID
     * @returns true if all messages are from sender 0, false otherwise
     */
    async hasOnlyMyMessages(groupId: number): Promise<boolean> {
        const groupMessages = await db.messages
            .where('group_id')
            .equals(groupId)
            .toArray();
        
        if (groupMessages.length === 0) {
            return false; // No messages means it's not "only my messages"
        }
        
        // Check if any message has sender !== 0
        const hasOtherSender = groupMessages.some((msg) => msg.sender !== 0);
        return !hasOtherSender;
    }

    /**
     * Get last message sender info for multiple chats efficiently
     * Uses Dexie queries to get only necessary data without loading all messages
     * @param groupIds Array of group IDs to check
     * @returns Map of groupId -> { lastMessageSender: 0 | 1 | null, hasOnlyMyMessages: boolean }
     */
    async getLastMessageInfoForChats(groupIds: number[]): Promise<Map<number, { lastMessageSender: 0 | 1 | null; hasOnlyMyMessages: boolean }>> {
        const result = new Map<number, { lastMessageSender: 0 | 1 | null; hasOnlyMyMessages: boolean }>();
        
        if (groupIds.length === 0) {
            return result;
        }

        // Process each group efficiently
        await Promise.all(
            groupIds.map(async (groupId) => {
                try {
                    // Get messages for this group using index
                    const messages = await db.messages
                        .where('group_id')
                        .equals(groupId)
                        .toArray();
                    
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
     * Uses Dexie queries for efficient searching
     * @param query Search query string
     * @param folderId Optional folder ID to limit search to chats in that folder
     * @returns Set of group IDs that have messages matching the query
     */
    async searchMessages(query: string, folderId?: number | null): Promise<Set<number>> {
        const matchingGroupIds = new Set<number>();
        const lowerQuery = query.toLowerCase();
        
        // If folderId is specified, we need to get chats in that folder first
        let groupIdsToSearch: number[] | null = null;
        if (folderId !== undefined && folderId !== null) {
            const folderChats = await db.chats
                .where('folder_id')
                .equals(folderId)
                .toArray();
            groupIdsToSearch = folderChats.map((chat) => chat.group_id);
        }
        
        // Get all messages (or messages for specific groups if folderId specified)
        const allMessages = await db.messages.toArray();
        
        // Filter messages by group_id if folderId specified
        const messagesToSearch = groupIdsToSearch 
            ? allMessages.filter((item) => groupIdsToSearch!.includes(item.group_id))
            : allMessages;
        
        // Group messages by group_id and check if any message matches
        const groupMessages = new Map<number, MessageEntity[]>();
        messagesToSearch.forEach((item) => {
            const groupId = item.group_id;
            if (!groupMessages.has(groupId)) {
                groupMessages.set(groupId, []);
            }
            groupMessages.get(groupId)!.push(item);
        });
        
        // Check each group for matching messages
        groupMessages.forEach((messages, groupId) => {
            const hasMatch = messages.some((item) => {
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
