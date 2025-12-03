import { createGlobalState } from '@vueuse/core';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { pinChat, markChatUnread } from '@/lib/sdc-api';
import { chatStorage } from '@/lib/chat-storage';
import { toast } from '@/lib/toast';
import { useChatSync } from './useChatSync';
import { useChatState } from './useChatState';

export const useChatPin = createGlobalState(() => {
  const { fetchInboxChats } = useChatSync();
  const { selectedChat, updateChatInURL } = useChatState();

  /**
   * Toggle pin status of a chat
   * @param chat The chat to pin/unpin
   */
  async function togglePinChat(chat: MessengerChatItem): Promise<void> {
    if (!chat.group_id) {
      console.error('[useChatPin] Cannot pin/unpin chat - missing group_id');
      toast.error('Failed to pin/unpin chat');
      return;
    }

    const currentPinStatus = chat.pin_chat || 0;
    const newPinStatus = currentPinStatus === 1 ? 0 : 1;

    try {
      // Call API to pin/unpin
      const response = await pinChat(chat.group_id, newPinStatus as 0 | 1);

      // Check if successful
      if (response.info.success && response.info.code === 200) {
        // Update chat in database
        const updatedChat: MessengerChatItem = {
          ...chat,
          pin_chat: newPinStatus,
        };
        await chatStorage.updateChat(updatedChat);

        // Show success toast
        const action = newPinStatus === 1 ? 'pinned' : 'unpinned';
        toast.success(`Chat ${action} successfully`);

        // Refresh chat list to ensure UI updates
        // The reactive system should handle this, but we can trigger a refresh for safety
        fetchInboxChats().catch(console.error);
      } else {
        throw new Error(response.info.message || 'Failed to pin/unpin chat');
      }
    } catch (error) {
      console.error('[useChatPin] Failed to pin/unpin chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to pin/unpin chat';
      toast.error(errorMessage);
    }
  }

  /**
   * Mark a chat as read or unread
   * @param chat The chat to mark
   * @param markAsUnread True to mark as unread, false to mark as read
   */
  async function toggleMarkUnread(chat: MessengerChatItem, markAsUnread: boolean): Promise<void> {
    if (!chat.group_id) {
      console.error('[useChatPin] Cannot mark chat as read/unread - missing group_id');
      toast.error('Failed to mark chat as read/unread');
      return;
    }

    const action = markAsUnread ? 1 : 0;

    try {
      // Call API to mark as read/unread
      const response = await markChatUnread(chat.group_id, action as 0 | 1);

      // Check if successful
      if (response.info.updated && response.info.code === 200) {
        // Update chat in database - set unread_counter based on action
        const updatedChat: MessengerChatItem = {
          ...chat,
          unread_counter: markAsUnread ? (response.info.last_unread_message_id ? 1 : 0) : 0,
        };
        await chatStorage.updateChat(updatedChat);

        // If marking as read and this is the selected chat, unselect it
        if (!markAsUnread && selectedChat.value && selectedChat.value.group_id === chat.group_id) {
          selectedChat.value = null;
          updateChatInURL(null);
        }

        // Show success toast
        const actionText = markAsUnread ? 'marked as unread' : 'marked as read';
        toast.success(`Chat ${actionText} successfully`);

        // Refresh chat list to ensure UI updates
        fetchInboxChats().catch(console.error);
      } else {
        throw new Error(response.info.message || 'Failed to mark chat as read/unread');
      }
    } catch (error) {
      console.error('[useChatPin] Failed to mark chat as read/unread:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark chat as read/unread';
      toast.error(errorMessage);
    }
  }

  return {
    togglePinChat,
    toggleMarkUnread,
  };
});

