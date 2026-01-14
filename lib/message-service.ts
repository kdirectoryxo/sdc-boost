/**
 * Message Service
 * Handles message loading, fetching, and storage operations
 */

import { getMessengerChatDetails, getMessengerGroupChatDetails } from './sdc-api';
import { messageStorage } from './message-storage';
import { chatStorage } from './chat-storage';
import type { MessengerChatItem, MessengerMessage } from './sdc-api-types';

/**
 * Load messages for a chat
 * On first load: fetches all history and stores it (shows loading)
 * On subsequent loads: loads from storage immediately, then fetches only latest page (no loading)
 */
export async function loadMessages(
    chat: MessengerChatItem,
    onProgress?: (messages: MessengerMessage[]) => void
): Promise<{
    messages: MessengerMessage[];
    isLoading: boolean;
}> {
    try {
        // Check if chat has been fetched before
        const hasBeenFetched = await messageStorage.hasChatBeenFetched(chat.group_id);
        const storedMessages = await messageStorage.getMessages(chat.group_id);
        
        if (hasBeenFetched && storedMessages.length > 0) {
            // Chat has been fetched before - load from storage immediately (no loading indicator)
            if (onProgress) {
                onProgress(storedMessages);
            }
            
            // Fetch new messages in background without blocking
            const latestMessageId = await messageStorage.getLatestMessageId(chat.group_id);
            fetchNewMessagesOnly(chat, latestMessageId, onProgress).catch(async (err) => {
                // Handle deleted chat errors
                if (err && typeof err === 'object' && 'isDeletedChat' in err && err.isDeletedChat) {
                    await handleDeletedChat(chat);
                } else {
                    console.error('[MessageService] Failed to fetch new messages:', err);
                }
            });
            
            return { messages: storedMessages, isLoading: false };
        } else if (hasBeenFetched && storedMessages.length === 0) {
            // Chat marked as fetched but no messages - fetch all again
            const messages = await fetchAllMessages(chat, onProgress);
            return { messages, isLoading: true };
        } else {
            // First time loading this chat - fetch all history (show loading)
            const messages = await fetchAllMessages(chat, onProgress);
            return { messages, isLoading: true };
        }
    } catch (err) {
        console.error('[MessageService] Failed to load messages:', err);
        throw err;
    }
}

/**
 * Fetch all messages for a chat (full history)
 * Fetches all pages until there are no more messages
 * Updates DB and displays messages progressively as each page loads
 */
export async function fetchAllMessages(
    chat: MessengerChatItem,
    onProgress?: (messages: MessengerMessage[]) => void
): Promise<MessengerMessage[]> {
    console.log(`[MessageService] Fetching all messages for chat ${chat.group_id}...`);
    let page = 0;
    let hasMore = true;
    const allMessages: MessengerMessage[] = [];

    while (hasMore) {
        try {
            // Check if this is a group (group_type === 1 or string group_id)
            const isGroup = chat.group_type === 1 || typeof chat.group_id === 'string';
            
            const response = isGroup
                ? await getMessengerGroupChatDetails(String(chat.group_id), page)
                : await getMessengerChatDetails(
                    chat.db_id,
                    Number(chat.group_id),
                    chat.group_type || 0,
                    page
                );

            const responseCode = response.info.code;
            if (responseCode === '200' || responseCode === 200) {
                const pageMessages = response.info.message_list || [];
                
                if (pageMessages.length === 0) {
                    hasMore = false;
                    break;
                }

                // Store messages immediately after each page
                await messageStorage.upsertMessages(chat.group_id, pageMessages);
                
                // If this is page 0 (latest page), delete all optimistic messages
                // Fresh data from API replaces optimistic messages
                if (page === 0 && pageMessages.length > 0) {
                    await messageStorage.deleteAllOptimisticMessages(chat.group_id);
                }
                
                // Clear blocked status if chat was previously blocked (messages are now available)
                if ((chat as any).isBlocked) {
                    await messageStorage.setChatBlocked(chat.group_id, false);
                }
                
                // Add messages to collection (they come in reverse chronological order from API)
                allMessages.push(...pageMessages);
                
                // Update displayed messages progressively (sort by date2 ascending)
                const sortedMessages = [...allMessages].sort((a, b) => a.date2 - b.date2);
                
                if (onProgress) {
                    onProgress(sortedMessages);
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
            } else if (responseCode === '402' || responseCode === 402) {
                // Blocked chat - this should have been caught by getMessengerChatDetails, but handle it here too
                const blockedError = new Error(response.info.message || 'Chat is blocked') as Error & {
                    code: string | number;
                    allowed?: number;
                    isBlockedChat: boolean;
                };
                blockedError.code = response.info.code;
                blockedError.allowed = response.info.allowed;
                blockedError.isBlockedChat = true;
                blockedError.name = 'BlockedChatError';
                throw blockedError;
            } else if (responseCode === '404' || responseCode === 404) {
                // Deleted chat - this should have been caught by getMessengerChatDetails, but handle it here too
                const deletedError = new Error(response.info.message || 'Profile is no longer available') as Error & {
                    code: string | number;
                    allowed?: number;
                    isDeletedChat: boolean;
                };
                deletedError.code = response.info.code;
                deletedError.allowed = response.info.allowed;
                deletedError.isDeletedChat = true;
                deletedError.name = 'DeletedChatError';
                throw deletedError;
            } else {
                hasMore = false;
            }
        } catch (err) {
            // Check if this is a blocked chat error - re-throw it so UI can handle it
            if (err && typeof err === 'object' && 'isBlockedChat' in err && err.isBlockedChat) {
                throw err;
            }
            // Check if this is a deleted chat error - handle it and re-throw
            if (err && typeof err === 'object' && 'isDeletedChat' in err && err.isDeletedChat) {
                await handleDeletedChat(chat);
                throw err; // Re-throw so UI layer can show toast and deselect
            }
            console.error(`[MessageService] Failed to fetch page ${page}:`, err);
            hasMore = false;
        }
    }

    // Mark chat as fetched and fully synced after all pages are loaded
    if (allMessages.length > 0) {
        await messageStorage.markChatFetched(chat.group_id);
        console.log(`[MessageService] Loaded ${allMessages.length} messages for chat ${chat.group_id}`);
    }
    
    return allMessages.sort((a, b) => a.date2 - b.date2);
}

/**
 * Refresh latest page (page 0) in background
 * Used when WebSocket message is received to get any updates
 */
export async function refreshLatestPage(
    chat: MessengerChatItem,
    onUpdate?: (messages: MessengerMessage[]) => void
): Promise<void> {
    try {
        // Check if this is a group (group_type === 1 or string group_id)
        const isGroup = chat.group_type === 1 || typeof chat.group_id === 'string';
        
        const response = isGroup
            ? await getMessengerGroupChatDetails(String(chat.group_id), 0)
            : await getMessengerChatDetails(
                chat.db_id,
                Number(chat.group_id),
                chat.group_type || 0,
                0
            );

        const responseCode = response.info.code;
        if (responseCode === '200' || responseCode === 200) {
            const pageMessages = response.info.message_list || [];
            
            if (pageMessages.length > 0) {
                // Store new messages from API (this overwrites/upserts existing messages)
                await messageStorage.upsertMessages(chat.group_id, pageMessages);
                
                // Delete all optimistic messages - fresh data from API replaces them
                await messageStorage.deleteAllOptimisticMessages(chat.group_id);
                
                // Clear blocked status if chat was previously blocked (messages are now available)
                if ((chat as any).isBlocked) {
                    await messageStorage.setChatBlocked(chat.group_id, false);
                }
                
                // Reload messages from storage to get updated list
                const storedMessages = await messageStorage.getMessages(chat.group_id);
                
                if (onUpdate) {
                    onUpdate(storedMessages);
                }
            }
        } else if (responseCode === '402' || responseCode === 402) {
            // Blocked chat
            const blockedError = new Error(response.info.message || 'Chat is blocked') as Error & {
                code: string | number;
                allowed?: number;
                isBlockedChat: boolean;
            };
            blockedError.code = response.info.code;
            blockedError.allowed = response.info.allowed;
            blockedError.isBlockedChat = true;
            blockedError.name = 'BlockedChatError';
            throw blockedError;
        } else if (responseCode === '404' || responseCode === 404) {
            // Deleted chat
            const deletedError = new Error(response.info.message || 'Profile is no longer available') as Error & {
                code: string | number;
                allowed?: number;
                isDeletedChat: boolean;
            };
            deletedError.code = response.info.code;
            deletedError.allowed = response.info.allowed;
            deletedError.isDeletedChat = true;
            deletedError.name = 'DeletedChatError';
            throw deletedError;
        }
    } catch (err) {
        // Check if this is a blocked chat error - re-throw it so UI can handle it
        if (err && typeof err === 'object' && 'isBlockedChat' in err && err.isBlockedChat) {
            throw err;
        }
        // Check if this is a deleted chat error - re-throw it so UI can handle it
        if (err && typeof err === 'object' && 'isDeletedChat' in err && err.isDeletedChat) {
            throw err;
        }
        console.error('[MessageService] Failed to refresh latest page:', err);
    }
}

/**
 * Helper function to handle deleted chat removal
 */
async function handleDeletedChat(chat: MessengerChatItem): Promise<void> {
    // Calculate chat ID using the same logic as ChatStorage.getChatId
    const isBroadcast = chat.broadcast || chat.type === 100;
    let chatId: string;
    if (isBroadcast) {
        if (chat.id_broadcast !== undefined && chat.id_broadcast !== null) {
            chatId = `broadcast_${chat.db_id}_${chat.id_broadcast}`;
        } else {
            chatId = `broadcast_${chat.db_id}`;
        }
    } else {
        chatId = `group_${chat.group_id}`;
    }
    
    // Delete chat from storage (idempotent - check if exists first)
    try {
        await chatStorage.deleteChat(chatId);
    } catch (err) {
        // Chat might already be deleted, ignore
        console.log(`[MessageService] Chat ${chatId} might already be deleted`);
    }
    
    // Clear messages for this chat
    await messageStorage.clearMessages(chat.group_id);
    
    console.log(`[MessageService] Removed deleted chat ${chat.group_id} from storage`);
    
    // Mark that we've shown a toast for this deletion (to avoid duplicates)
    // Store in a Set to track which chats we've shown toast for
    if (!(window as any).__sdcBoostDeletedChatToasts) {
        (window as any).__sdcBoostDeletedChatToasts = new Set<number>();
    }
    const deletedChatToasts = (window as any).__sdcBoostDeletedChatToasts as Set<number>;
    
    // Show toast only if we haven't shown one for this chat yet
    if (!deletedChatToasts.has(chat.group_id)) {
        deletedChatToasts.add(chat.group_id);
        const toast = (window as any).__sdcBoostToast;
        if (toast) {
            toast.error('Dit profiel is niet langer beschikbaar. Het account van het lid is mogelijk inactief of verwijderd.');
        }
    }
}

/**
 * Fetch only new messages (for already fetched chats)
 * Only fetches page 0 (latest page) which contains the newest messages
 */
export async function fetchNewMessagesOnly(
    chat: MessengerChatItem,
    latestMessageId: number | null,
    onUpdate?: (messages: MessengerMessage[]) => void
): Promise<void> {
    console.log(`[MessageService] Fetching new messages for chat ${chat.group_id}...`);
    
    if (latestMessageId === null) {
        // No stored messages - this shouldn't happen if chat is fetched, but handle it
        console.warn(`[MessageService] Chat ${chat.group_id} marked as fetched but has no messages. Fetching all.`);
        await fetchAllMessages(chat, onUpdate);
        return;
    }

    try {
        // Check if this is a group (group_type === 1 or string group_id)
        const isGroup = chat.group_type === 1 || typeof chat.group_id === 'string';
        
        // Only fetch page 0 (latest page)
        const response = isGroup
            ? await getMessengerGroupChatDetails(String(chat.group_id), 0)
            : await getMessengerChatDetails(
                chat.db_id,
                Number(chat.group_id),
                chat.group_type || 0,
                0
            );

        const responseCode = response.info.code;
        if (responseCode === '200' || responseCode === 200) {
            const pageMessages = response.info.message_list || [];
            
            if (pageMessages.length === 0) {
                return;
            }

            // Filter to only include messages newer than what we have
            const newMessages = pageMessages.filter(msg => msg.message_id > latestMessageId);
            
            if (newMessages.length > 0) {
                // Store new messages
                await messageStorage.upsertMessages(chat.group_id, newMessages);
                
                // Delete all optimistic messages - fresh data from API replaces them
                await messageStorage.deleteAllOptimisticMessages(chat.group_id);
                
                // Clear blocked status if chat was previously blocked (messages are now available)
                if ((chat as any).isBlocked) {
                    await messageStorage.setChatBlocked(chat.group_id, false);
                }
                
                // Get all messages from storage (sorted)
                const storedMessages = await messageStorage.getMessages(chat.group_id);
                
                if (onUpdate) {
                    onUpdate(storedMessages);
                }
                
                console.log(`[MessageService] Added ${newMessages.length} new messages for chat ${chat.group_id}`);
            }
        } else if (responseCode === '402' || responseCode === 402) {
            // Blocked chat
            const blockedError = new Error(response.info.message || 'Chat is blocked') as Error & {
                code: string | number;
                allowed?: number;
                isBlockedChat: boolean;
            };
            blockedError.code = response.info.code;
            blockedError.allowed = response.info.allowed;
            blockedError.isBlockedChat = true;
            blockedError.name = 'BlockedChatError';
            throw blockedError;
        } else if (responseCode === '404' || responseCode === 404) {
            // Deleted chat
            const deletedError = new Error(response.info.message || 'Profile is no longer available') as Error & {
                code: string | number;
                allowed?: number;
                isDeletedChat: boolean;
            };
            deletedError.code = response.info.code;
            deletedError.allowed = response.info.allowed;
            deletedError.isDeletedChat = true;
            deletedError.name = 'DeletedChatError';
            throw deletedError;
        }
    } catch (err) {
        // Check if this is a blocked chat error - re-throw it so UI can handle it
        if (err && typeof err === 'object' && 'isBlockedChat' in err && err.isBlockedChat) {
            throw err;
        }
        // Check if this is a deleted chat error - re-throw it so it can be handled by loadMessages
        // (which will call handleDeletedChat for background operations)
        if (err && typeof err === 'object' && 'isDeletedChat' in err && err.isDeletedChat) {
            throw err; // Re-throw - will be handled by loadMessages catch handler
        }
        console.error('[MessageService] Failed to fetch new messages:', err);
        throw err;
    }
}

