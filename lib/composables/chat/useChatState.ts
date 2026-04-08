import { ref, computed, watch } from 'vue';
import { createGlobalState } from '@vueuse/core';
import type { MessengerChatItem, MessengerFolder } from '@/lib/sdc-api-types';
import { useLiveQuery } from '@/lib/composables/useLiveQuery';
import { db } from '@/lib/db';
import { normalizeMessengerFolder } from '@/lib/folder-storage';
import { tagChangeTrigger } from '@/lib/sdc-db/tag-change-trigger';
import { useSDCDatabaseStore } from '@/lib/sdc-db/store';

/**
 * Global chat state that persists across component instances
 */
export const useChatState = createGlobalState(() => {
  const { isReady: dbIsReady } = useSDCDatabaseStore();
  
  // Reactive chat list from database
  // Include tagChangeTrigger and dbIsReady in dependencies to react to tag changes and DB readiness
  const chatList = useLiveQuery(async () => {
    // Access tagChangeTrigger and dbIsReady to make them dependencies
    const _trigger = tagChangeTrigger.value;
    const _dbReady = dbIsReady.value;
    
    const chats = await db.chats.toArray();
    const allMetadata = await db.chat_metadata.toArray();
    const metadataMap = new Map<number, { isBlocked?: boolean; isArchived?: boolean }>();
    allMetadata.forEach((m) => {
      metadataMap.set(m.group_id, { 
        isBlocked: m.isBlocked, 
        isArchived: m.isArchived,
      });
    });
    
    // Load tags from SDC database for all chats
    let tagsMap = new Map<number, import('@/lib/db').ChatTag[]>();
    
    // Only load tags if database is ready
    if (dbIsReady.value) {
      try {
        const { getTagsForChat } = await import('@/lib/sdc-db/tags');
        
        // Load tags for each chat
        for (const chat of chats) {
          const tags = getTagsForChat(chat.group_id);
          if (tags.length > 0) {
            tagsMap.set(chat.group_id, tags.map(t => ({
              text: t.text,
              color: t.color,
            })));
          }
        }
      } catch (err) {
        console.warn('[useChatState] Failed to load tags from SDC database:', err);
      }
    }
    
    // Merge metadata and tags into chats
    return chats.map((item) => {
      const { id, ...chat } = item;
      const metadata = metadataMap.get(chat.group_id);
      const tags = tagsMap.get(chat.group_id);
      return {
        ...chat,
        ...(metadata?.isBlocked ? { isBlocked: true } : {}),
        ...(metadata?.isArchived ? { isArchived: true } : {}),
        ...(tags ? { tags } : {}),
      } as MessengerChatItem & { tags?: import('@/lib/db').ChatTag[] };
    });
  }, [tagChangeTrigger, dbIsReady]);

  // Reactive folders from database
  const folders = useLiveQuery(() => db.folders.toArray(), []);

  const selectedChat = ref<MessengerChatItem | null>(null);
  const selectedFolderId = ref<number | null>(null); // null = all chats, 0 = inbox (no folder), number = specific folder, -1 = archives
  const showArchives = ref<boolean>(false);
  
  // Sync selectedChat with updated chatList when tags change
  watch(() => chatList.value, (newChatList) => {
    if (!newChatList || !Array.isArray(newChatList) || !selectedChat.value) return;
    
    const updatedChat = newChatList.find(
      chat => chat.group_id === selectedChat.value!.group_id
    );
    if (updatedChat) {
      selectedChat.value = updatedChat;
    }
  }, { immediate: false });
  
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
  
  /**
   * Find chat by user ID (db_id) - used when opening chat from profile page
   */
  function findChatByUserId(userId: string): MessengerChatItem | null {
    const chats = chatList.value || [];
    return chats.find(chat => String(chat.db_id) === userId) || null;
  }
  
  return {
    chatList: computed(() => chatList.value || []),
    folders: computed(() =>
      (folders.value || []).map((f) => normalizeMessengerFolder(f))
    ),
    selectedChat,
    selectedFolderId,
    showArchives,
    urlSearchParams,
    updateURLSearchParams,
    updateChatInURL,
    getChatIdFromURL,
    findChatByGroupId,
    findChatByUserId,
  };
});


