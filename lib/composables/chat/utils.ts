import type { MessengerChatItem, MessengerMessage } from '@/lib/sdc-api-types';
import { getCurrentDBId } from '@/lib/sdc-api/utils';

/**
 * Parse message to extract image IDs and text
 * Format: [6|{image_id1,image_id2}-|-{text}] or [6|{image_id}-|-{text}]
 * The closing bracket is optional - some messages don't have it
 * Returns { imageIds: string[], text: string }
 */
export function parseImageMessage(message: string): { imageIds: string[]; text: string } {
  // Match format: [6|{image_id(s)}-|-{text}] or [6|{image_id(s)}-|- (without closing bracket)
  // Match everything after -|- to end of string (or closing bracket)
  const match = message.match(/^\[6\|([^-]+)-\|-(.*)$/);
  if (match) {
    const imageIdString = match[1];
    // Split by comma to get multiple image IDs
    const imageIds = imageIdString.split(',').map(id => id.trim()).filter(id => id.length > 0);
    // Get text part - remove trailing closing bracket if present
    let text = match[2] || '';
    if (text.endsWith(']')) {
      text = text.slice(0, -1);
    }
    return {
      imageIds,
      text: text.trim()
    };
  }
  return {
    imageIds: [],
    text: message
  };
}

/**
 * Parse gallery message to extract gallery ID and name(s)
 * Format: [7|{"id":"...","name":"..."}] or [7|{"id":"...","name":"..."}-|-{"id":"...","name":"..."}]
 * Returns { galleryId: string, galleryName: string, albums?: Array<{id: string, name: string}> } or null if not a gallery message
 * For single album: returns galleryId and galleryName
 * For multiple albums: returns first album's id/name and full albums array
 */
export function parseGalleryMessage(message: string): { galleryId: string; galleryName: string; albums?: Array<{id: string, name: string}> } | null {
  // Match format: [7|{...}] or [7|{...}-|-{...}]
  // The message starts with [7] or [7| followed by JSON objects separated by -|-
  const match = message.match(/^\[7\]?\|?(.+)$/);
  if (match) {
    try {
      let content = match[1];
      // Remove trailing closing bracket if present
      content = content.replace(/\]$/, '');
      
      // Check if there are multiple albums separated by -|-
      if (content.includes('-|-')) {
        // Multiple albums format: {"id":"...","name":"..."}-|-{"id":"...","name":"..."}
        const albumStrings = content.split('-|-');
        const albums: Array<{id: string, name: string}> = [];
        
        for (const albumStr of albumStrings) {
          try {
            const albumData = JSON.parse(albumStr.trim());
            if (albumData.id && albumData.name) {
              albums.push({
                id: albumData.id,
                name: albumData.name
              });
            }
          } catch (e) {
            console.warn('[parseGalleryMessage] Failed to parse album JSON:', e);
          }
        }
        
        if (albums.length > 0) {
          return {
            galleryId: albums[0].id,
            galleryName: albums[0].name,
            albums: albums
          };
        }
      } else {
        // Single album format: {"id":"...","name":"..."}
        const galleryData = JSON.parse(content);
        if (galleryData.id && galleryData.name) {
          return {
            galleryId: galleryData.id,
            galleryName: galleryData.name
          };
        }
      }
    } catch (error) {
      console.warn('[parseGalleryMessage] Failed to parse gallery JSON:', error);
      return null;
    }
  }
  return null;
}

/**
 * Get the correct DB ID for image URLs based on message sender
 * For own messages (sender: 0), use current user's db_id
 * For other messages (sender: 1), use message.db_id (other party's db_id)
 */
export function getImageDbId(message: MessengerMessage): number | null {
  if (isOwnMessage(message)) {
    // For own messages, use current user's db_id
    const currentDbId = getCurrentDBId();
    return currentDbId ? parseInt(currentDbId) : null;
  } else {
    // For other messages, use message.db_id (other party's db_id)
    return message.db_id || null;
  }
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

/**
 * Open user profile in new tab
 */
export function openProfileInNewTab(userId: number): void {
  const profileUrl = `https://www.sdc.com/react/#/profile?idUser=${userId}`;
  window.open(profileUrl, '_blank', 'noopener,noreferrer');
}

