/**
 * WebSocket Event Handlers
 * Processes WebSocket events and updates storage/state
 * Most logic is outside Vue - Vue components reactively display changes
 */

import { websocketManager } from './websocket-manager';
import { chatStorage } from './chat-storage';
import type { MessengerChatItem } from './sdc-api-types';
import { handleMessageUpdate } from './message-update-service';

/**
 * Typing state for a chat
 */
interface TypingState {
    accountId: string;
    dbId: number;
    isTyping: boolean;
    timestamp: number;
}

/**
 * Typing state manager - tracks who is typing in which chat
 */
class TypingStateManager {
    private typingStates: Map<string, TypingState> = new Map();
    private changeListeners: Set<(groupId: string, state: TypingState | null) => void> = new Set();

    /**
     * Get typing state key for a chat
     */
    private getKey(groupId: string | number, accountId: string, dbId: number): string {
        return `${groupId}_${accountId}_${dbId}`;
    }

    /**
     * Update typing state
     */
    updateTyping(groupId: string | number, accountId: string, dbId: number, isTyping: boolean): void {
        const groupIdStr = String(groupId);
        const key = this.getKey(groupId, accountId, dbId);
        
        // Check if anyone was typing before this update
        const wasAnyoneTyping = this.isAnyoneTyping(groupId);
        
        if (isTyping) {
            this.typingStates.set(key, {
                accountId,
                dbId,
                isTyping: true,
                timestamp: Date.now(),
            });
        } else {
            this.typingStates.delete(key);
        }

        // Check if anyone is typing after this update
        const isAnyoneTypingNow = this.isAnyoneTyping(groupId);

        // Notify listeners if the typing status for the group changed
        if (wasAnyoneTyping !== isAnyoneTypingNow) {
            const currentState = isAnyoneTypingNow ? this.getTypingState(groupId)[0] : null;
            this.changeListeners.forEach(listener => {
                try {
                    listener(groupIdStr, currentState);
                } catch (error) {
                    console.error('[TypingStateManager] Error in listener:', error);
                }
            });
        }
    }

    /**
     * Get typing state for a chat
     */
    getTypingState(groupId: string | number): TypingState[] {
        const groupIdStr = String(groupId);
        return Array.from(this.typingStates.entries())
            .filter(([key]) => key.startsWith(`${groupIdStr}_`))
            .map(([, state]) => state);
    }

    /**
     * Check if anyone is typing in a chat
     */
    isAnyoneTyping(groupId: string | number): boolean {
        return this.getTypingState(groupId).length > 0;
    }

    /**
     * Subscribe to typing state changes
     */
    onTypingChange(callback: (groupId: string, state: TypingState | null) => void): () => void {
        this.changeListeners.add(callback);
        return () => {
            this.changeListeners.delete(callback);
        };
    }

    /**
     * Clear all typing states (useful for cleanup)
     */
    clear(): void {
        this.typingStates.clear();
    }
}

// Singleton instance
export const typingStateManager = new TypingStateManager();

/**
 * WebSocket Event Handlers
 * Handles incoming WebSocket events and updates storage/state
 */
class WebSocketHandlers {
    private initialized = false;
    private unsubscribeCallbacks: (() => void)[] = [];

    /**
     * Initialize WebSocket event handlers
     */
    initialize(): void {
        if (this.initialized) {
            console.warn('[WebSocketHandlers] Already initialized');
            return;
        }

        console.log('[WebSocketHandlers] Initializing event handlers...');

        // Handle "seen" events (read receipts)
        const unsubscribeSeen = websocketManager.on('seen', async (data: {
            db_id: number;
            target_db_id: number;
            group_id: string | number;
        }) => {
            console.log('[WebSocketHandlers] Seen event:', data);
            await this.handleSeen(data);
        });

        // Handle "typing" events
        const unsubscribeTyping = websocketManager.on('typing', (data: {
            account_id: string;
            DB_ID: number;
            GroupID: string | number;
            groupType: number;
            targetID: number;
            typing: boolean;
        }) => {
            console.log('[WebSocketHandlers] Typing event:', data);
            this.handleTyping(data);
        });

        // Handle "message" events (new messages)
        const unsubscribeMessage = websocketManager.on('message', async (data: {
            datetime: string;
            ID: string;
            pending: boolean;
            tempId?: string;
            time: string;
            GroupID: string | number;
            DB_ID: number;
            account_id: string;
            db_id: number;
            message: string;
            targetID: number;
            type: number;
            groupType: number;
            date: string;
            primary_photo?: string;
            [key: string]: any;
        }) => {
            console.log('[WebSocketHandlers] Message event:', data);
            await this.handleMessage(data);
        });

        this.unsubscribeCallbacks = [unsubscribeSeen, unsubscribeTyping, unsubscribeMessage];
        this.initialized = true;
        console.log('[WebSocketHandlers] Event handlers initialized');
    }

    /**
     * Cleanup event handlers
     */
    cleanup(): void {
        this.unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
        this.unsubscribeCallbacks = [];
        this.initialized = false;
        console.log('[WebSocketHandlers] Event handlers cleaned up');
    }

    /**
     * Handle "seen" event - message read receipt
     */
    private async handleSeen(data: {
        db_id: number;
        target_db_id: number;
        group_id: string | number;
    }): Promise<void> {
        try {
            // Find the chat by group_id
            const allChats = await chatStorage.getAllChats();
            const chat = allChats.find(c => String(c.group_id) === String(data.group_id));

            if (chat) {
                // Update message_status to indicate messages were seen
                // Note: The exact meaning of message_status depends on SDC's API
                // For now, we'll just update the chat to trigger a refresh
                await chatStorage.updateChat(chat);

                // Emit custom event for Vue components to react to
                window.dispatchEvent(new CustomEvent('sdc-boost:chat-seen', {
                    detail: { groupId: data.group_id, chat }
                }));
            }
        } catch (error) {
            console.error('[WebSocketHandlers] Error handling seen event:', error);
        }
    }

    /**
     * Handle "typing" event
     */
    private handleTyping(data: {
        account_id: string;
        DB_ID: number;
        GroupID: string | number;
        groupType: number;
        targetID: number;
        typing: boolean;
    }): void {
        // Update typing state
        typingStateManager.updateTyping(
            data.GroupID,
            data.account_id,
            data.DB_ID,
            data.typing
        );

        // Emit custom event for Vue components
        window.dispatchEvent(new CustomEvent('sdc-boost:typing', {
            detail: {
                groupId: data.GroupID,
                accountId: data.account_id,
                dbId: data.DB_ID,
                isTyping: data.typing
            }
        }));
    }

    /**
     * Handle "message" event - new message received
     */
    private async handleMessage(data: {
        datetime: string;
        ID: string;
        pending: boolean;
        tempId?: string;
        time: string;
        GroupID: string | number;
        DB_ID: number;
        account_id: string;
        db_id: number;
        message: string;
        targetID: number;
        type: number;
        groupType: number;
        date: string;
        primary_photo?: string;
        [key: string]: any;
    }): Promise<void> {
        try {
            const groupId = String(data.GroupID);
            
            // Find the chat by group_id
            const allChats = await chatStorage.getAllChats();
            let chat = allChats.find(c => String(c.group_id) === groupId);

            if (chat) {
                // Update chat with new message info
                const updatedChat: MessengerChatItem = {
                    ...chat,
                    last_message: data.message,
                    date_time: data.datetime || data.time,
                    date: data.date,
                    // Increment unread counter if message is from someone else
                    // (assuming targetID is the current user's ID)
                    // Note: This logic might need adjustment based on your user ID detection
                    unread_counter: data.db_id !== data.targetID ? (chat.unread_counter || 0) + 1 : chat.unread_counter,
                };

                // Update primary_photo only if provided AND it's a complete path (not just directory)
                // WebSocket messages sometimes send incomplete paths like "8091491/thumbnail/" without filename
                if (data.primary_photo && 
                    data.primary_photo.trim() !== '' && 
                    !data.primary_photo.endsWith('/') &&
                    data.primary_photo.includes('.')) {
                    // It's a complete path with a filename (has an extension)
                    updatedChat.primary_photo = data.primary_photo;
                }
                // Otherwise, keep the existing primary_photo from chat (already set via spread operator)

                // Update in storage
                await chatStorage.updateChat(updatedChat);

                // Emit custom event for Vue components
                window.dispatchEvent(new CustomEvent('sdc-boost:new-message', {
                    detail: {
                        groupId: data.GroupID,
                        chat: updatedChat,
                        message: data
                    }
                }));

                // Handle counter and folder updates
                await handleMessageUpdate(data.groupType, data.GroupID);
            } else {
                // Chat doesn't exist in our storage yet
                // This might happen if it's a new chat
                // We could fetch the chat list or just log it
                console.log('[WebSocketHandlers] Received message for unknown chat:', groupId);
                
                // Emit event anyway so components can handle it
                window.dispatchEvent(new CustomEvent('sdc-boost:new-message', {
                    detail: {
                        groupId: data.GroupID,
                        chat: null,
                        message: data
                    }
                }));

                // Handle counter and folder updates even for unknown chats
                await handleMessageUpdate(data.groupType, data.GroupID);
            }
        } catch (error) {
            console.error('[WebSocketHandlers] Error handling message event:', error);
        }
    }
}

// Create singleton instance
export const websocketHandlers = new WebSocketHandlers();

