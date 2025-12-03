import { nextTick } from 'vue';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { sendSeenEvent } from '@/lib/chat-service';
import { countersManager } from '@/lib/counters-manager';
import { chatStorage } from '@/lib/chat-storage';
import { getChatKey } from './utils';
import { useChatState } from './useChatState';
import { useChatFolders } from './useChatFolders';
import { useChatFilters } from './useChatFilters';
import { useChatMessages } from './useChatMessages';
import { useChatInput } from './useChatInput';

/**
 * Composable for handling chat selection and opening logic
 */
export function useChatSelection() {
  const { selectedChat, updateChatInURL } = useChatState();
  const { searchQuery } = useChatFilters();
  const { 
    messages, 
    messageError, 
    isLoadingMessages, 
    isSyncing, 
    messageSearchQuery,
    messagesContainer,
    handleLoadMessages,
    clearSearch 
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
    
    // Optimistically set unread counter to 0 when opening a chat
    let chatToUse = chat;
    if (chat.unread_counter && chat.unread_counter > 0) {
      const updatedChat = {
        ...chat,
        unread_counter: 0
      };
      
      chatToUse = updatedChat;
      
      // Update in database - chatList will update reactively
      await chatStorage.updateChat(updatedChat);
      
      console.log(`[ChatDialog] Optimistically set unread counter for chat ${chat.group_id} from ${chat.unread_counter} to 0`);
    }
    
    selectedChat.value = chatToUse;
    updateChatInURL(chatToUse);
    
    await handleLoadMessages(chatToUse);
    
    // Don't auto-scroll for broadcasts
    const isBroadcast = chatToUse.broadcast || chatToUse.type === 100;
    if (!isBroadcast) {
      await nextTick();
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    }
    
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
    let chatToUse = chat;
    if (chat.unread_counter && chat.unread_counter > 0) {
      const updatedChat = {
        ...chat,
        unread_counter: 0
      };
      
      chatToUse = updatedChat;
      
      // Update in database - chatList will update reactively
      await chatStorage.updateChat(updatedChat);
      await countersManager.recalculateMessengerCounter();
      
      console.log(`[ChatDialog] Optimistically set unread counter for chat ${chat.group_id} from ${chat.unread_counter} to 0`);
    }
    
    selectedChat.value = chatToUse;
    // Note: messages are now reactive, so we don't need to manually clear them
    isLoadingMessages.value = false;
    isSyncing.value = false;
    typingManager.reset();
    clearSearch();
    await handleLoadMessages(chatToUse);
    
    // Don't auto-scroll for broadcasts
    const isBroadcast = chatToUse.broadcast || chatToUse.type === 100;
    if (!isBroadcast) {
      await nextTick();
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    }
    
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


