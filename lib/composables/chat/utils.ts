import type { MessengerChatItem, MessengerMessage } from '@/lib/sdc-api-types';

/**
 * Parse message to extract image IDs and text
 * Format: [6|{image_id1,image_id2}-|-{text}] or [6|{image_id}-|-{text}]
 * Returns { imageIds: string[], text: string }
 */
export function parseImageMessage(message: string): { imageIds: string[]; text: string } {
  // Match format: [6|{image_id(s)}-|-{text}]
  // Use non-greedy match to avoid capturing the closing bracket
  const match = message.match(/^\[6\|([^-]+)-\|-(.*?)\]$/);
  if (match) {
    const imageIdString = match[1];
    // Split by comma to get multiple image IDs
    const imageIds = imageIdString.split(',').map(id => id.trim()).filter(id => id.length > 0);
    return {
      imageIds,
      text: match[2] || ''
    };
  }
  return {
    imageIds: [],
    text: message
  };
}

/**
 * Get image URL from image ID and user DB ID
 * Format: https://pictures.sdc.com/photos/{db_id}/thumbnail/{image_id}
 */
export function getImageUrl(imageId: string, dbId?: number): string {
  // SDC image URL format includes user's db_id and thumbnail path
  // Format: https://pictures.sdc.com/photos/{db_id}/thumbnail/{image_id}
  if (dbId) {
    return `https://pictures.sdc.com/photos/${dbId}/thumbnail/${imageId}`;
  }
  // Fallback if dbId not provided
  return `https://pictures.sdc.com/photos/${imageId}`;
}

/**
 * Escape HTML to prevent XSS attacks
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Highlight matching text in message content
 * Escapes HTML to prevent XSS and wraps matches in <mark> tags
 */
export function highlightText(text: string, query: string): string {
  if (!query) {
    return escapeHtml(text);
  }
  
  const escapedText = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  
  // Create case-insensitive regex
  const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  
  return escapedText.replace(regex, '<mark class="bg-yellow-500/50 text-yellow-100">$1</mark>');
}

/**
 * Format message date
 */
export function formatMessageDate(message: MessengerMessage): string {
  return message.date || new Date(message.date2 * 1000).toLocaleString();
}

/**
 * Check if message is from current user
 * sender: 0 = current user, sender: 1 = other user
 */
export function isOwnMessage(message: MessengerMessage): boolean {
  return message.sender === 0;
}

/**
 * Get a unique key for a chat (for Vue keys)
 */
export function getChatKey(chat: MessengerChatItem | null): string {
  if (!chat) return '';
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
 * Sort chats: pinned first, then by date_time
 */
export function sortChats(chats: MessengerChatItem[]): MessengerChatItem[] {
  return [...chats].sort((a, b) => {
    // Pinned chats first
    const aPinned = a.pin_chat || 0;
    const bPinned = b.pin_chat || 0;
    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }
    // Then by date_time (most recent first)
    // Handle empty/invalid dates better - use a very old date for invalid ones
    const getTime = (chat: MessengerChatItem): number => {
      if (!chat.date_time || chat.date_time === '') {
        // For broadcasts without date_time, try to use a fallback
        // Use a very old date so they sort to bottom, but still sortable
        return new Date('1900-01-01').getTime();
      }
      const parsed = new Date(chat.date_time).getTime();
      // If date parsing failed, return very old date
      return isNaN(parsed) ? new Date('1900-01-01').getTime() : parsed;
    };
    
    const aTime = getTime(a);
    const bTime = getTime(b);
    return bTime - aTime;
  });
}

