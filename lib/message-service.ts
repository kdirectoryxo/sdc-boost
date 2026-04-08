/**
 * Message Service
 * Handles message loading, fetching, and storage operations
 */

import { getMessengerChatDetails, getMessengerGroupChatDetails } from './sdc-api';
import { messageStorage } from './message-storage';
import { chatStorage } from './chat-storage';
import type {
    MessengerChatDetailsInfo,
    MessengerChatItem,
    MessengerMessage,
} from './sdc-api-types';
import { toast } from '@/lib/toast';

/** Dedupe \"deleted chat\" toasts when the same removal is processed more than once */
const deletedChatToastGroupIds = new Set<number>();

/** Next batch of older messages: `info.next_token` only (`-1` means done). */
function getNextChatDetailsCursor(info: MessengerChatDetailsInfo): string | null {
    const nt = info.next_token;
    if (nt === undefined || nt === null) {
        return null;
    }
    if (typeof nt === 'number' && nt === -1) {
        return null;
    }
    if (String(nt) === '-1') {
        return null;
    }
    const s = String(nt).trim();
    return s.length > 0 ? s : null;
}

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
    let nextToken: string | null = null;
    let hasMore = true;
    let isFirstBatch = true;
    const allMessages: MessengerMessage[] = [];
    /** DM/broadcast: API may normalize `DB_ID` / `GroupID` in the response — use for subsequent pages (matches official `next_token` flow). */
    let dbId = chat.db_id;
    let groupId: number | string = chat.group_id;

    while (hasMore) {
        try {
            // Real messenger groups only (`group_type === 1`). DMs/broadcasts use composite string group_id but are not groups.
            const isGroup = chat.group_type === 1;

            const response = isGroup
                ? await getMessengerGroupChatDetails(String(chat.group_id), undefined, nextToken)
                : await getMessengerChatDetails(
                      dbId,
                      groupId,
                      chat.group_type || 0,
                      undefined,
                      nextToken
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
                
                // If this is the latest batch (first request), delete all optimistic messages
                if (isFirstBatch && pageMessages.length > 0) {
                    await messageStorage.deleteAllOptimisticMessages(chat.group_id);
                }
                isFirstBatch = false;
                
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

                if (!isGroup) {
                    const info = response.info;
                    if (info.target_db_id != null) {
                        dbId = info.target_db_id;
                    }
                    const gid = info.group_id as string | number | undefined;
                    if (gid !== undefined && gid !== null && String(gid).length > 0) {
                        groupId = gid;
                    }
                }

                const cursor = getNextChatDetailsCursor(response.info);
                if (cursor) {
                    nextToken = cursor;
                } else {
                    hasMore = false;
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
            console.error(`[MessageService] Failed to fetch chat history batch:`, err);
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
 * Refresh latest messages in background (no `next_token` — current window only).
 * Used when WebSocket message is received to get any updates
 */
export async function refreshLatestPage(
    chat: MessengerChatItem,
    onUpdate?: (messages: MessengerMessage[]) => void
): Promise<void> {
    try {
        const isGroup = chat.group_type === 1;

        const response = isGroup
            ? await getMessengerGroupChatDetails(String(chat.group_id))
            : await getMessengerChatDetails(
                chat.db_id,
                chat.group_id,
                chat.group_type || 0
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
    
    if (!deletedChatToastGroupIds.has(chat.group_id)) {
        deletedChatToastGroupIds.add(chat.group_id);
        toast.error(
            'Dit profiel is niet langer beschikbaar. Het account van het lid is mogelijk inactief of verwijderd.'
        );
    }
}

/**
 * Fetch only new messages (for already fetched chats)
 * Single request without `next_token` (latest batch from the API).
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
        const isGroup = chat.group_type === 1;

        const response = isGroup
            ? await getMessengerGroupChatDetails(String(chat.group_id))
            : await getMessengerChatDetails(
                chat.db_id,
                chat.group_id,
                chat.group_type || 0
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

