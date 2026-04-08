<script lang="ts" setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import type { MessengerChatItem, ProfileUser, MessengerMessage, MessengerGroupUser, MessengerGroupAdmin } from '@/lib/sdc-api-types';
import { chatWithAI } from '@/lib/ai-chat-service';
import { profileStorage } from '@/lib/profile-storage';
import { messageStorage } from '@/lib/message-storage';
import { getMessengerGroupInfo, getMessengerGroupChatDetails } from '@/lib/sdc-api/messenger';
import { marked } from 'marked';
import { parseImageMessage, parseVideoMessage, parseGalleryMessage } from '@/lib/composables/chat/utils';
import {
  Dialog,
  DialogContent,
} from '@/lib/view-router/ui/dialog';
import { cn } from '@/lib/utils';
import {
  CHAT_NESTED_DIALOG_OVERLAY_CLASS,
  CHAT_NESTED_DIALOG_CONTENT_CLASS,
} from '@/lib/chat-ui/nested-dialog-classes';

/** Tailwind for v-html markdown: prose-like defaults without a scoped style block */
const AI_MESSAGE_VHTML_CLASS = cn(
  'break-words min-w-0 mb-0 pb-0',
  '[&_*:last-child]:!mb-0 [&_*:last-child]:!pb-0',
  '[&_p]:block [&_p]:mt-0 [&_p]:mb-[0.5em] [&_p]:p-0 [&_p]:leading-[1.3]',
  '[&_p:last-child]:leading-[1.2] [&_p:last-child]:!mb-0 [&_p:last-child]:!pb-0',
  '[&_p:only-child]:!mb-0 [&_p:only-child]:!pb-0',
  '[&_strong]:font-semibold [&_strong]:text-inherit',
  '[&_em]:italic',
  '[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mt-1 [&_ul]:mb-2 [&_ul]:pl-3',
  '[&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:mt-1 [&_ol]:mb-2 [&_ol]:pl-3',
  '[&_li]:mb-[0.2em] [&_li]:leading-[1.4] [&_li:last-child]:mb-0',
  '[&_li>p]:mb-[0.2em] [&_li>p:last-child]:mb-0',
  '[&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:font-semibold [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:mt-[1em] [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:mb-[0.5em] [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:leading-[1.3]',
  '[&_h1]:text-[1.5em] [&_h2]:text-[1.3em] [&_h3]:text-[1.1em]',
  '[&_code]:rounded [&_code]:bg-white/10 [&_code]:px-[0.4em] [&_code]:py-[0.2em] [&_code]:font-mono [&_code]:text-[0.9em]',
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/30 [&_pre]:p-4',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_blockquote]:my-3 [&_blockquote]:border-l-[3px] [&_blockquote]:border-white/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-white/80',
  '[&_a]:text-blue-400 [&_a]:underline [&_a:hover]:text-blue-300',
  '[&_hr]:my-4 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-white/20',
  '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse',
  '[&_th]:border [&_th]:border-white/20 [&_th]:p-2 [&_th]:text-left [&_th]:bg-white/5 [&_th]:font-semibold',
  '[&_td]:border [&_td]:border-white/20 [&_td]:p-2 [&_td]:text-left',
);

interface Props {
  visible: boolean;
  selectedChat: MessengerChatItem | null;
  focusedMessage?: MessengerMessage | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SessionConversation {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  messages: ChatMessage[];
}

const messages = ref<ChatMessage[]>([]);
const inputMessage = ref('');
const isLoading = ref(false);
const error = ref<string | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);
const profileData = ref<ProfileUser | null>(null);
const chatMessages = ref<MessengerMessage[]>([]);
const conversationHistory = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

// Group chat support
const isGroupChat = computed(() => {
  if (!props.selectedChat) return false;
  return props.selectedChat.group_type === 1;
});

const groupInfo = ref<{ name: string; users: MessengerGroupUser[]; admins: MessengerGroupAdmin[] } | null>(null);

// Computed for focused message
const focusedMessage = computed(() => props.focusedMessage);

// Helper function to convert group_id (string or number) to number for storage
// For string group_ids, we hash them to a number
function getGroupIdForStorage(groupId: number | string): number {
  if (typeof groupId === 'number') {
    return groupId;
  }
  // Hash string to number (simple hash function)
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    const char = groupId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Session storage for conversations per chat (using string keys to support both number and string group_ids)
const sessionConversations = ref<Map<string, SessionConversation>>(new Map());

// Track current chat group_id to detect chat switches (can be number or string)
const currentGroupId = ref<number | string | null>(null);

// Edit mode state
const editingMessageIndex = ref<number | null>(null);
const editingMessageText = ref('');

// Abort controller for canceling AI requests
const abortController = ref<AbortController | null>(null);

// Save conversation to session storage
function saveConversationToSession(groupId: number | string) {
  const key = String(groupId);
  sessionConversations.value.set(key, {
    history: [...conversationHistory.value],
    messages: [...messages.value],
  });
}

// Load conversation from session storage
function loadConversationFromSession(groupId: number | string): boolean {
  const key = String(groupId);
  const saved = sessionConversations.value.get(key);
  if (saved) {
    conversationHistory.value = [...saved.history];
    messages.value = [...saved.messages];
    return true;
  }
  return false;
}

// Load profile and messages when dialog opens
watch([() => props.visible, () => props.selectedChat], async ([visible, chat]) => {
  if (visible && chat && !chat.broadcast && chat.type !== 100 && (chat.db_id > 0 || isGroupChat.value)) {
    // Abort any ongoing request when switching chats
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
      isLoading.value = false;
    }
    
    // Save current conversation before switching
    if (currentGroupId.value !== null && currentGroupId.value !== chat.group_id) {
      saveConversationToSession(currentGroupId.value);
    }
    
    // Reset conversation if switching to a different chat
    if (currentGroupId.value !== null && currentGroupId.value !== chat.group_id) {
      conversationHistory.value = [];
      messages.value = [];
    }
    
    currentGroupId.value = chat.group_id;
    
    // Try to load conversation from session, otherwise load data
    const hasSession = loadConversationFromSession(chat.group_id);
    if (!hasSession) {
      await loadData();
    } else {
      // Still need to load profile and chat messages for AI context
      await loadData();
    }
  } else if (!visible) {
    // Abort any ongoing request when closing
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
      isLoading.value = false;
    }
    
    // Save conversation to session before closing
    if (currentGroupId.value !== null) {
      saveConversationToSession(currentGroupId.value);
    }
    
    // Reset UI state when closing (but keep conversation in session)
    inputMessage.value = '';
    error.value = null;
    profileData.value = null;
    groupInfo.value = null;
    chatMessages.value = [];
    editingMessageIndex.value = null;
    editingMessageText.value = '';
    // Don't reset conversationHistory and messages - they're saved in session
  }
}, { immediate: true });

async function loadData() {
  if (!props.selectedChat) return;
  
  try {
    // Check if messages have been synced
    const storageGroupId = getGroupIdForStorage(props.selectedChat.group_id);
    const hasBeenFetched = await messageStorage.hasChatBeenFetched(storageGroupId);
    if (!hasBeenFetched) {
      error.value = 'Chat messages not synced. Please sync messages for this chat first via the sync dialog.';
      return;
    }
    
    // Load chat messages
    const msgs = await messageStorage.getMessages(storageGroupId);
    chatMessages.value = msgs;
    
    // Handle group chats vs individual chats
    if (isGroupChat.value) {
      // For group chats, fetch group info
      const groupId = typeof props.selectedChat.group_id === 'string' 
        ? props.selectedChat.group_id 
        : String(props.selectedChat.group_id);
      
      // First, fetch group chat details to get target_db_id
      const chatDetailsResponse = await getMessengerGroupChatDetails(groupId);
      
      if (chatDetailsResponse.info.code !== '200' && chatDetailsResponse.info.code !== 200) {
        error.value = chatDetailsResponse.info.message || 'Failed to load group chat details';
        return;
      }
      
      const targetDbId = chatDetailsResponse.info.target_db_id;
      
      if (!targetDbId) {
        error.value = 'Failed to get target_db_id from group chat details';
        return;
      }
      
      // Fetch group info using target_db_id as muid
      const infoResponse = await getMessengerGroupInfo(groupId, targetDbId);
      
      if (infoResponse.info.code === '200' || infoResponse.info.code === 200) {
        groupInfo.value = {
          name: infoResponse.info.name,
          users: infoResponse.info.users,
          admins: infoResponse.info.admins,
        };
      } else {
        error.value = infoResponse.info.message || 'Failed to load group info';
        return;
      }
      
      // Add welcome message only if this is a fresh conversation (no messages yet)
      if (messages.value.length === 0 && conversationHistory.value.length === 0) {
        const welcomeMsg = {
          role: 'assistant' as const,
          content: props.focusedMessage 
            ? `I'm here to help you discuss this message. What would you like to know or how would you like to respond?`
            : `Hello! I can help you analyze this group chat and its participants. What would you like to know?`,
          timestamp: new Date(),
        };
        messages.value.push(welcomeMsg);
      }
    } else {
      // For individual chats, load profile
      const profile = await profileStorage.getProfile(props.selectedChat.db_id);
      if (profile) {
        profileData.value = profile;
      } else {
        error.value = 'Profile data not synced. Please sync profile data via the sync dialog.';
        return;
      }
      
      // Add welcome message only if this is a fresh conversation (no messages yet)
      if (messages.value.length === 0 && conversationHistory.value.length === 0) {
        const welcomeMsg = {
          role: 'assistant' as const,
          content: props.focusedMessage
            ? `I'm here to help you discuss this message from ${profileData.value.account_id}. What would you like to know or how would you like to respond?`
            : `Hello! I can help you analyze the profile and chat history with ${profileData.value.account_id}. What would you like to know?`,
          timestamp: new Date(),
        };
        messages.value.push(welcomeMsg);
      }
    }
  } catch (err) {
    console.error('[AIChatDialog] Failed to load data:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load data';
  }
}

async function handleSendMessage() {
  if (!inputMessage.value.trim() || isLoading.value || (!profileData.value && !isGroupChat.value)) {
    return;
  }
  
  const userMessage = inputMessage.value.trim();
  inputMessage.value = '';
  
  // Add user message to UI
  messages.value.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date(),
  });
  
  // Add to conversation history
  conversationHistory.value.push({
    role: 'user',
    content: userMessage,
  });
  
  // Save to session
  if (props.selectedChat) {
    saveConversationToSession(props.selectedChat.group_id);
  }
  
  isLoading.value = true;
  error.value = null;
  
  // Create new abort controller for this request
  abortController.value = new AbortController();
  
  // Scroll to bottom
  await nextTick();
  scrollToBottom();
  
  try {
    const aiResponse = await chatWithAI(
      userMessage,
      profileData.value,
      chatMessages.value,
      conversationHistory.value,
      abortController.value.signal,
      isGroupChat.value && groupInfo.value
        ? {
            name: groupInfo.value.name,
            participants: [
              ...groupInfo.value.admins.map(a => ({ account_id: a.account_id, db_id: a.db_id })),
              ...groupInfo.value.users.map(u => ({ account_id: u.account_id, db_id: u.db_id })),
            ],
          }
        : null,
      props.focusedMessage || null
    );
    
    // Add AI response to UI
    messages.value.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
    });
    
    // Add to conversation history
    conversationHistory.value.push({
      role: 'assistant',
      content: aiResponse,
    });
    
    // Save to session
    if (props.selectedChat) {
      saveConversationToSession(props.selectedChat.group_id);
    }
    
    // Scroll to bottom
    await nextTick();
    scrollToBottom();
  } catch (err) {
    // Don't show error if request was aborted
    if (err instanceof Error && err.name === 'AbortError') {
      // Remove user message from conversation history on abort
      conversationHistory.value.pop();
      // Remove user message from UI
      messages.value.pop();
      return;
    }
    
    console.error('[AIChatDialog] Failed to get AI response:', err);
    error.value = err instanceof Error ? err.message : 'Failed to get AI response';
    
    // Remove user message from conversation history on error
    conversationHistory.value.pop();
    // Remove user message from UI
    messages.value.pop();
  } finally {
    isLoading.value = false;
    abortController.value = null;
  }
}

function handleStopGeneration() {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
    isLoading.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSendMessage();
  }
}

function onOpenChange(open: boolean) {
  if (!open) {
    handleClose();
  }
}

function handleClose() {
  emit('close');
}

function handleResetChat() {
  // Clear conversation
  conversationHistory.value = [];
  messages.value = [];
  
  // Clear from session
  if (props.selectedChat) {
    sessionConversations.value.delete(String(props.selectedChat.group_id));
  }
  
  // Re-add welcome message
  if (isGroupChat.value && groupInfo.value) {
    const welcomeMsg = {
      role: 'assistant' as const,
      content: `Hello! I can help you analyze this group chat and its participants. What would you like to know?`,
      timestamp: new Date(),
    };
    messages.value.push(welcomeMsg);
  } else if (profileData.value) {
    const welcomeMsg = {
      role: 'assistant' as const,
      content: `Hello! I can help you analyze the profile and chat history with ${profileData.value.account_id}. What would you like to know?`,
      timestamp: new Date(),
    };
    messages.value.push(welcomeMsg);
  }
  
  // Clear edit mode
  editingMessageIndex.value = null;
  editingMessageText.value = '';
}

function handleStartEdit(index: number) {
  if (messages.value[index] && messages.value[index].role === 'user') {
    editingMessageIndex.value = index;
    editingMessageText.value = messages.value[index].content;
  }
}

function handleCancelEdit() {
  editingMessageIndex.value = null;
  editingMessageText.value = '';
}

async function handleSaveEdit(index: number) {
  if (!editingMessageText.value.trim() || (!profileData.value && !isGroupChat.value)) {
    return;
  }
  
  const editedContent = editingMessageText.value.trim();
  
  // Find how many user messages are before this index (not including this one)
  // This tells us where in conversationHistory this message is
  let userMessagesBefore = 0;
  for (let i = 0; i < index; i++) {
    if (messages.value[i] && messages.value[i].role === 'user') {
      userMessagesBefore++;
    }
  }
  
  // Truncate messages array (remove this message and all after it)
  messages.value = messages.value.slice(0, index);
  
  // Truncate conversationHistory
  // conversationHistory contains: [user1, assistant1, user2, assistant2, ...]
  // If we're editing user2 (which is the 2nd user message, index 1 in user messages),
  // we want to keep [user1, assistant1], so truncate to index userMessagesBefore * 2
  // (each user message has a corresponding assistant response)
  const conversationHistoryIndex = userMessagesBefore * 2;
  conversationHistory.value = conversationHistory.value.slice(0, conversationHistoryIndex);
  
  // Clear edit mode
  editingMessageIndex.value = null;
  editingMessageText.value = '';
  
  // Save session before resending
  if (props.selectedChat) {
    saveConversationToSession(props.selectedChat.group_id);
  }
  
  // Now resend the edited message
  inputMessage.value = editedContent;
  await handleSendMessage();
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

// Auto-scroll when new messages are added
watch(() => messages.value.length, () => {
  nextTick(() => {
    scrollToBottom();
  });
});

/**
 * Format AI message content - convert markdown to HTML using marked
 */
function formatAIMessage(content: string): string {
  if (!content) return '';
  
  try {
    // Use marked to convert markdown to HTML
    // marked() is a function that takes markdown and returns HTML string
    const html = (marked as any)(content, {
      breaks: true, // Convert line breaks to <br>
      gfm: true, // GitHub Flavored Markdown
    });
    return typeof html === 'string' ? html : String(html);
  } catch (err) {
    console.error('[AIChatDialog] Failed to parse markdown:', err);
    // Fallback to plain text if markdown parsing fails
    return content.replace(/\n/g, '<br>');
  }
}

/**
 * Extract and format focused message text for display
 */
function formatFocusedMessage(message: MessengerMessage): { text: string; type: string } {
  // Check if it's an image message (type 6)
  if (message.message.startsWith('[6|') && message.message.includes('-|-')) {
    const parsed = parseImageMessage(message.message);
    return { text: parsed.text || '[Image]', type: 'image' };
  }
  // Check if it's a video message (type 8)
  else if (message.message.startsWith('[8|') && message.message.includes('-|-')) {
    const parsed = parseVideoMessage(message.message);
    return { text: parsed.text || '[Video]', type: 'video' };
  }
  // Check if it's a gallery message (type 7)
  else if (message.message.startsWith('[7|')) {
    const parsed = parseGalleryMessage(message.message);
    if (parsed) {
      if (parsed.albums && parsed.albums.length > 1) {
        return { text: `[Gallery: ${parsed.albums.length} albums]`, type: 'gallery' };
      }
      return { text: `[Gallery: ${parsed.galleryName}]`, type: 'gallery' };
    }
    return { text: '[Gallery]', type: 'gallery' };
  }
  // Regular message - strip HTML but keep formatting
  else {
    const div = document.createElement('div');
    div.innerHTML = message.message;
    return { text: (div.textContent || div.innerText || '').trim(), type: 'text' };
  }
}

onMounted(() => {
  if (props.visible) {
    nextTick(() => {
      scrollToBottom();
    });
  }
});
</script>

<template>
  <Dialog :open="visible" @update:open="onOpenChange">
    <DialogContent
      :show-close-button="false"
      :overlay-class="CHAT_NESTED_DIALOG_OVERLAY_CLASS"
      :class="
        cn(
          CHAT_NESTED_DIALOG_CONTENT_CLASS,
          '!flex min-h-0 !h-[90vh] !w-[80vw] !max-w-6xl flex-col overflow-hidden rounded-lg border border-white/[0.06] bg-background p-0 shadow-2xl',
        )
      "
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
              <path d="M12 3v3m0 12v3m9-9h-3m-12 0H3m15.364 6.364l-2.121-2.121M6.757 6.757L4.636 4.636m14.728 0l-2.121 2.121M6.757 17.243l-2.121 2.121"></path>
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="5" r="1"></circle>
              <circle cx="5" cy="19" r="1"></circle>
              <circle cx="19" cy="19" r="1"></circle>
              <circle cx="5" cy="5" r="1"></circle>
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-semibold text-white">
              AI Chat
              <span v-if="selectedChat && !selectedChat.broadcast && !isGroupChat" class="text-sm text-muted-foreground font-normal">
                with {{ selectedChat.account_id }}
              </span>
              <span v-else-if="selectedChat && isGroupChat && groupInfo" class="text-sm text-muted-foreground font-normal">
                for {{ groupInfo.name }}
              </span>
            </h2>
            <p v-if="error" class="text-xs text-red-400 mt-1">{{ error }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- Reset Button -->
          <button
            @click="handleResetChat"
            class="p-2 hover:bg-white/[0.08] rounded-md transition-colors shrink-0"
            title="Reset conversation"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-muted-foreground hover:text-white"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
              <path d="M21 3v5h-5"></path>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
              <path d="M3 21v-5h5"></path>
            </svg>
          </button>
          <!-- Close Button -->
          <button
            @click="handleClose"
            class="p-2 hover:bg-white/[0.08] rounded-md transition-colors shrink-0"
            title="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-muted-foreground hover:text-white"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Messages Area -->
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4 min-w-0"
      >
        <!-- Focused Message Indicator -->
        <div v-if="focusedMessage" class="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div class="flex items-start gap-3">
            <div class="shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-semibold text-blue-400 uppercase tracking-wide">Focused Message</span>
                <span class="text-xs text-muted-foreground">from {{ focusedMessage.account_id }}</span>
                <span class="text-xs text-white/40">•</span>
                <span class="text-xs text-muted-foreground">{{ new Date(focusedMessage.date2 * 1000).toLocaleString() }}</span>
              </div>
              <div class="text-sm text-white/90 whitespace-pre-wrap break-words">
                {{ formatFocusedMessage(focusedMessage).text }}
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="(!profileData && !isGroupChat) && (!groupInfo && isGroupChat) && !error" class="flex items-center justify-center h-full">
          <div class="flex flex-col items-center gap-4">
            <div class="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-muted-foreground text-sm">{{ isGroupChat ? 'Loading group info and messages...' : 'Loading profile and messages...' }}</div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error && messages.length === 0" class="flex items-center justify-center h-full">
          <div class="text-center px-6">
            <div class="text-red-500 mb-2">{{ error }}</div>
            <button
              @click="loadData"
              class="text-blue-500 hover:text-blue-400 text-sm"
            >
              Try again
            </button>
          </div>
        </div>

        <!-- Messages List -->
        <div v-else class="space-y-4">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="[
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            ]"
          >
            <div
              :class="[
                'max-w-[70%] rounded-lg px-4 py-2 relative group',
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-secondary text-white border border-white/[0.06]'
              ]"
            >
              <!-- Edit Mode -->
              <div v-if="editingMessageIndex === index && msg.role === 'user'" class="space-y-2">
                <textarea
                  v-model="editingMessageText"
                  rows="3"
                  class="w-full bg-sidebar border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-blue-400 resize-none"
                  @keydown.enter.exact.prevent="handleSaveEdit(index)"
                  @keydown.escape="handleCancelEdit"
                ></textarea>
                <div class="flex items-center gap-2">
                  <button
                    @click="handleSaveEdit(index)"
                    class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white transition-colors"
                  >
                    Save & Resend
                  </button>
                  <button
                    @click="handleCancelEdit"
                    class="px-3 py-1 bg-white/[0.06] hover:bg-white/[0.10] rounded text-sm text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <!-- Normal Message Display -->
              <template v-else>
                <div :class="AI_MESSAGE_VHTML_CLASS" v-html="formatAIMessage(msg.content)"></div>
                <div class="flex items-center justify-between mt-0.5">
                  <div
                    :class="cn(
                      'text-xs mt-0.5 pt-0 leading-none',
                      msg.role === 'user' ? 'text-blue-100' : 'text-white/40',
                    )"
                  >
                    {{ msg.timestamp.toLocaleTimeString() }}
                  </div>
                  <!-- Edit Button (only for user messages) -->
                  <button
                    v-if="msg.role === 'user'"
                    @click="handleStartEdit(index)"
                    class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/20 rounded"
                    title="Edit message"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-white/80 hover:text-white"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                </div>
              </template>
            </div>
          </div>

          <!-- Loading Indicator -->
          <div v-if="isLoading" class="flex justify-start">
            <div class="bg-secondary border border-white/[0.06] rounded-lg px-4 py-2">
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span class="text-sm text-muted-foreground">AI is thinking...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="px-6 py-4 border-t border-white/[0.06] shrink-0">
        <div class="flex items-end gap-2">
          <textarea
            v-model="inputMessage"
            @keydown="handleKeydown"
            :disabled="isLoading || (!profileData && !isGroupChat) || (isGroupChat && !groupInfo) || !!error"
            :placeholder="isGroupChat ? 'Ask me anything about this group chat and its participants...' : 'Ask me anything about this profile and chat history...'"
            rows="1"
            class="flex-1 bg-sidebar border border-white/[0.06] rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            style="min-height: 40px; max-height: 120px;"
            @input="(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }"
          ></textarea>
          <!-- Stop Button (shown when loading) -->
          <button
            v-if="isLoading"
            @click="handleStopGeneration"
            class="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors shrink-0"
            title="Stop generation"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-white"
            >
              <rect x="6" y="6" width="12" height="12" rx="1"></rect>
            </svg>
          </button>
          <!-- Send Button (shown when not loading) -->
          <button
            v-else
            @click="handleSendMessage"
            :disabled="!inputMessage.trim() || (!profileData && !isGroupChat) || (isGroupChat && !groupInfo) || !!error"
            class="p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shrink-0"
            title="Send message"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-white"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <p class="text-xs text-white/40 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>
