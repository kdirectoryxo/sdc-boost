import { nextTick } from 'vue';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { sendSeenEvent } from '@/lib/chat-service';
import { countersManager } from '@/lib/counters-manager';
import { chatStorage } from '@/lib/chat-storage';
import { getLatestChatFromList } from './utils';
import { useChatState } from './useChatState';
import { useChatFolders } from './useChatFolders';
import { useChatFilters } from './useChatFilters';
import { useChatMessages } from './useChatMessages';
import { useChatInput } from './useChatInput';
import { profileStorage } from '@/lib/profile-storage';
import { syncSingleProfileSilently } from '@/lib/profile-sync-service';

/**
 * Composable for handling chat selection and opening logic
 */
export function useChatSelection() {
  const { selectedChat, updateChatInURL, chatList } = useChatState();
  const { searchQuery } = useChatFilters();
  const { 
    messageError, 
    isLoadingMessages, 
    isSyncing, 
    messageSearchQuery,
    handleLoadMessages,
    clearSearch,
  } = useChatMessages();
  const { typingManager } = useChatInput();

  /**
   * Handle chat click - opens a chat and loads its messages
   */
  async function handleChatClick(chat: MessengerChatItem | null): Promise<void> {
    if (!chat) return;
    
    // Reset message state
    // Note: messages are now reactive, so we don't need to manually clear them
    messageError.value = null;
    isLoadingMessages.value = false;
    isSyncing.value = false;
    typingManager.reset();
    
    // If there's a chat search query, use it to highlight messages
    const currentSearchQuery = searchQuery.value.trim();
    if (currentSearchQuery) {
      messageSearchQuery.value = currentSearchQuery;
      console.log(`[ChatDialog] Setting message search query to: "${currentSearchQuery}"`);
    } else {
      clearSearch();
    }
    
    // Get the latest chat object from chatList (broadcasts: match by id_broadcast, not group_id)
    const latestChat = getLatestChatFromList(chatList.value, chat);
    
    // Check if profile is synced, and sync it if not (only for valid chats)
    const isBroadcast = latestChat.broadcast || latestChat.type === 100;
    const isValidChat = !isBroadcast && latestChat.db_id > 0;
    
    if (isValidChat) {
      const isProfileSynced = await profileStorage.hasProfileBeenSynced(latestChat.db_id);
      if (!isProfileSynced) {
        // Auto-sync profile silently in the background (fire and forget, no toasts)
        console.log(`[ChatDialog] Profile not synced for chat ${latestChat.db_id}, auto-syncing silently...`);
        syncSingleProfileSilently(latestChat.db_id).catch((err: unknown) => {
          console.error(`[ChatDialog] Failed to auto-sync profile for chat ${latestChat.db_id}:`, err);
          // Silently fail - errors are already handled in syncSingleProfileSilently
        });
      }
    }
    
    // Optimistically set unread counter to 0 when opening a chat
    let chatToUse = latestChat;
    if (latestChat.unread_counter && latestChat.unread_counter > 0) {
      const updatedChat = {
        ...latestChat,
        unread_counter: 0
      };
      
      chatToUse = updatedChat;
      
      // Update in database - chatList will update reactively
      await chatStorage.updateChat(updatedChat);
      
      console.log(`[ChatDialog] Optimistically set unread counter for chat ${latestChat.group_id} from ${latestChat.unread_counter} to 0`);
    }
    
    selectedChat.value = chatToUse;
    updateChatInURL(chatToUse);
    
    await handleLoadMessages(chatToUse);
    // Scroll is handled inside handleLoadMessages on success (avoids double / stepped scroll)

    await sendSeenEvent(chatToUse);
    
    setTimeout(async () => {
      await countersManager.refresh();
      console.log('[ChatDialog] Refreshed counters after opening chat');
    }, 2000);
  }

  /**
   * Open chat from URL - handles the logic for opening a chat when dialog opens with a chat ID in URL
   */
  async function openChatFromURL(chat: MessengerChatItem): Promise<void> {
    // Get the latest chat object from chatList (broadcasts: match by id_broadcast, not group_id)
    const latestChat = getLatestChatFromList(chatList.value, chat);
    
    // Check if profile is synced, and sync it if not (only for valid chats)
    const isBroadcast = latestChat.broadcast || latestChat.type === 100;
    const isValidChat = !isBroadcast && latestChat.db_id > 0;
    
    if (isValidChat) {
      const isProfileSynced = await profileStorage.hasProfileBeenSynced(latestChat.db_id);
      if (!isProfileSynced) {
        // Auto-sync profile silently in the background (fire and forget, no toasts)
        console.log(`[ChatDialog] Profile not synced for chat ${latestChat.db_id}, auto-syncing silently...`);
        syncSingleProfileSilently(latestChat.db_id).catch((err: unknown) => {
          console.error(`[ChatDialog] Failed to auto-sync profile for chat ${latestChat.db_id}:`, err);
          // Silently fail - errors are already handled in syncSingleProfileSilently
        });
      }
    }
    
    let chatToUse = latestChat;
    if (latestChat.unread_counter && latestChat.unread_counter > 0) {
      const updatedChat = {
        ...latestChat,
        unread_counter: 0
      };
      
      chatToUse = updatedChat;
      
      // Update in database - chatList will update reactively
      await chatStorage.updateChat(updatedChat);
      await countersManager.recalculateMessengerCounter();
      
      console.log(`[ChatDialog] Optimistically set unread counter for chat ${latestChat.group_id} from ${latestChat.unread_counter} to 0`);
    }
    
    selectedChat.value = chatToUse;
    // Note: messages are now reactive, so we don't need to manually clear them
    isLoadingMessages.value = false;
    isSyncing.value = false;
    typingManager.reset();
    clearSearch();
    await handleLoadMessages(chatToUse);
    // Scroll is handled inside handleLoadMessages on success

    await sendSeenEvent(chatToUse);
    updateChatInURL(chatToUse);
    
    setTimeout(async () => {
      await countersManager.refresh();
      console.log('[ChatDialog] Refreshed counters after opening chat');
    }, 2000);
  }

  return {
    handleChatClick,
    openChatFromURL,
  };
}


