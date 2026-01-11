<script lang="ts" setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import type { MessengerChatItem, ProfileUser, MessengerMessage } from '@/lib/sdc-api-types';
import { chatWithAI } from '@/lib/ai-chat-service';
import { profileStorage } from '@/lib/profile-storage';
import { messageStorage } from '@/lib/message-storage';
import { marked } from 'marked';

interface Props {
  visible: boolean;
  selectedChat: MessengerChatItem | null;
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

const messages = ref<ChatMessage[]>([]);
const inputMessage = ref('');
const isLoading = ref(false);
const error = ref<string | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);
const profileData = ref<ProfileUser | null>(null);
const chatMessages = ref<MessengerMessage[]>([]);
const conversationHistory = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

// Track current chat group_id to detect chat switches
const currentGroupId = ref<number | null>(null);

// Load profile and messages when dialog opens
watch([() => props.visible, () => props.selectedChat], async ([visible, chat]) => {
  if (visible && chat && !chat.broadcast && chat.type !== 100 && chat.db_id > 0) {
    // Reset conversation if switching to a different chat
    if (currentGroupId.value !== null && currentGroupId.value !== chat.group_id) {
      conversationHistory.value = [];
      messages.value = [];
    }
    currentGroupId.value = chat.group_id;
    await loadData();
  } else if (!visible) {
    // Reset state when closing
    inputMessage.value = '';
    error.value = null;
    profileData.value = null;
    chatMessages.value = [];
    conversationHistory.value = [];
    messages.value = [];
    currentGroupId.value = null;
  }
}, { immediate: true });

async function loadData() {
  if (!props.selectedChat) return;
  
  try {
    // Check if messages have been synced
    const hasBeenFetched = await messageStorage.hasChatBeenFetched(props.selectedChat.group_id);
    if (!hasBeenFetched) {
      error.value = 'Chat messages not synced. Please sync messages for this chat first via the sync dialog.';
      return;
    }
    
    // Load profile
    const profile = await profileStorage.getProfile(props.selectedChat.db_id);
    if (profile) {
      profileData.value = profile;
    } else {
      error.value = 'Profile data not synced. Please sync profile data via the sync dialog.';
      return;
    }
    
    // Load chat messages
    const msgs = await messageStorage.getMessages(props.selectedChat.group_id);
    chatMessages.value = msgs;
    
    // Add welcome message only if this is a fresh conversation (no messages yet)
    if (messages.value.length === 0 && conversationHistory.value.length === 0) {
      const welcomeMsg = {
        role: 'assistant' as const,
        content: `Hello! I can help you analyze the profile and chat history with ${profileData.value.account_id}. What would you like to know?`,
        timestamp: new Date(),
      };
      messages.value.push(welcomeMsg);
    }
  } catch (err) {
    console.error('[AIChatDialog] Failed to load data:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load data';
  }
}

async function handleSendMessage() {
  if (!inputMessage.value.trim() || isLoading.value || !profileData.value) {
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
  
  isLoading.value = true;
  error.value = null;
  
  // Scroll to bottom
  await nextTick();
  scrollToBottom();
  
  try {
    const aiResponse = await chatWithAI(
      userMessage,
      profileData.value,
      chatMessages.value,
      conversationHistory.value
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
    
    // Scroll to bottom
    await nextTick();
    scrollToBottom();
  } catch (err) {
    console.error('[AIChatDialog] Failed to get AI response:', err);
    error.value = err instanceof Error ? err.message : 'Failed to get AI response';
    
    // Remove user message from conversation history on error
    conversationHistory.value.pop();
    // Remove user message from UI
    messages.value.pop();
  } finally {
    isLoading.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSendMessage();
  }
}

function handleClose() {
  emit('close');
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

onMounted(() => {
  if (props.visible) {
    nextTick(() => {
      scrollToBottom();
    });
  }
});
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    :style="{
      pointerEvents: 'auto',
      zIndex: 10000001,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
    }"
    @click.self="handleClose"
  >
    <div
      class="w-[80vw] max-w-6xl h-[90vh] bg-[#1a1a1a] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-[#333]"
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-[#333] shrink-0">
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
              <span v-if="selectedChat && !selectedChat.broadcast" class="text-sm text-[#999] font-normal">
                with {{ selectedChat.account_id }}
              </span>
            </h2>
            <p v-if="error" class="text-xs text-red-400 mt-1">{{ error }}</p>
          </div>
        </div>
        <button
          @click="handleClose"
          class="p-2 hover:bg-[#333] rounded-md transition-colors shrink-0"
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
            class="text-[#999] hover:text-white"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Messages Area -->
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4 min-w-0"
      >
        <!-- Loading State -->
        <div v-if="!profileData && !error" class="flex items-center justify-center h-full">
          <div class="flex flex-col items-center gap-4">
            <div class="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-[#999] text-sm">Loading profile and messages...</div>
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
                'max-w-[70%] rounded-lg px-4 py-2',
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#2a2a2a] text-white border border-[#333]'
              ]"
            >
              <div class="wrap-break-word ai-message-content" v-html="formatAIMessage(msg.content)"></div>
              <div
                :class="[
                  'text-xs ai-timestamp',
                  msg.role === 'user' ? 'text-blue-100' : 'text-[#666]'
                ]"
              >
                {{ msg.timestamp.toLocaleTimeString() }}
              </div>
            </div>
          </div>

          <!-- Loading Indicator -->
          <div v-if="isLoading" class="flex justify-start">
            <div class="bg-[#2a2a2a] border border-[#333] rounded-lg px-4 py-2">
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span class="text-sm text-[#999]">AI is thinking...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="px-6 py-4 border-t border-[#333] shrink-0">
        <div class="flex items-end gap-2">
          <textarea
            v-model="inputMessage"
            @keydown="handleKeydown"
            :disabled="isLoading || !profileData || !!error"
            placeholder="Ask me anything about this profile and chat history..."
            rows="1"
            class="flex-1 bg-[#0f0f0f] border border-[#333] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            style="min-height: 40px; max-height: 120px;"
            @input="(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }"
          ></textarea>
          <button
            @click="handleSendMessage"
            :disabled="!inputMessage.trim() || isLoading || !profileData || !!error"
            class="p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shrink-0"
            title="Send message"
          >
            <svg
              v-if="!isLoading"
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
            <div
              v-else
              class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
            ></div>
          </button>
        </div>
        <p class="text-xs text-[#666] mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure text wraps properly */
.break-words {
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* AI message content styling - Markdown rendering */
.ai-message-content {
  margin-bottom: 0 !important;
  padding-bottom: 0 !important;
}

.ai-message-content :deep(p) {
  display: block;
  margin-block-start: 0;
  margin-block-end: 0;
  margin-top: 0;
  margin-bottom: 0.5em;
  line-height: 1.3;
  padding: 0;
}

.ai-message-content :deep(p:last-child) {
  line-height: 1.2;
}

.ai-message-content :deep(p:last-child),
.ai-message-content :deep(p:only-child) {
  margin-bottom: 0 !important;
  margin-block-end: 0 !important;
  padding-bottom: 0 !important;
}

.ai-message-content :deep(*:last-child) {
  margin-bottom: 0 !important;
  padding-bottom: 0 !important;
}

.ai-timestamp {
  margin-top: 2px !important;
  padding-top: 0 !important;
  line-height: 1;
}

.ai-message-content :deep(strong) {
  font-weight: 600;
  color: inherit;
}

.ai-message-content :deep(em) {
  font-style: italic;
}

.ai-message-content :deep(ul),
.ai-message-content :deep(ol) {
  list-style-type: disc;
  margin-left: 1.25em;
  margin-top: 0.25em;
  margin-bottom: 0.5em;
  padding-left: 0.75em;
}

.ai-message-content :deep(ol) {
  list-style-type: decimal;
}

.ai-message-content :deep(li) {
  margin-bottom: 0.2em;
  line-height: 1.4;
}

.ai-message-content :deep(li:last-child) {
  margin-bottom: 0;
}

.ai-message-content :deep(li > p) {
  margin-bottom: 0.2em;
}

.ai-message-content :deep(li > p:last-child) {
  margin-bottom: 0;
}

.ai-message-content :deep(h1),
.ai-message-content :deep(h2),
.ai-message-content :deep(h3),
.ai-message-content :deep(h4),
.ai-message-content :deep(h5),
.ai-message-content :deep(h6) {
  font-weight: 600;
  margin-top: 1em;
  margin-bottom: 0.5em;
  line-height: 1.3;
}

.ai-message-content :deep(h1) {
  font-size: 1.5em;
}

.ai-message-content :deep(h2) {
  font-size: 1.3em;
}

.ai-message-content :deep(h3) {
  font-size: 1.1em;
}

.ai-message-content :deep(code) {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 0.2em 0.4em;
  border-radius: 0.25em;
  font-size: 0.9em;
  font-family: 'Courier New', monospace;
}

.ai-message-content :deep(pre) {
  background-color: rgba(0, 0, 0, 0.3);
  padding: 1em;
  border-radius: 0.5em;
  overflow-x: auto;
  margin: 0.75em 0;
}

.ai-message-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.ai-message-content :deep(blockquote) {
  border-left: 3px solid rgba(255, 255, 255, 0.3);
  padding-left: 1em;
  margin: 0.75em 0;
  font-style: italic;
  color: rgba(255, 255, 255, 0.8);
}

.ai-message-content :deep(a) {
  color: #60a5fa;
  text-decoration: underline;
}

.ai-message-content :deep(a:hover) {
  color: #93c5fd;
}

.ai-message-content :deep(hr) {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  margin: 1em 0;
}

.ai-message-content :deep(table) {
  border-collapse: collapse;
  margin: 0.75em 0;
  width: 100%;
}

.ai-message-content :deep(th),
.ai-message-content :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.5em;
  text-align: left;
}

.ai-message-content :deep(th) {
  font-weight: 600;
  background-color: rgba(255, 255, 255, 0.05);
}
</style>
