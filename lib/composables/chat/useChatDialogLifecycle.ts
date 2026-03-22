import { watch, onMounted, onUnmounted, nextTick, type Ref } from 'vue';
import { useChatState } from './useChatState';
import { useChatFolders } from './useChatFolders';
import { useChatFilters } from './useChatFilters';
import { useChatSync } from './useChatSync';
import { useChatWebSocket } from './useChatWebSocket';
import { useChatMessages } from './useChatMessages';
import { useChatSelection } from './useChatSelection';
import { useSDCDatabaseStore } from '@/lib/sdc-db/store';
import { startChat } from '@/lib/sdc-api/messenger';
import { chatStorage } from '@/lib/chat-storage';
import type { MessengerChatItem } from '@/lib/sdc-api-types';

/** Run after first paint, then in an idle slice so sync work does not extend the mount jank window. */
function scheduleAfterPaintAndIdle(fn: () => void): void {
  requestAnimationFrame(() => {
    const ric = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : null;
    if (ric) {
      ric(fn, { timeout: 1500 });
    } else {
      setTimeout(fn, 0);
    }
  });
}

/**
 * Composable for managing chat surface lifecycle (open/close, URL watching, mounting).
 * @param isActive - When false, WebSocket cleanup runs; use `modelValue` for overlay or `ref(true)` for hub page while mounted.
 */
export function useChatDialogLifecycle(
  isActive: Ref<boolean>,
  onClose?: () => void
) {
  const { 
    chatList, 
    selectedChat, 
    urlSearchParams, 
    updateURLSearchParams,
    getChatIdFromURL,
    findChatByGroupId,
    findChatByUserId 
  } = useChatState();
  const { fetchFolders } = useChatFolders();
  const { 
    isLoading, 
    isInitialLoad, 
    fetchAllChats 
  } = useChatSync();
  const { setupEventListeners, cleanupEventListeners } = useChatWebSocket();
  const { messages, clearSearch } = useChatMessages();
  const { handleChatClick, openChatFromURL } = useChatSelection();
  const dbStore = useSDCDatabaseStore();

  /**
   * Inject lightbox z-index override styles
   */
  function injectLightboxStyles() {
    const styleId = 'sdc-lightbox-z-index-override';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        body .vel-modal {
          z-index: 10000000 !important;
          pointer-events: auto !important;
        }
        body .vel-modal-mask {
          pointer-events: auto !important;
          z-index: 10000000 !important;
        }
        body .v-popper__popper {
          z-index: 10000000 !important;
        }
        body .v-popper__inner {
          z-index: 10000000 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Helper function to find or create chat by ID (group_id or user_id)
   */
  async function findOrCreateChat(chatIdFromURL: string): Promise<MessengerChatItem | null> {
    // Try finding by group_id first (normal chat selection)
    let chat = findChatByGroupId(chatIdFromURL);
    
    // Fallback: try finding by user ID (from profile button)
    if (!chat) {
      console.log('[ChatDialogLifecycle] Chat not found by group_id, trying by user ID...');
      chat = findChatByUserId(chatIdFromURL);
    }
    
    // If still not found, start a new chat via API
    if (!chat) {
      console.log('[ChatDialogLifecycle] Chat not found by user ID either, starting new chat...');
      try {
        const userId = Number(chatIdFromURL);
        if (!isNaN(userId) && userId > 0) {
          const response = await startChat(userId);
          if (response.info && response.info.group_id) {
            // Create a minimal chat item from the API response
            const newChat: MessengerChatItem = {
              db_id: userId,
              group_id: response.info.group_id,
              account_id: response.info.account_id || '',
              gender1: response.info.gender1 || 0,
              gender2: response.info.gender2 || 0,
              profile_type: response.info.profile_type || 0,
              unread_counter: 0,
              last_message: '',
              message_status: 0,
              date: new Date().toISOString(),
              date_time: new Date().toISOString(),
              start_chat: 1,
              primary_photo: response.info.primary_photo || '',
              muted: null,
              pin_chat: 0,
              time_elapsed: '',
              isFriend: false,
              online: response.info.online || 0,
              group_type: 0,
              blocked_profile: 0,
              extra1: '',
            };
            
            // Store in database
            await chatStorage.upsertChats([newChat]);
            console.log('[ChatDialogLifecycle] New chat created and stored:', newChat.group_id);
            
            chat = newChat;
          }
        }
      } catch (error) {
        console.error('[ChatDialogLifecycle] Failed to start new chat:', error);
      }
    }
    
    return chat;
  }

  /**
   * Initialize dialog when it opens
   */
  async function initializeDialog() {
    isInitialLoad.value = true;

    // Load tags/settings from the profile note in the background. Chat list + messages use Dexie
    // directly; blocking here delayed the whole Hub chat surface on network + decode.
    void dbStore.initialize().catch((error) => {
      console.error('[ChatDialogLifecycle] Failed to initialize database:', error);
    });

    const chatIdFromURL = getChatIdFromURL();

    // Setup WebSocket listeners early (do not await nextTick here: that waited for the entire
    // ChatWorkspace first render — hundreds of ms with a large chat list — before sync could start.)
    setupEventListeners();

    // If we have a chat ID in URL, try to open it IMMEDIATELY from cache
    // Don't wait for sync - the chat is likely already in IndexedDB
    if (chatIdFromURL) {
      await nextTick();
      console.log('[ChatDialogLifecycle] Trying to open chat immediately from cache...');
      const chat = await findOrCreateChat(chatIdFromURL);
      
      if (chat) {
        await nextTick();
        await openChatFromURL(chat);
        console.log('[ChatDialogLifecycle] Chat opened from cache, syncing in background...');
      }
    }
    
    // Cached chats already render from Dexie via live queries; full API sync can wait for idle.
    scheduleAfterPaintAndIdle(() => {
      fetchFolders().catch(err => console.error('[ChatDialogLifecycle] Failed to fetch folders:', err));
      fetchAllChats()
        .then(() => {
          isInitialLoad.value = false;
        })
        .catch(err => console.error('[ChatDialogLifecycle] Failed to sync chats:', err));
    });
    
    // If no chat ID was in URL, mark as loaded after a short delay
    // (to show loading state briefly while background sync starts)
    if (!chatIdFromURL) {
      setTimeout(() => {
        if (isInitialLoad.value) {
          isInitialLoad.value = false;
        }
      }, 500);
    }
  }

  /**
   * Cleanup when dialog closes
   */
  function cleanupDialog() {
    cleanupEventListeners();
    isInitialLoad.value = true;
  }

  // Watch for URL changes to update selected chat
  watch(urlSearchParams, async () => {
    if (isActive.value && chatList.value.length > 0) {
      const chatIdFromURL = getChatIdFromURL();
      const currentChatId = selectedChat.value ? String(selectedChat.value.group_id) : null;
      
      if (chatIdFromURL !== currentChatId) {
        if (chatIdFromURL) {
          const chat = await findOrCreateChat(chatIdFromURL);
          
          if (chat) {
            await nextTick();
            await handleChatClick(chat);
          }
        } else if (selectedChat.value) {
          selectedChat.value = null;
          // Messages will update reactively when selectedChat changes
        }
      }
    }
  }, { immediate: false });

  // Watch for active changes to fetch data when surface opens
  watch(
    () => isActive.value,
    (newValue) => {
      if (newValue) {
        void initializeDialog().catch((err) =>
          console.error('[ChatDialogLifecycle] initializeDialog failed:', err)
        );
      } else {
        cleanupDialog();
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    injectLightboxStyles();
    window.addEventListener('popstate', updateURLSearchParams);
    // Do not call initializeDialog() here: watch(isActive, { immediate: true }) already runs
    // it when active is true, and running both caused duplicate DB init, duplicate WebSocket
    // setup, and duplicate "open chat from cache" on the Hub chat page.
  });

  onUnmounted(() => {
    cleanupEventListeners();
    window.removeEventListener('popstate', updateURLSearchParams);
  });

  return {
    initializeDialog,
    cleanupDialog,
  };
}

