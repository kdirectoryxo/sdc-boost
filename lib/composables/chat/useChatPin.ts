import { createGlobalState } from '@vueuse/core';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { pinChat, markChatUnread, deleteBroadcast, deleteConversation } from '@/lib/sdc-api';
import { chatStorage } from '@/lib/chat-storage';
import { messageStorage } from '@/lib/message-storage';
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

  /**
   * Delete a chat (broadcast or conversation)
   * @param chat The chat to delete
   */
  async function deleteChat(chat: MessengerChatItem): Promise<void> {
    // Show confirmation dialog
    const confirmDialog = (window as any).__sdcBoostConfirm;
    if (!confirmDialog) {
      console.warn('[useChatPin] Confirm dialog not available');
      toast.error('Confirmation dialog not available');
      return;
    }

    const confirmed = await confirmDialog.confirm('Are you sure you want to delete this chat?');
    if (!confirmed) {
      return; // User cancelled
    }

    const isBroadcast = chat.broadcast || chat.type === 100;

    try {
      // Call appropriate API based on chat type
      if (isBroadcast) {
        // For broadcasts, need broadcast_id (id_broadcast)
        if (chat.id_broadcast === undefined || chat.id_broadcast === null) {
          throw new Error('Cannot delete broadcast - missing broadcast ID');
        }
        await deleteBroadcast(chat.id_broadcast);
      } else {
        // For conversations, need group_id and db_id
        if (!chat.group_id || !chat.db_id) {
          throw new Error('Cannot delete conversation - missing group_id or db_id');
        }
        await deleteConversation(chat.group_id, chat.db_id);
      }

      // Calculate chat ID for deletion (same logic as ChatStorage.getChatId)
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

      // Delete chat from local storage
      await chatStorage.deleteChat(chatId);

      // Clear messages for this chat
      if (chat.group_id) {
        await messageStorage.clearMessages(chat.group_id);
      }

      // If this is the selected chat, deselect it
      if (selectedChat.value && selectedChat.value.group_id === chat.group_id) {
        selectedChat.value = null;
        updateChatInURL(null);
      }

      // Show success toast
      toast.success('Chat deleted successfully');

      // Refresh chat list to ensure UI updates
      fetchInboxChats().catch(console.error);
    } catch (error) {
      console.error('[useChatPin] Failed to delete chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete chat';
      toast.error(errorMessage);
    }
  }

  return {
    togglePinChat,
    toggleMarkUnread,
    deleteChat,
  };
});

