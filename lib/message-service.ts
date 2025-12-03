/**
 * Message Service
 * Handles message loading, fetching, and storage operations
 */

import { getMessengerChatDetails } from './sdc-api';
import { messageStorage } from './message-storage';
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
            fetchNewMessagesOnly(chat, latestMessageId, onProgress).catch(console.error);
            
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
            const response = await getMessengerChatDetails(
                chat.db_id,
                chat.group_id,
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
            } else {
                hasMore = false;
            }
        } catch (err) {
            // Check if this is a blocked chat error - re-throw it so UI can handle it
            if (err && typeof err === 'object' && 'isBlockedChat' in err && err.isBlockedChat) {
                throw err;
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
        const response = await getMessengerChatDetails(
            chat.db_id,
            chat.group_id,
            chat.group_type || 0,
            0
        );

        const responseCode = response.info.code;
        if (responseCode === '200' || responseCode === 200) {
            const pageMessages = response.info.message_list || [];
            
            if (pageMessages.length > 0) {
                // Store messages
                await messageStorage.upsertMessages(chat.group_id, pageMessages);
                
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
        }
    } catch (err) {
        // Check if this is a blocked chat error - re-throw it so UI can handle it
        if (err && typeof err === 'object' && 'isBlockedChat' in err && err.isBlockedChat) {
            throw err;
        }
        console.error('[MessageService] Failed to refresh latest page:', err);
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
        // Only fetch page 0 (latest page)
        const response = await getMessengerChatDetails(
            chat.db_id,
            chat.group_id,
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
        }
    } catch (err) {
        // Check if this is a blocked chat error - re-throw it so UI can handle it
        if (err && typeof err === 'object' && 'isBlockedChat' in err && err.isBlockedChat) {
            throw err;
        }
        console.error('[MessageService] Failed to fetch new messages:', err);
        throw err;
    }
}

