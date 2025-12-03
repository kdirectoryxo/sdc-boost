/**
 * IndexedDB storage manager for chats using Dexie
 * Handles storing and retrieving chat list items
 */

import { db, type ChatEntity, type ChatMetadata, type ChatTag, type SyncMetadata } from './db';
import type { MessengerChatItem } from './sdc-api-types';
import { messageStorage } from './message-storage';

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
     * @param chats Array of chats to upsert
     * @param markAsArchived Optional flag to mark chats as archived
     */
    async upsertChats(chats: MessengerChatItem[], markAsArchived: boolean = false): Promise<void> {
        // First, upsert all chats
        await Promise.all(
            chats.map(async (chat) => {
                const chatId = this.getChatId(chat);
                
                // Remove archived, isBlocked, and tags from chat item (they're stored in metadata)
                const { archived, isBlocked, tags, ...chatWithoutMetadata } = chat as any;
                
                const chatWithId: ChatEntity = {
                    ...chatWithoutMetadata,
                    id: chatId,
                };
                await db.chats.put(chatWithId);
            })
        );

        // Then update metadata if needed
        if (markAsArchived) {
            await Promise.all(
                chats.map(async (chat) => {
                    const existing = await db.chat_metadata.get(chat.group_id);
                    // Serialize tags to ensure they're plain objects
                    const serializedTags = existing?.tags 
                        ? existing.tags.map(tag => ({ text: String(tag.text), color: String(tag.color) }))
                        : undefined;
                    const metadata: ChatMetadata = {
                        group_id: chat.group_id,
                        messages_fetched: existing?.messages_fetched || false,
                        last_fetched_at: existing?.last_fetched_at,
                        isBlocked: existing?.isBlocked,
                        isArchived: true,
                        ...(serializedTags && serializedTags.length > 0 ? { tags: serializedTags } : {}),
                    };
                    await db.chat_metadata.put(metadata);
                })
            );
        }

        console.log(`[ChatStorage] Upserted ${chats.length} chats${markAsArchived ? ' (marked as archived)' : ''}`);
    }

    /**
     * Get all chats from IndexedDB
     * Merges isBlocked status from chat_metadata
     */
    async getAllChats(): Promise<MessengerChatItem[]> {
        const chats = await db.chats.toArray();
        
        // Get all metadata to merge isBlocked, isArchived, and tags
        const allMetadata = await db.chat_metadata.toArray();
        const metadataMap = new Map<number, { isBlocked?: boolean; isArchived?: boolean; tags?: ChatTag[] }>();
        allMetadata.forEach((m) => {
            metadataMap.set(m.group_id, { 
                isBlocked: m.isBlocked, 
                isArchived: m.isArchived,
                tags: m.tags
            });
        });
        
        // Remove the 'id' field we added for IndexedDB and merge metadata
        const result = chats.map((item) => {
            const { id, ...chat } = item;
            const metadata = metadataMap.get(chat.group_id);
            return {
                ...chat,
                ...(metadata?.isBlocked ? { isBlocked: true } : {}),
                ...(metadata?.isArchived ? { isArchived: true } : {}),
                ...(metadata?.tags ? { tags: metadata.tags } : {}),
            } as MessengerChatItem & { tags?: ChatTag[] };
        });
        
        console.log(`[ChatStorage] Retrieved ${result.length} chats from IndexedDB`);
        return result;
    }

    /**
     * Get a single chat by ID
     */
    async getChatById(id: string): Promise<MessengerChatItem | null> {
        const item = await db.chats.get(id);
        
        if (!item) {
            return null;
        }
        
        const { id: _, ...chat } = item;
        return chat as MessengerChatItem;
    }

    /**
     * Get a single chat by chat object (uses getChatId internally)
     * Returns the raw chat from IndexedDB (archived status is now in metadata)
     */
    async getChatRaw(chat: MessengerChatItem): Promise<MessengerChatItem | null> {
        const chatId = this.getChatId(chat);
        const item = await db.chats.get(chatId);
        
        if (!item) {
            return null;
        }
        
        const { id, ...chatData } = item;
        return chatData as MessengerChatItem;
    }

    /**
     * Update a single chat
     * Note: isBlocked, isArchived, and tags are stored in chat_metadata, not on the chat item
     */
    async updateChat(chat: MessengerChatItem): Promise<void> {
        const chatId = this.getChatId(chat);
        
        // Remove isBlocked, archived, and tags from chat item if present (they're stored in metadata)
        const { isBlocked, archived, tags, ...chatWithoutMetadata } = chat as any;
        
        const chatWithId: ChatEntity = {
            ...chatWithoutMetadata,
            id: chatId,
        };
        await db.chats.put(chatWithId);
    }

    /**
     * Clear all chats from IndexedDB
     */
    async clearAllChats(): Promise<void> {
        await db.chats.clear();
        console.log('[ChatStorage] Cleared all chats');
    }

    /**
     * Delete a chat by ID
     */
    async deleteChat(id: string): Promise<void> {
        await db.chats.delete(id);
    }

    /**
     * Helper function to parse date_time and get timestamp
     */
    private getDateTimeTimestamp(dateTime: string | null | undefined): number {
        if (!dateTime || dateTime === '') return 0;
        const parsed = new Date(dateTime).getTime();
        return isNaN(parsed) ? 0 : parsed;
    }

    /**
     * Sync chats from an endpoint with pagination, upserting after each page
     * @param fetchFn Function to fetch a page, returns response with chat_list and url_more
     * @param onProgress Optional callback called after each page is upserted
     * @param lastSyncTime Optional ISO date string - if provided, stops fetching when encountering older chats
     * @returns Object with total number of chats synced and most recent date_time
     */
    async syncChatsFromEndpoint(
        fetchFn: (page: number) => Promise<{ info: { chat_list?: MessengerChatItem[]; url_more?: string } }>,
        onProgress?: (pageChats: MessengerChatItem[], totalSynced: number) => void,
        lastSyncTime: string | null = null
    ): Promise<{ totalSynced: number; mostRecentDateTime: string | null }> {
        let totalSynced = 0;
        let page = 0;
        let hasMore = true;
        let mostRecentDateTime: string | null = null;
        const lastSyncTimestamp = lastSyncTime ? this.getDateTimeTimestamp(lastSyncTime) : null;

        while (hasMore) {
            const response = await fetchFn(page);
            const chats = response.info.chat_list || [];
            
            if (chats.length === 0) {
                hasMore = false;
                break;
            }

            // Deduplicate this page's chats
            const deduplicatedPageChats = deduplicateChats(chats);

            // Track most recent date_time from this page and check for incremental sync stop condition
            let shouldStopDueToOlderChats = false;
            for (const chat of deduplicatedPageChats) {
                // Track most recent date_time
                if (chat.date_time && chat.date_time !== '') {
                    const chatTimestamp = this.getDateTimeTimestamp(chat.date_time);
                    if (!mostRecentDateTime || chatTimestamp > this.getDateTimeTimestamp(mostRecentDateTime)) {
                        mostRecentDateTime = chat.date_time;
                    }
                }
                
                // Check if this chat is older than last sync time (for incremental sync)
                if (lastSyncTimestamp !== null) {
                    const chatTimestamp = this.getDateTimeTimestamp(chat.date_time);
                    if (chatTimestamp > 0 && chatTimestamp < lastSyncTimestamp) {
                        shouldStopDueToOlderChats = true;
                        // Don't break - continue processing all chats on this page
                    }
                }
            }
            
            // Upsert this page's chats immediately (archived flag handled by onProgress callback)
            await this.upsertChats(deduplicatedPageChats);
            totalSynced += deduplicatedPageChats.length;

            // Call progress callback if provided
            if (onProgress) {
                onProgress(deduplicatedPageChats, totalSynced);
            }
            
            // If we found older chats, stop fetching more pages (but we've already processed this page)
            if (shouldStopDueToOlderChats) {
                hasMore = false;
                break;
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

        return { totalSynced, mostRecentDateTime };
    }

    /**
     * Remove chats by folder ID
     * @param folderId The folder ID to remove chats for
     */
    async removeChatsByFolderId(folderId: number): Promise<void> {
        const chatsToRemove = await db.chats
            .where('folder_id')
            .equals(folderId)
            .toArray();
        
        await Promise.all(
            chatsToRemove.map(chat => db.chats.delete(chat.id))
        );
        
        console.log(`[ChatStorage] Removed ${chatsToRemove.length} chats from folder ${folderId}`);
    }

    /**
     * Remove inbox chats (folder_id === 0 or null)
     */
    async removeInboxChats(): Promise<void> {
        // Get all chats and filter for folder_id === 0 or null
        const allChats = await db.chats.toArray();
        const chatsToRemove = allChats.filter(chat => (chat.folder_id || 0) === 0);
        
        await Promise.all(
            chatsToRemove.map(chat => db.chats.delete(chat.id))
        );
        
        console.log(`[ChatStorage] Removed ${chatsToRemove.length} inbox chats`);
    }

    /**
     * Get last sync time for a given key (inbox or folder)
     * @param key The sync key ('inbox' or 'folder_${folderId}')
     * @returns Last sync time as ISO date string, or null if not found
     */
    async getLastSyncTime(key: string): Promise<string | null> {
        const item = await db.sync_metadata.get(key);
        return item?.last_sync_time || null;
    }

    /**
     * Set last sync time for a given key
     * @param key The sync key ('inbox' or 'folder_${folderId}')
     * @param dateTime ISO date string from chat date_time field
     */
    async setLastSyncTime(key: string, dateTime: string): Promise<void> {
        await db.sync_metadata.put({
            key,
            last_sync_time: dateTime,
        });
        console.log(`[ChatStorage] Set last sync time for ${key}: ${dateTime}`);
    }

    /**
     * Get last sync time for inbox (messenger_latest)
     * @returns Last sync time as ISO date string, or null if not found
     */
    async getInboxLastSyncTime(): Promise<string | null> {
        return this.getLastSyncTime('inbox');
    }

    /**
     * Get last sync time for a specific folder
     * @param folderId The folder ID
     * @returns Last sync time as ISO date string, or null if not found
     */
    async getFolderLastSyncTime(folderId: number): Promise<string | null> {
        return this.getLastSyncTime(`folder_${folderId}`);
    }

    /**
     * Get last sync time for archives
     * @returns Last sync time as ISO date string, or null if not found
     */
    async getArchivesLastSyncTime(): Promise<string | null> {
        return this.getLastSyncTime('archives');
    }

    /**
     * Search chats using Dexie queries
     * @param options Search options
     * @returns Array of matching chats
     */
    async searchChats(options: {
        query?: string;
        folderId?: number | null;
        unreadOnly?: boolean;
        pinnedOnly?: boolean;
        onlineOnly?: boolean;
        lastMessageByMe?: boolean;
        lastMessageByOther?: boolean;
        onlyMyMessages?: boolean;
        blockedOnly?: boolean;
        showArchives?: boolean; // If true, only show archived chats. If false/undefined, exclude archived chats
    }): Promise<MessengerChatItem[]> {
        let chats: ChatEntity[] = [];
        
        // Filter by folder using index if specified
        if (options.folderId !== undefined && options.folderId !== null) {
            chats = await db.chats
                .where('folder_id')
                .equals(options.folderId)
                .toArray();
        } else {
            // Get all chats
            chats = await db.chats.toArray();
        }
        
        // Get metadata for all chats to merge isBlocked, isArchived, and tags
        const allMetadata = await db.chat_metadata.toArray();
        const metadataMap = new Map<number, { isBlocked?: boolean; isArchived?: boolean; tags?: ChatTag[] }>();
        allMetadata.forEach((m) => {
            // Serialize tags to ensure they're plain objects (avoid IndexedDB cloning issues)
            const serializedTags = m.tags ? m.tags.map(tag => ({
                text: String(tag.text),
                color: String(tag.color),
            })) : undefined;
            
            metadataMap.set(m.group_id, { 
                isBlocked: m.isBlocked,
                isArchived: m.isArchived,
                tags: serializedTags
            });
        });
        
        // Remove the 'id' field and convert to MessengerChatItem
        // Also filter archived chats based on showArchives option
        let result = chats.map((item) => {
            const { id, ...chat } = item;
            const chatItem = chat as MessengerChatItem;
            const metadata = metadataMap.get(chatItem.group_id);
            const isArchived = metadata?.isArchived === true;
            const isBlocked = metadata?.isBlocked === true;
            
            // Merge isBlocked, isArchived, and tags from metadata
            const chatWithMetadata = {
                ...chatItem,
                ...(isBlocked ? { isBlocked: true } : {}),
                ...(isArchived ? { isArchived: true } : {}),
                ...(metadata?.tags ? { tags: metadata.tags } : {}),
            };
            
            // Filter by blocked status if blockedOnly is true
            if (options.blockedOnly === true && !isBlocked) {
                return null;
            }
            
            // If showArchives is explicitly true, only include archived chats
            if (options.showArchives === true) {
                return isArchived ? chatWithMetadata : null;
            }
            // Otherwise, exclude archived chats from regular views
            if (options.showArchives === false || options.showArchives === undefined) {
                return !isArchived ? chatWithMetadata : null;
            }
            return chatWithMetadata;
        }).filter((chat): chat is MessengerChatItem => chat !== null);
        
        // Apply text search filter and categorize matches
        if (options.query && options.query.trim()) {
            const query = options.query.toLowerCase();
            const exactMatches: MessengerChatItem[] = [];
            const partialMatches: MessengerChatItem[] = [];
            
            result.forEach(chat => {
                const accountId = (chat.account_id || '').toLowerCase();
                const lastMessage = (chat.last_message || '').toLowerCase();
                const subject = (chat.subject || '').toLowerCase();
                
                // Check for exact match in account_id (highest priority)
                const isExactMatch = accountId === query;
                
                // Check for partial matches
                const isPartialMatch = accountId.includes(query) || 
                                      lastMessage.includes(query) || 
                                      subject.includes(query);
                
                if (isExactMatch) {
                    exactMatches.push(chat);
                } else if (isPartialMatch) {
                    partialMatches.push(chat);
                }
            });
            
            // Combine: exact matches first, then partial matches
            result = [...exactMatches, ...partialMatches];
        }
        
        // Apply unread filter
        if (options.unreadOnly) {
            result = result.filter(chat => chat.unread_counter > 0);
        }
        
        // Apply pinned filter
        if (options.pinnedOnly) {
            result = result.filter(chat => (chat.pin_chat || 0) > 0);
        }
        
        // Apply online filter
        if (options.onlineOnly) {
            result = result.filter(chat => chat.online === 1);
        }
        
        // Apply message sender filters (requires checking messages in IndexedDB efficiently)
        if (options.lastMessageByMe || options.lastMessageByOther || options.onlyMyMessages) {
            // Get group IDs for all chats
            const groupIds = result.map(chat => chat.group_id);
            
            // Get last message info for all chats in one efficient query
            const messageInfo = await messageStorage.getLastMessageInfoForChats(groupIds);
            
            // Filter chats based on message info
            result = result.filter(chat => {
                const info = messageInfo.get(chat.group_id);
                
                if (!info) {
                    // No messages found - exclude if filtering by last message sender
                    if (options.lastMessageByMe || options.lastMessageByOther) {
                        return false;
                    }
                    // For "only my messages", empty chats don't match
                    if (options.onlyMyMessages) {
                        return false;
                    }
                    return true;
                }
                
                // Apply filters
                if (options.lastMessageByMe && info.lastMessageSender !== 0) {
                    return false;
                }
                if (options.lastMessageByOther && info.lastMessageSender !== 1) {
                    return false;
                }
                if (options.onlyMyMessages && !info.hasOnlyMyMessages) {
                    return false;
                }
                
                return true;
            });
        }
        
        // Sort: pinned first, then by date_time
        result.sort((a, b) => {
            const aPinned = a.pin_chat || 0;
            const bPinned = b.pin_chat || 0;
            if (aPinned !== bPinned) {
                return bPinned - aPinned;
            }
            const getTime = (chat: MessengerChatItem): number => {
                if (!chat.date_time || chat.date_time === '') {
                    return new Date('1900-01-01').getTime();
                }
                const parsed = new Date(chat.date_time).getTime();
                return isNaN(parsed) ? new Date('1900-01-01').getTime() : parsed;
            };
            return getTime(b) - getTime(a);
        });
        
        console.log(`[ChatStorage] Search returned ${result.length} chats`);
        return result;
    }

    /**
     * Get unread count for a specific folder
     * Counts chats with unread_counter > 0 in the specified folder
     * @param folderId The folder ID (0 for inbox, null for all chats, number for specific folder)
     * @returns Number of unread chats in the folder
     */
    async getFolderUnreadCount(folderId: number | null): Promise<number> {
        let chats: ChatEntity[] = [];
        
        if (folderId === null) {
            // All chats - get all chats
            chats = await db.chats.toArray();
        } else if (folderId === 0) {
            // Inbox - get all chats and filter for folder_id === 0 or null
            const allChats = await db.chats.toArray();
            chats = allChats.filter(chat => {
                const chatFolderId = chat.folder_id || 0;
                return chatFolderId === 0;
            });
        } else {
            // Specific folder - use index to filter by folder_id
            chats = await db.chats
                .where('folder_id')
                .equals(folderId)
                .toArray();
        }
        
        // Count chats with unread_counter > 0
        const unreadCount = chats.filter(chat => (chat.unread_counter || 0) > 0).length;
        
        return unreadCount;
    }

    /**
     * Get unread count for inbox (folder_id === 0 or null)
     * @returns Number of unread chats in inbox
     */
    async getInboxUnreadCount(): Promise<number> {
        return this.getFolderUnreadCount(0);
    }

    /**
     * Get total unread count across all chats
     * @returns Total number of unread chats
     */
    async getTotalUnreadCount(): Promise<number> {
        return this.getFolderUnreadCount(null);
    }
}

// Create singleton instance
export const chatStorage = new ChatStorage();
