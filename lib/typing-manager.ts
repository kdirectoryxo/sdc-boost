/**
 * Typing Manager
 * Manages typing indicators and timeouts
 */

import { sendTypingEvent } from './chat-service';
import type { MessengerChatItem } from './sdc-api-types';

export class TypingManager {
    private typingTimeout: ReturnType<typeof setTimeout> | null = null;
    private isTyping = false;
    private currentChat: MessengerChatItem | null = null;

    /**
     * Handle typing in message input
     */
    handleTyping(chat: MessengerChatItem): void {
        // Update current chat
        this.currentChat = chat;
        
        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }

        // Send typing true if not already typing
        if (!this.isTyping) {
            this.isTyping = true;
            sendTypingEvent(chat, true);
        }

        // Set timeout to send typing false after 3 seconds of no typing
        this.typingTimeout = setTimeout(() => {
            if (this.isTyping) {
                sendTypingEvent(chat, false);
                this.isTyping = false;
            }
            this.typingTimeout = null;
        }, 3000);
    }

    /**
     * Stop typing indicator
     */
    stopTyping(): void {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
        
        if (this.isTyping && this.currentChat) {
            sendTypingEvent(this.currentChat, false);
            this.isTyping = false;
        }
    }

    /**
     * Reset typing state (e.g., when switching chats)
     */
    reset(): void {
        this.stopTyping();
        this.currentChat = null;
    }

    /**
     * Get current typing state
     */
    getIsTyping(): boolean {
        return this.isTyping;
    }
}

