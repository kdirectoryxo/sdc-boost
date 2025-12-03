import { ref, computed, nextTick } from 'vue';
import { createGlobalState } from '@vueuse/core';
import type { MessengerChatItem, MessengerMessage } from '@/lib/sdc-api-types';
import { sendMessage, sendSeenEvent, sendQuotedMessage, sendMessageWithImage } from '@/lib/chat-service';
import { refreshLatestPage } from '@/lib/message-service';
import { getCurrentAccountId, getCurrentDBId } from '@/lib/sdc-api/utils';
import { uploadFiles } from '@/lib/upload-service';
import { chatStorage } from '@/lib/chat-storage';
import { TypingManager } from '@/lib/typing-manager';
import { useChatState } from './useChatState';
import { useChatMessages } from './useChatMessages';
import { getChatKey } from './utils';

export const useChatInput = createGlobalState(() => {
  const { selectedChat, chatList } = useChatState();
  const { 
    messages, 
    messagesContainer, 
    optimisticMessages, 
    optimisticMessageTempIds 
  } = useChatMessages();
  
  const messageInput = ref('');
  const quotedMessageRef = ref<MessengerMessage | null>(null);
  const typingManager = new TypingManager();
  
  // Upload state
  const isUploadDropdownOpen = ref<boolean>(false);
  const uploadedMedia = ref<Array<{ file: File; preview: string; type: 'image' | 'video' }>>([]);
  const isUploading = ref<boolean>(false);
  
  // Computed property for quoted message
  const quotedMessage = computed(() => {
    return quotedMessageRef.value;
  });
  
  /**
   * Handle typing in message input
   */
  function handleMessageInput(chat: MessengerChatItem): void {
    typingManager.handleTyping(chat);
  }
  
  /**
   * Handle message send with optimistic update
   */
  async function handleSendMessage(): Promise<void> {
    if (!selectedChat.value) {
      return;
    }

    // Allow sending if there's text OR uploaded media
    if (!messageInput.value.trim() && uploadedMedia.value.length === 0) {
      return;
    }

    const messageText = messageInput.value.trim();
    const quotedMessage = quotedMessageRef.value;
    const accountId = getCurrentAccountId();
    const dbId = getCurrentDBId();
    
    if (!accountId || !dbId) {
      console.warn('[useChatInput] Cannot send message - missing user info');
      return;
    }

    // If there's uploaded media, upload it first
    let imageIds: string[] = [];
    if (uploadedMedia.value.length > 0) {
      isUploading.value = true;
      try {
        const targetId = String(selectedChat.value.db_id);
        const groupId = String(selectedChat.value.group_id);
        
        // Get all files
        const files = uploadedMedia.value.map(m => m.file);
        imageIds = await uploadFiles(files, targetId, groupId);
      } catch (error: any) {
        console.error('[useChatInput] Failed to upload media:', error);
        isUploading.value = false;
        const toast = (window as any).__sdcBoostToast;
        if (toast) {
          // Show the API error message if available, otherwise show generic error
          const errorMessage = error?.message || 'Failed to upload media. Please try again.';
          
          // Translate common Dutch error messages
          let translatedMessage = errorMessage;
          if (errorMessage.includes('Je moet berichten met de gebruiker hebben uitgewisseld')) {
            translatedMessage = 'You must have exchanged messages with this user before you can send an image or video.';
          }
          
          toast.error(translatedMessage);
        }
        // Clear uploaded media on error so user can try again
        uploadedMedia.value = [];
        return;
      }
      isUploading.value = false;
    }

    // Generate tempId for optimistic message
    const tempId = crypto.randomUUID();
    const now = new Date();
    const date2 = Math.floor(now.getTime() / 1000);

    // Format message: if imageIds exist, use [6|{image_id1,image_id2}-|-{text}] format, otherwise use text
    const finalMessage = imageIds.length > 0 
      ? `[6|${imageIds.join(',')}-|-${messageText || ''}]` 
      : messageText;

    // Create optimistic message with tempId stored in extra1 (we'll use it for tracking)
    const optimisticMessage: MessengerMessage = {
      message: finalMessage,
      url_videos: '',
      message_id: 0, // Will be replaced when real message arrives
      share_data: null,
      share_biz_list: [],
      message_type: null,
      seen: 0, // Start as sent (0), will update to seen (1) when confirmed
      sender: 0, // Current user
      gender1: 0,
      gender2: 0,
      date: now.toLocaleString('en-US', { 
        month: 'short', 
        day: '2-digit', 
        year: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit' 
      }),
      account_id: accountId,
      date2: date2,
      db_id: parseInt(dbId),
      extra1: `__tempId:${tempId}__`, // Store tempId in extra1 for tracking
      forward: 0,
      forward_extra_text: '',
      forward_db_id: 0,
      is_quote: quotedMessage ? 1 : 0,
      q_message: quotedMessage?.message || '',
      q_account_id: quotedMessage?.account_id || '',
      q_db_id: quotedMessage?.db_id || 0,
      qgender1: quotedMessage?.gender1 || 0,
      qgender2: quotedMessage?.gender2 || 0,
      is_lt_offer: 0,
    };

    // Optimistically update chat list - move chat to top and update last_message
    if (selectedChat.value) {
      const chatIndex = chatList.value.findIndex(c => getChatKey(c) === getChatKey(selectedChat.value));
      if (chatIndex !== -1) {
        const updatedChat: MessengerChatItem = {
          ...selectedChat.value,
          last_message: finalMessage,
          date_time: now.toISOString(),
          date: optimisticMessage.date,
          unread_counter: 0, // Reset unread counter for own messages
        };
        // Remove from current position and add to top
        chatList.value.splice(chatIndex, 1);
        chatList.value.unshift(updatedChat);
        selectedChat.value = updatedChat;
        
        // Update in storage optimistically
        chatStorage.updateChat(updatedChat).catch(console.error);
      }
    }

    // Add optimistic message to UI immediately
    messages.value = [...messages.value, optimisticMessage];
    optimisticMessages.value.set(tempId, optimisticMessage);
    optimisticMessageTempIds.value.set(tempId, finalMessage);
    
    // Scroll to bottom to show new message
    await nextTick();
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }

    // Clear input, quoted message, and uploaded media
    messageInput.value = '';
    quotedMessageRef.value = null;
    uploadedMedia.value = [];
    
    // Stop typing indicator
    typingManager.stopTyping();

    // Send message via WebSocket (pass tempId so it can be tracked)
    let success = false;
    if (imageIds.length > 0) {
      // Send message with images (comma-separated)
      const imageIdString = imageIds.join(',');
      success = sendMessageWithImage(selectedChat.value, messageText, imageIdString, quotedMessage || undefined);
    } else if (quotedMessage) {
      success = sendQuotedMessage(selectedChat.value, messageText, quotedMessage);
    } else {
      success = sendMessage(selectedChat.value, messageText);
    }

    if (!success) {
      // Failed to send - remove optimistic message and revert chat update
      messages.value = messages.value.filter(msg => {
        const msgTempId = msg.extra1?.match(/__tempId:(.+?)__/)?.[1];
        return msgTempId !== tempId;
      });
      optimisticMessages.value.delete(tempId);
      optimisticMessageTempIds.value.delete(tempId);
      
      throw new Error('Failed to send message');
    } else {
      // Refetch latest page after a short delay to get the real message
      // This is a fallback in case WebSocket event doesn't come through immediately
      setTimeout(async () => {
        if (optimisticMessages.value.has(tempId) && selectedChat.value) {
          await refreshLatestPage(selectedChat.value, (updatedMessages) => {
            // Check if we got a real message that matches our optimistic one
            // Match by: same message content, same sender (0 = current user), and timestamp within 30 seconds
            const matchingRealMessage = updatedMessages.find(real => 
              real.message === messageText &&
              real.sender === 0 &&
              Math.abs(real.date2 - date2) < 30 // Increased window to 30 seconds
            );
            
            if (matchingRealMessage) {
              console.log(`[useChatInput] Fallback matched optimistic message ${tempId} with real message ${matchingRealMessage.message_id}`);
              
              // Replace optimistic message with real one
              messages.value = messages.value.filter(msg => {
                const msgTempId = msg.extra1?.match(/__tempId:(.+?)__/)?.[1];
                return msgTempId !== tempId;
              });
              
              // Add real message if not already present
              const hasRealMessage = messages.value.some(m => m.message_id === matchingRealMessage.message_id);
              if (!hasRealMessage) {
                messages.value.push(matchingRealMessage);
                messages.value.sort((a, b) => a.date2 - b.date2);
              }
              
              // Clean up tracking
              optimisticMessages.value.delete(tempId);
              optimisticMessageTempIds.value.delete(tempId);
              
              // Scroll to bottom
              nextTick().then(() => {
                if (messagesContainer.value) {
                  messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
                }
              });
            } else {
              // Still no match - try again after another delay
              console.log(`[useChatInput] Optimistic message ${tempId} not matched yet, will retry...`);
            }
          }).catch(console.error);
        }
      }, 2000); // Wait 2 seconds for WebSocket, then fallback to API
      
      // Set up timeout to clean up optimistic message if it's not replaced within 30 seconds
      setTimeout(() => {
        if (optimisticMessages.value.has(tempId)) {
          console.warn(`[useChatInput] Optimistic message ${tempId} not replaced after 30s, cleaning up`);
          messages.value = messages.value.filter(msg => {
            const msgTempId = msg.extra1?.match(/__tempId:(.+?)__/)?.[1];
            return msgTempId !== tempId;
          });
          optimisticMessages.value.delete(tempId);
          optimisticMessageTempIds.value.delete(tempId);
        }
      }, 30000); // 30 second timeout
    }
  }
  
  /**
   * Handle message quote
   */
  function handleQuoteMessage(message: MessengerMessage): void {
    if (!selectedChat.value) return;
    
    // Store the quoted message in ref
    quotedMessageRef.value = message;
    
    // Scroll to bottom when quoting a message
    nextTick().then(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
      
      // Focus the input
      const input = document.querySelector('input[placeholder="Type a message..."]') as HTMLInputElement;
      if (input) {
        input.focus();
      }
    });
  }
  
  /**
   * Cancel quoted message
   */
  function cancelQuote(): void {
    quotedMessageRef.value = null;
  }
  
  /**
   * Handle file selection for images
   */
  function handleImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      // Filter only image files
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      
      if (imageFiles.length === 0) {
        if (input) {
          input.value = '';
        }
        return;
      }
      
      const newMedia: Array<{ file: File; preview: string; type: 'image' | 'video' }> = [];
      let loadedCount = 0;
      const totalFiles = imageFiles.length;
      
      imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newMedia.push({
            file,
            preview: e.target?.result as string,
            type: 'image'
          });
          loadedCount++;
          // When all files are loaded, update the state
          if (loadedCount === totalFiles) {
            uploadedMedia.value = [...uploadedMedia.value, ...newMedia];
            isUploadDropdownOpen.value = false;
          }
        };
        reader.onerror = () => {
          console.error('[useChatInput] Failed to read file:', file.name);
          loadedCount++;
          if (loadedCount === totalFiles) {
            // Still update with successfully loaded files
            uploadedMedia.value = [...uploadedMedia.value, ...newMedia];
            isUploadDropdownOpen.value = false;
          }
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset input so same file can be selected again
    if (input) {
      input.value = '';
    }
  }
  
  /**
   * Handle file selection for videos
   */
  function handleVideoSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      // Filter only video files
      const videoFiles = Array.from(files).filter(file => file.type.startsWith('video/'));
      
      if (videoFiles.length === 0) {
        if (input) {
          input.value = '';
        }
        return;
      }
      
      const newMedia: Array<{ file: File; preview: string; type: 'image' | 'video' }> = [];
      let loadedCount = 0;
      const totalFiles = videoFiles.length;
      
      videoFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newMedia.push({
            file,
            preview: e.target?.result as string,
            type: 'video'
          });
          loadedCount++;
          // When all files are loaded, update the state
          if (loadedCount === totalFiles) {
            uploadedMedia.value = [...uploadedMedia.value, ...newMedia];
            isUploadDropdownOpen.value = false;
          }
        };
        reader.onerror = () => {
          console.error('[useChatInput] Failed to read file:', file.name);
          loadedCount++;
          if (loadedCount === totalFiles) {
            // Still update with successfully loaded files
            uploadedMedia.value = [...uploadedMedia.value, ...newMedia];
            isUploadDropdownOpen.value = false;
          }
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset input so same file can be selected again
    if (input) {
      input.value = '';
    }
  }
  
  /**
   * Trigger photo file picker (supports multiple selection)
   * This will open the native file picker which on iOS/macOS shows options like:
   * "Foto's bibliotheek", "Maak foto", "Kies bestanden"
   */
  function triggerPhotoPicker(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true; // Allow multiple selection
    input.capture = 'environment'; // This enables camera option on mobile
    input.onchange = handleImageSelect;
    input.click();
  }
  
  /**
   * Trigger video file picker (supports multiple selection)
   */
  function triggerVideoPicker(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.multiple = true; // Allow multiple selection
    input.capture = 'environment'; // This enables camera option on mobile
    input.onchange = handleVideoSelect;
    input.click();
  }
  
  /**
   * Remove uploaded media at index
   */
  function removeUploadedMedia(index: number): void {
    uploadedMedia.value.splice(index, 1);
  }
  
  /**
   * Clear all uploaded media
   */
  function clearUploadedMedia(): void {
    uploadedMedia.value = [];
  }
  
  return {
    messageInput,
    quotedMessage,
    quotedMessageRef,
    isUploadDropdownOpen,
    uploadedMedia,
    isUploading,
    typingManager,
    handleMessageInput,
    handleSendMessage,
    handleQuoteMessage,
    cancelQuote,
    handleImageSelect,
    handleVideoSelect,
    triggerPhotoPicker,
    triggerVideoPicker,
    removeUploadedMedia,
    clearUploadedMedia,
  };
});

