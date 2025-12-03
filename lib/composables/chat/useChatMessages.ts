import { ref, computed, watch, nextTick } from 'vue';
import type { MessengerChatItem, MessengerMessage } from '@/lib/sdc-api-types';
import { loadMessages, refreshLatestPage } from '@/lib/message-service';
import { deleteMessage } from '@/lib/sdc-api';
import { messageStorage } from '@/lib/message-storage';
import { chatStorage } from '@/lib/chat-storage';
import { useChatState } from './useChatState';
import { useChatFilters } from './useChatFilters';
import { highlightText } from './utils';

export function useChatMessages() {
  const { selectedChat, chatList } = useChatState();
  const { searchQuery, updateFilteredChats } = useChatFilters();
  
  const messages = ref<MessengerMessage[]>([]);
  const isLoadingMessages = ref(false);
  const isSyncing = ref(false); // Track if we're syncing all pages for first-time load
  const messageError = ref<string | null>(null); // Error for message loading
  const messagesContainer = ref<HTMLElement | null>(null);
  
  // Message search state
  const messageSearchQuery = ref('');
  const messageSearchResults = ref<number[]>([]); // Array of message IDs matching the query
  const currentSearchIndex = ref<number>(-1); // Current highlighted result index (-1 means no selection)
  
  // Optimistic message handling
  const optimisticMessageTempIds = ref<Map<string, string>>(new Map()); // Track optimistic messages: tempId -> message content
  const optimisticMessages = ref<Map<string, MessengerMessage>>(new Map()); // Track optimistic messages by tempId
  
  /**
   * Get search query for messages
   * Uses messageSearchQuery if set, otherwise uses chat searchQuery
   */
  const messageSearchQueryComputed = computed(() => {
    return messageSearchQuery.value.trim() || searchQuery.value.trim();
  });
  
  /**
   * Computed property to check if search is active
   */
  const isSearchActive = computed(() => {
    return messageSearchQueryComputed.value.length > 0;
  });
  
  /**
   * Track which messages match the search query (but don't filter - show all messages)
   */
  const filteredMessages = computed(() => {
    // Always return all messages - don't filter
    const query = messageSearchQueryComputed.value.toLowerCase();
    
    if (!query) {
      messageSearchResults.value = [];
      return messages.value;
    }
    
    // Find messages that contain the query and store their IDs
    const matchingMessages = messages.value.filter(message => {
      return message.message.toLowerCase().includes(query);
    });
    
    // Store matching message IDs for navigation
    messageSearchResults.value = matchingMessages.map(msg => msg.message_id);
    
    // Return all messages (not filtered)
    return messages.value;
  });
  
  /**
   * Scroll to the currently selected search result
   */
  async function scrollToCurrentResult(): Promise<void> {
    if (currentSearchIndex.value < 0 || !messagesContainer.value || messageSearchResults.value.length === 0) {
      return;
    }
    
    // Get the message ID from the search results
    const targetMessageId = messageSearchResults.value[currentSearchIndex.value];
    if (!targetMessageId) {
      return;
    }
    
    // Find the message in the messages array
    const currentMessage = messages.value.find(msg => msg.message_id === targetMessageId);
    if (!currentMessage) {
      return;
    }
    
    // Wait for DOM to update
    await nextTick();
    
    // Find the message element - match the ID format used in the template exactly
    // Template uses: message-${message.message_id > 0 ? message.message_id : `opt_${index}_${message.date2}`}
    const messageIndex = filteredMessages.value.indexOf(currentMessage);
    const messageId = currentMessage.message_id > 0 
      ? `message-${currentMessage.message_id}`
      : `message-opt_${messageIndex}_${currentMessage.date2}`;
    
    // Try to find the element with retries and multiple strategies
    let messageElement: HTMLElement | null = null;
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Strategy 1: Try finding by ID globally
      messageElement = document.getElementById(messageId);
      
      // Strategy 2: Try querySelector within the container
      if (!messageElement && messagesContainer.value) {
        messageElement = messagesContainer.value.querySelector(`#${CSS.escape(messageId)}`) as HTMLElement;
      }
      
      // Strategy 3: Try finding by data-message-id attribute
      if (!messageElement && messagesContainer.value) {
        const allMessages = messagesContainer.value.querySelectorAll(`[data-message-id="${currentMessage.message_id}"]`);
        if (allMessages.length > 0) {
          messageElement = allMessages[0] as HTMLElement;
        }
      }
      
      // Strategy 4: Try finding by ID without prefix (in case of escaping issues)
      if (!messageElement) {
        const idOnly = String(currentMessage.message_id);
        messageElement = document.getElementById(idOnly);
        if (!messageElement && messagesContainer.value) {
          messageElement = messagesContainer.value.querySelector(`#${CSS.escape(idOnly)}`) as HTMLElement;
        }
      }
      
      if (messageElement) {
        break;
      }
      
      // Wait before retrying with exponential backoff
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(1.5, attempt)));
      }
    }
    
    if (messageElement && messagesContainer.value) {
      // Ensure element is visible in viewport
      const containerRect = messagesContainer.value.getBoundingClientRect();
      const elementRect = messageElement.getBoundingClientRect();
      
      // Check if element is already visible
      const isVisible = elementRect.top >= containerRect.top && 
                       elementRect.bottom <= containerRect.bottom;
      
      if (!isVisible) {
        // Calculate scroll position relative to the container
        const relativeTop = elementRect.top - containerRect.top;
        const currentScrollTop = messagesContainer.value.scrollTop;
        const targetScrollTop = currentScrollTop + relativeTop - (containerRect.height / 2) + (elementRect.height / 2);
        
        // Scroll the container
        messagesContainer.value.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      }
      
      // Highlight the message briefly
      messageElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'ring-offset-[#1a1a1a]', 'transition-all');
      setTimeout(() => {
        messageElement?.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'ring-offset-[#1a1a1a]', 'transition-all');
      }, 1500);
    } else {
      console.warn(`[useChatMessages] Could not find message element with ID: ${messageId}, message_id: ${currentMessage.message_id}, index: ${messageIndex} after ${maxAttempts} attempts. Available IDs in container:`, 
        messagesContainer.value ? Array.from(messagesContainer.value.querySelectorAll('[id^="message-"]')).map(el => el.id).slice(0, 5) : 'no container');
    }
  }
  
  /**
   * Navigate to next search result
   */
  function navigateToNextResult(): void {
    if (!isSearchActive.value || messageSearchResults.value.length === 0) {
      return;
    }
    
    currentSearchIndex.value = (currentSearchIndex.value + 1) % messageSearchResults.value.length;
    scrollToCurrentResult();
  }
  
  /**
   * Navigate to previous search result
   */
  function navigateToPreviousResult(): void {
    if (!isSearchActive.value || messageSearchResults.value.length === 0) {
      return;
    }
    
    currentSearchIndex.value = currentSearchIndex.value <= 0 
      ? messageSearchResults.value.length - 1 
      : currentSearchIndex.value - 1;
    scrollToCurrentResult();
  }
  
  /**
   * Clear search query and reset state
   */
  function clearSearch(): void {
    messageSearchQuery.value = '';
    messageSearchResults.value = [];
    currentSearchIndex.value = -1;
  }
  
  /**
   * Handle keyboard shortcuts for search navigation
   */
  function handleSearchKeydown(event: KeyboardEvent): void {
    if (!isSearchActive.value) {
      return;
    }
    
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      event.preventDefault();
      navigateToNextResult();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateToPreviousResult();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      clearSearch();
    }
  }
  
  /**
   * Load messages for a chat using the message service
   */
  async function handleLoadMessages(chat: MessengerChatItem): Promise<void> {
    // Store the current chat's group_id to track which chat we're loading
    const currentChatGroupId = chat.group_id;
    
    // Clear messages and reset error when starting a new load
    messages.value = [];
    messageError.value = null;
    
    // Check if this is a first-time load (will need to fetch all messages)
    // If so, show loading spinner and syncing notice
    const hasBeenFetched = await messageStorage.hasChatBeenFetched(chat.group_id);
    const storedMessages = await messageStorage.getMessages(chat.group_id);
    const isFirstTimeLoad = !hasBeenFetched || storedMessages.length === 0;
    
    if (isFirstTimeLoad) {
      isLoadingMessages.value = true;
      isSyncing.value = true; // Show syncing notice while fetching all pages
    }

    try {
      const result = await loadMessages(chat, (updatedMessages) => {
        // Only update messages if we're still loading the same chat
        // This prevents old progress callbacks from updating messages after switching chats
        if (selectedChat.value && selectedChat.value.group_id === currentChatGroupId) {
          messages.value = updatedMessages;
          // If we have messages, we can hide the spinner
          if (updatedMessages.length > 0) {
            isLoadingMessages.value = false;
          }
          // Scroll to bottom after each update
          nextTick().then(() => {
            if (messagesContainer.value) {
              messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
            }
          });
        }
      });
      
      // Only update if we're still on the same chat
      if (selectedChat.value && selectedChat.value.group_id === currentChatGroupId) {
        messages.value = result.messages;
        // Clear blocked status if messages were successfully loaded
        if (result.messages.length > 0 && selectedChat.value.isBlocked) {
          // Clear blocked status in metadata
          await messageStorage.setChatBlocked(selectedChat.value.group_id, false);
          
          const updatedChat = { ...selectedChat.value, isBlocked: false };
          // Update local chat list
          const chatIndex = chatList.value.findIndex(c => c.group_id === selectedChat.value!.group_id);
          if (chatIndex !== -1) {
            chatList.value[chatIndex] = updatedChat;
          }
          selectedChat.value = updatedChat;
          // Refresh filtered chats to update the display
          await updateFilteredChats();
        }
        // Always set loading to false after loadMessages completes
        isLoadingMessages.value = false;
        isSyncing.value = false; // Hide syncing notice when done
        
        // Always scroll to bottom after loading (with multiple attempts for reliability)
        await nextTick();
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
          // Also scroll after a small delay to account for any rendering delays
          setTimeout(() => {
            if (messagesContainer.value) {
              messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
            }
          }, 100);
        }
      } else {
        // Chat was switched, ensure loading state is cleared
        isLoadingMessages.value = false;
        isSyncing.value = false;
      }
    } catch (err) {
      console.error('[useChatMessages] Failed to load messages:', err);
      // Only update error/loading state if we're still on the same chat
      if (selectedChat.value && selectedChat.value.group_id === currentChatGroupId) {
        // Check if this is a blocked chat error
        if (err && typeof err === 'object' && 'isBlockedChat' in err && err.isBlockedChat) {
          // Use the error message from the API (e.g., "Geblokkeerd")
          const blockedError = err as Error & { isBlockedChat: boolean };
          messageError.value = blockedError.message || 'Geblokkeerd';
          console.log('[useChatMessages] Blocked chat error set:', messageError.value);
          
          // Mark chat as blocked in metadata
          if (selectedChat.value) {
            // Store blocked status in chat_metadata (not on chat item)
            await messageStorage.setChatBlocked(selectedChat.value.group_id, true);
            
            // Update local chat list to show blocked status
            const updatedChat = { 
              ...selectedChat.value, 
              isBlocked: true,
            };
            
            const chatIndex = chatList.value.findIndex(c => c.group_id === selectedChat.value!.group_id);
            if (chatIndex !== -1) {
              chatList.value[chatIndex] = updatedChat;
            }
            selectedChat.value = updatedChat;
            // Refresh filtered chats to update the display
            await updateFilteredChats();
          }
        } else {
          messageError.value = 'Failed to load messages';
        }
        isLoadingMessages.value = false;
        isSyncing.value = false;
        messages.value = []; // Ensure messages are cleared when there's an error
      } else {
        // Chat was switched, ensure loading state is cleared
        isLoadingMessages.value = false;
        isSyncing.value = false;
      }
    }
  }
  
  /**
   * Handle message delete
   */
  async function handleDeleteMessage(message: MessengerMessage): Promise<void> {
    if (!selectedChat.value) return;
    
    // Access confirm dialog from global window
    const confirmDialog = (window as any).__sdcBoostConfirm;
    if (!confirmDialog) {
      console.warn('[useChatMessages] Confirm dialog not available');
      return;
    }
    
    // Show confirmation dialog
    const confirmed = await confirmDialog.confirm('Are you sure you want to delete this message?');
    if (!confirmed) {
      return; // User cancelled
    }
    
    try {
      await deleteMessage(selectedChat.value.group_id, message.message_id);
      // Delete from IndexedDB
      await messageStorage.deleteMessage(selectedChat.value.group_id, message.message_id);
      // Refresh messages after deletion
      await refreshLatestPage(selectedChat.value, (updatedMessages) => {
        messages.value = updatedMessages;
      });
    } catch (err) {
      console.error('[useChatMessages] Failed to delete message:', err);
      throw err; // Let caller handle error display
    }
  }
  
  /**
   * Handle message copy
   */
  function handleCopyMessage(message: MessengerMessage): void {
    // Access toast from global window
    const toast = (window as any).__sdcBoostToast;
    
    navigator.clipboard.writeText(message.message).then(() => {
      console.log('[useChatMessages] Message copied to clipboard');
      // Show success toast notification
      if (toast) {
        toast.success('Message copied to clipboard');
      }
    }).catch(err => {
      console.error('[useChatMessages] Failed to copy message:', err);
      if (toast) {
        toast.error('Failed to copy message');
      }
    });
  }
  
  /**
   * Scroll to the quoted message when clicking on a quote
   */
  function scrollToQuotedMessage(quotingMessage: MessengerMessage): void {
    if (!quotingMessage.is_quote || !quotingMessage.q_message || !quotingMessage.q_account_id) return;
    
    const qMessage = quotingMessage.q_message;
    const qAccountId = quotingMessage.q_account_id;
    
    // Find the original quoted message by matching content and account
    const quotedMessage = messages.value.find(msg => {
      // Match by message content and account_id
      const matchesContent = msg.message === qMessage || 
                            (qMessage.length > 0 && msg.message.includes(qMessage.substring(0, Math.min(50, qMessage.length))));
      const matchesAccount = msg.account_id === qAccountId;
      
      // Also check if db_id matches if available
      const matchesDbId = quotingMessage.q_db_id ? msg.db_id === quotingMessage.q_db_id : true;
      
      return matchesContent && matchesAccount && matchesDbId;
    });
    
    if (quotedMessage && messagesContainer.value) {
      // Find the message element by ID (using same pattern as v-for key)
      const messageIndex = messages.value.indexOf(quotedMessage);
      const messageId = quotedMessage.message_id > 0 
        ? `message-${quotedMessage.message_id}`
        : `message-opt_${quotedMessage.extra1 || messageIndex}_${quotedMessage.date2}`;
      
      const messageElement = document.getElementById(messageId);
      
      if (messageElement) {
        // Scroll to the message with smooth behavior
        messageElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Highlight the message briefly with a ring effect
        messageElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'ring-offset-[#1a1a1a]', 'transition-all');
        setTimeout(() => {
          messageElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'ring-offset-[#1a1a1a]', 'transition-all');
        }, 2000);
      } else {
        console.log('[useChatMessages] Could not find message element with ID:', messageId);
      }
    } else {
      console.log('[useChatMessages] Could not find quoted message to scroll to');
    }
  }
  
  // Watch for search query changes to auto-scroll to first result
  watch(messageSearchQueryComputed, async (newQuery) => {
    if (newQuery.trim()) {
      // Wait a bit for messageSearchResults to update
      await nextTick();
      if (messageSearchResults.value.length > 0) {
        currentSearchIndex.value = 0;
        await scrollToCurrentResult();
      } else {
        currentSearchIndex.value = -1;
      }
    } else {
      currentSearchIndex.value = -1;
    }
  });
  
  // Watch messageSearchResults to adjust search index when results change
  watch(messageSearchResults, (newResults) => {
    if (isSearchActive.value) {
      // Adjust index if it's out of bounds
      if (currentSearchIndex.value >= newResults.length) {
        currentSearchIndex.value = newResults.length > 0 ? newResults.length - 1 : -1;
      } else if (currentSearchIndex.value < 0 && newResults.length > 0) {
        currentSearchIndex.value = 0;
      }
    }
  });
  
  return {
    messages,
    isLoadingMessages,
    isSyncing,
    messageError,
    messagesContainer,
    messageSearchQuery,
    messageSearchResults,
    currentSearchIndex,
    messageSearchQueryComputed,
    isSearchActive,
    filteredMessages,
    optimisticMessageTempIds,
    optimisticMessages,
    handleLoadMessages,
    handleDeleteMessage,
    handleCopyMessage,
    scrollToQuotedMessage,
    navigateToNextResult,
    navigateToPreviousResult,
    clearSearch,
    handleSearchKeydown,
    scrollToCurrentResult,
  };
}

