import { createGlobalState } from '@vueuse/core';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { pinChat } from '@/lib/sdc-api';
import { chatStorage } from '@/lib/chat-storage';
import { toast } from '@/lib/toast';
import { useChatSync } from './useChatSync';

export const useChatPin = createGlobalState(() => {
  const { fetchInboxChats } = useChatSync();

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

  return {
    togglePinChat,
  };
});

