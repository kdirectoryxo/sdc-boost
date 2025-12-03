/**
 * Chat Service
 * Handles chat-related operations like sending messages, typing indicators, and seen events
 */

import { websocketManager } from './websocket-manager';
import { getCurrentDBId, getCurrentAccountId, getCurrentMuid } from './sdc-api/utils';
import type { MessengerChatItem, MessengerMessage, Album } from './sdc-api-types';
import { handleMessageUpdate } from './message-update-service';
import { readBroadcast } from './sdc-api/messenger';

/**
 * Get user info with retry logic and better error handling
 */
function getUserInfo(): { dbId: string; accountId: string } | null {
    const dbId = getCurrentDBId();
    const accountId = getCurrentAccountId();
    
    if (!dbId || !accountId) {
        // Try to debug what's available
        try {
            const userInfoStr = localStorage.getItem('user_info');
            if (userInfoStr) {
                const userInfo = JSON.parse(userInfoStr);
                console.log('[ChatService] Available user_info keys:', Object.keys(userInfo));
                if (userInfo.user) {
                    console.log('[ChatService] Available user_info.user keys:', Object.keys(userInfo.user));
                    console.log('[ChatService] user_info.user content:', userInfo.user);
                }
                // Try to extract from user object if available (check both snake_case and camelCase)
                if (userInfo.user) {
                    const userDbId = userInfo.user.db_id || userInfo.user.dbId;
                    const userAccountId = userInfo.user.account_id || userInfo.user.accountId || userInfo.user.username;
                    
                    if (userDbId && userAccountId) {
                        console.log('[ChatService] Found user info in user_info.user object');
                        return { dbId: String(userDbId), accountId: String(userAccountId) };
                    }
                }
            } else {
                console.warn('[ChatService] user_info not found in localStorage');
            }
        } catch (error) {
            console.warn('[ChatService] Error reading user_info:', error);
        }
        
        // Try cookies as fallback
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'SDCUsername' && value && !accountId) {
                console.log('[ChatService] Found account_id from cookie:', decodeURIComponent(value));
            }
        }
        
        return null;
    }
    
    return { dbId, accountId };
}

/**
 * Send typing event via WebSocket
 */
export function sendTypingEvent(chat: MessengerChatItem, typing: boolean): boolean {
    if (!websocketManager.connected) {
        console.warn('[ChatService] Cannot send typing event - WebSocket not connected');
        return false;
    }

    const userInfo = getUserInfo();
    if (!userInfo) {
        console.warn('[ChatService] Cannot send typing event - missing user info');
        return false;
    }

    try {
        websocketManager.send('typing', {
            account_id: userInfo.accountId,
            DB_ID: parseInt(userInfo.dbId),
            GroupID: chat.group_id,
            groupType: chat.group_type || 0,
            targetID: chat.db_id,
            typing: typing
        });
        return true;
    } catch (error) {
        console.error('[ChatService] Error sending typing event:', error);
        return false;
    }
}

/**
 * Send seen event via WebSocket or mark broadcast as read
 */
export async function sendSeenEvent(chat: MessengerChatItem): Promise<boolean> {
    // Check if this is a broadcast
    const isBroadcast = chat.broadcast || chat.type === 100;
    
    if (isBroadcast) {
        // For broadcasts, use the read broadcast API
        if (!chat.id_broadcast) {
            console.warn('[ChatService] Cannot mark broadcast as read - missing id_broadcast');
            return false;
        }
        
        const muid = getCurrentMuid();
        if (!muid) {
            console.warn('[ChatService] Cannot mark broadcast as read - missing MUID');
            return false;
        }
        
        try {
            await readBroadcast(muid, chat.id_broadcast);
            console.log(`[ChatService] Marked broadcast ${chat.id_broadcast} as read`);
            return true;
        } catch (error) {
            console.error('[ChatService] Error marking broadcast as read:', error);
            return false;
        }
    }
    
    // For regular chats, use WebSocket seen event
    if (!websocketManager.connected) {
        console.warn('[ChatService] Cannot send seen event - WebSocket not connected');
        return false;
    }

    const userInfo = getUserInfo();
    if (!userInfo) {
        console.warn('[ChatService] Cannot send seen event - missing user info');
        return false;
    }

    try {
        websocketManager.send('seen', {
            db_id: parseInt(userInfo.dbId),
            target_db_id: chat.db_id,
            group_id: String(chat.group_id)
        });
        return true;
    } catch (error) {
        console.error('[ChatService] Error sending seen event:', error);
        return false;
    }
}

/**
 * Send message via WebSocket
 */
export function sendMessage(chat: MessengerChatItem, messageText: string): boolean {
    if (!websocketManager.connected) {
        console.warn('[ChatService] Cannot send message - WebSocket not connected');
        return false;
    }

    const userInfo = getUserInfo();
    if (!userInfo) {
        console.warn('[ChatService] Cannot send message - missing user info');
        return false;
    }

    if (!messageText.trim()) {
        return false;
    }

    try {
        // Generate tempId for pending message
        const tempId = crypto.randomUUID();

        websocketManager.send('message_v2', {
            account_id: userInfo.accountId,
            DB_ID: parseInt(userInfo.dbId),
            message: messageText.trim(),
            GroupID: chat.group_id,
            type: 0,
            targetID: chat.db_id,
            sender: 0,
            q_message: '',
            q_db_id: 0,
            q_account_id: '',
            quoteBroadcast: 0,
            is_quote: 0,
            qgender1: 2,
            qgender2: 2,
            message_id: 0,
            date: new Date().toLocaleString('en-US', { 
                month: 'short', 
                day: '2-digit', 
                year: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit' 
            }),
            name: '',
            owner: 0,
            addMessage: true,
            album_id: '0',
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            tempId: tempId,
            pending: true
        });

        // Handle counter and folder updates (fire and forget)
        handleMessageUpdate(chat.group_type || 0, chat.group_id).catch(console.error);

        return true;
    } catch (error) {
        console.error('[ChatService] Error sending message:', error);
        return false;
    }
}

/**
 * Send quoted message via WebSocket
 */
export function sendQuotedMessage(chat: MessengerChatItem, messageText: string, quotedMessage: MessengerMessage): boolean {
    if (!websocketManager.connected) {
        console.warn('[ChatService] Cannot send quoted message - WebSocket not connected');
        return false;
    }

    const userInfo = getUserInfo();
    if (!userInfo) {
        console.warn('[ChatService] Cannot send quoted message - missing user info');
        return false;
    }

    if (!messageText.trim()) {
        return false;
    }

    try {
        // Generate tempId for pending message
        const tempId = crypto.randomUUID();

        websocketManager.send('message_v2', {
            account_id: userInfo.accountId,
            DB_ID: parseInt(userInfo.dbId),
            message: messageText.trim(),
            GroupID: chat.group_id,
            type: 0,
            targetID: chat.db_id,
            sender: 0,
            q_message: quotedMessage.message || '.',
            q_db_id: quotedMessage.db_id || parseInt(userInfo.dbId),
            q_account_id: quotedMessage.account_id || userInfo.accountId,
            quoteBroadcast: 0,
            is_quote: 1,
            qgender1: quotedMessage.gender1 || 1,
            qgender2: quotedMessage.gender2 || 0,
            message_id: 0,
            date: new Date().toLocaleString('en-US', { 
                month: 'short', 
                day: '2-digit', 
                year: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit' 
            }),
            name: '',
            owner: 0,
            addMessage: true,
            album_id: '0',
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            tempId: tempId,
            pending: true
        });

        // Handle counter and folder updates (fire and forget)
        handleMessageUpdate(chat.group_type || 0, chat.group_id).catch(console.error);

        return true;
    } catch (error) {
        console.error('[ChatService] Error sending quoted message:', error);
        return false;
    }
}

/**
 * Send message with image via WebSocket
 * Message format: [6|{image_id}-|-{text}]
 */
export function sendMessageWithImage(
    chat: MessengerChatItem,
    messageText: string,
    imageId: string,
    quotedMessage?: MessengerMessage
): boolean {
    if (!websocketManager.connected) {
        console.warn('[ChatService] Cannot send message with image - WebSocket not connected');
        return false;
    }

    const userInfo = getUserInfo();
    if (!userInfo) {
        console.warn('[ChatService] Cannot send message with image - missing user info');
        return false;
    }

    try {
        // Generate tempId for pending message
        const tempId = crypto.randomUUID();

        // Format message as [6|{image_id}-|-{text}]
        const formattedMessage = `[6|${imageId}-|-${messageText || ''}]`;

        websocketManager.send('message_v2', {
            account_id: userInfo.accountId,
            DB_ID: parseInt(userInfo.dbId),
            message: formattedMessage,
            GroupID: chat.group_id,
            type: 0,
            targetID: chat.db_id,
            sender: 0,
            q_message: quotedMessage ? (quotedMessage.message || '.') : '',
            q_db_id: quotedMessage ? (quotedMessage.db_id || parseInt(userInfo.dbId)) : 0,
            q_account_id: quotedMessage ? (quotedMessage.account_id || userInfo.accountId) : '',
            quoteBroadcast: 0,
            is_quote: quotedMessage ? 1 : 0,
            qgender1: quotedMessage ? (quotedMessage.gender1 || 1) : 2,
            qgender2: quotedMessage ? (quotedMessage.gender2 || 0) : 2,
            message_id: 0,
            date: new Date().toLocaleString('en-US', { 
                month: 'short', 
                day: '2-digit', 
                year: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit' 
            }),
            name: '',
            owner: 0,
            addMessage: true,
            album_id: '0',
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            tempId: tempId,
            pending: true
        });

        // Handle counter and folder updates (fire and forget)
        handleMessageUpdate(chat.group_type || 0, chat.group_id).catch(console.error);

        return true;
    } catch (error) {
        console.error('[ChatService] Error sending message with image:', error);
        return false;
    }
}

/**
 * Send albums via WebSocket
 * Message format: [7|{"id":"...","name":"..."}-|-{"id":"...","name":"..."}]
 */
export function sendAlbums(
    chat: MessengerChatItem,
    albums: Album[],
    quotedMessage?: MessengerMessage
): boolean {
    if (!websocketManager.connected) {
        console.warn('[ChatService] Cannot send albums - WebSocket not connected');
        return false;
    }

    const userInfo = getUserInfo();
    if (!userInfo) {
        console.warn('[ChatService] Cannot send albums - missing user info');
        return false;
    }

    if (!albums || albums.length === 0) {
        console.warn('[ChatService] Cannot send albums - no albums provided');
        return false;
    }

    try {
        // Generate tempId for pending message
        const tempId = crypto.randomUUID();

        // Format message as [7|{album1}-|-{album2} where each album is JSON stringified
        // Note: No closing bracket should be added (matches official site behavior)
        const albumStrings = albums.map(album => JSON.stringify({ id: album.id, name: album.name }));
        const formattedMessage = albums.length === 1 
          ? `[7|${albumStrings[0]}`
          : `[7|${albumStrings.join('-|-')}`;

        websocketManager.send('message_v2', {
            account_id: userInfo.accountId,
            DB_ID: parseInt(userInfo.dbId),
            message: formattedMessage,
            GroupID: chat.group_id,
            type: 0,
            targetID: chat.db_id,
            sender: 0,
            q_message: quotedMessage ? (quotedMessage.message || '.') : '',
            q_db_id: quotedMessage ? (quotedMessage.db_id || parseInt(userInfo.dbId)) : 0,
            q_account_id: quotedMessage ? (quotedMessage.account_id || userInfo.accountId) : '',
            quoteBroadcast: 0,
            is_quote: quotedMessage ? 1 : 0,
            qgender1: quotedMessage ? (quotedMessage.gender1 || 1) : 2,
            qgender2: quotedMessage ? (quotedMessage.gender2 || 0) : 2,
            message_id: 0,
            date: new Date().toLocaleString('en-US', { 
                month: 'short', 
                day: '2-digit', 
                year: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit' 
            }),
            name: '',
            owner: 0,
            addMessage: true,
            album_id: '0',
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            tempId: tempId,
            pending: true
        });

        // Handle counter and folder updates (fire and forget)
        handleMessageUpdate(chat.group_type || 0, chat.group_id).catch(console.error);

        return true;
    } catch (error) {
        console.error('[ChatService] Error sending albums:', error);
        return false;
    }
}

