import { watch, onMounted, onUnmounted, nextTick, type Ref } from 'vue';
import { useChatState } from './useChatState';
import { useChatFolders } from './useChatFolders';
import { useChatFilters } from './useChatFilters';
import { useChatSync } from './useChatSync';
import { useChatWebSocket } from './useChatWebSocket';
import { useChatMessages } from './useChatMessages';
import { useChatSelection } from './useChatSelection';

/**
 * Composable for managing ChatDialog lifecycle (open/close, URL watching, mounting)
 */
export function useChatDialogLifecycle(
  modelValue: Ref<boolean>,
  onClose?: () => void
) {
  const { 
    chatList, 
    selectedChat, 
    urlSearchParams, 
    updateURLSearchParams,
    getChatIdFromURL,
    findChatByGroupId 
  } = useChatState();
  const { loadFoldersFromStorage, fetchFolders } = useChatFolders();
  const { updateFilteredChats } = useChatFilters();
  const { 
    isLoading, 
    isInitialLoad, 
    loadChatsFromStorage, 
    fetchAllChats 
  } = useChatSync();
  const { setupEventListeners, cleanupEventListeners } = useChatWebSocket();
  const { messages, clearSearch } = useChatMessages();
  const { handleChatClick, openChatFromURL } = useChatSelection();

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
   * Initialize dialog when it opens
   */
  async function initializeDialog() {
    isInitialLoad.value = true;
    
    const chatIdFromURL = getChatIdFromURL();
    
    await loadChatsFromStorage();
    await loadFoldersFromStorage();
    await updateFilteredChats();
    await fetchFolders();
    await fetchAllChats();
    
    isInitialLoad.value = false;
    
    setupEventListeners();
    
    if (chatIdFromURL) {
      const chat = findChatByGroupId(chatIdFromURL);
      if (chat) {
        await nextTick();
        await openChatFromURL(chat);
      }
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
    if (modelValue.value && chatList.value.length > 0) {
      const chatIdFromURL = getChatIdFromURL();
      const currentChatId = selectedChat.value ? String(selectedChat.value.group_id) : null;
      
      if (chatIdFromURL !== currentChatId) {
        if (chatIdFromURL) {
          const chat = findChatByGroupId(chatIdFromURL);
          if (chat) {
            await nextTick();
            await handleChatClick(chat);
          }
        } else if (selectedChat.value) {
          selectedChat.value = null;
          messages.value = [];
        }
      }
    }
  }, { immediate: false });

  // Watch for modelValue changes to fetch data when dialog opens
  watch(() => modelValue.value, async (newValue) => {
    if (newValue) {
      await initializeDialog();
    } else {
      cleanupDialog();
    }
  }, { immediate: true });

  onMounted(async () => {
    injectLightboxStyles();
    window.addEventListener('popstate', updateURLSearchParams);
    
    if (modelValue.value) {
      await initializeDialog();
    }
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

