import { ref, computed } from 'vue';
import { createGlobalState } from '@vueuse/core';
import type { MessengerChatItem, MessengerFolder } from '@/lib/sdc-api-types';
import { useLiveQuery } from '@/lib/composables/useLiveQuery';
import { db } from '@/lib/db';

/**
 * Global chat state that persists across component instances
 */
export const useChatState = createGlobalState(() => {
  // Reactive chat list from database
  const chatList = useLiveQuery(async () => {
    const chats = await db.chats.toArray();
    const allMetadata = await db.chat_metadata.toArray();
    const metadataMap = new Map<number, { isBlocked?: boolean; isArchived?: boolean }>();
    allMetadata.forEach((m) => {
      metadataMap.set(m.group_id, { 
        isBlocked: m.isBlocked, 
        isArchived: m.isArchived 
      });
    });
    
    // Merge metadata into chats
    return chats.map((item) => {
      const { id, ...chat } = item;
      const metadata = metadataMap.get(chat.group_id);
      return {
        ...chat,
        ...(metadata?.isBlocked ? { isBlocked: true } : {}),
        ...(metadata?.isArchived ? { isArchived: true } : {}),
      } as MessengerChatItem;
    });
  }, []);

  // Reactive folders from database
  const folders = useLiveQuery(() => db.folders.toArray(), []);

  const selectedChat = ref<MessengerChatItem | null>(null);
  const selectedFolderId = ref<number | null>(null); // null = all chats, 0 = inbox (no folder), number = specific folder, -1 = archives
  const showArchives = ref<boolean>(false);
  
  // URL state management
  const urlSearchParams = ref(window.location.search);
  
  /**
   * Update URL search params ref when URL changes
   */
  function updateURLSearchParams() {
    urlSearchParams.value = window.location.search;
  }
  
  /**
   * Update URL with current chat selection
   */
  function updateChatInURL(chat: MessengerChatItem | null) {
    const url = new URL(window.location.href);
    if (chat) {
      // Use group_id as the identifier (works for both regular chats and broadcasts)
      const chatId = String(chat.group_id);
      url.searchParams.set('chatId', chatId);
    } else {
      url.searchParams.delete('chatId');
    }
    window.history.replaceState({}, '', url.toString());
    // Update the reactive ref to trigger watchers
    updateURLSearchParams();
  }
  
  /**
   * Read chat ID from URL and find matching chat
   */
  function getChatIdFromURL(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('chatId');
  }
  
  /**
   * Find chat by group_id
   */
  function findChatByGroupId(groupId: string): MessengerChatItem | null {
    const chats = chatList.value || [];
    return chats.find(chat => String(chat.group_id) === groupId) || null;
  }
  
  return {
    chatList: computed(() => chatList.value || []),
    folders: computed(() => folders.value || []),
    selectedChat,
    selectedFolderId,
    showArchives,
    urlSearchParams,
    updateURLSearchParams,
    updateChatInURL,
    getChatIdFromURL,
    findChatByGroupId,
  };
});


