<script lang="ts" setup>
import { computed, ref } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';
import { getCurrentMuid } from '@/lib/sdc-api/utils';

interface Props {
  item: NewsfeedItem;
}

const props = defineProps<Props>();

const getActionIcon = () => {
  // Map action types to icons/subjects
  switch (props.item.action) {
    case 2: // Photos approved
      return { icon: '📷', label: "Foto's" };
    case 3: // Videos approved
      return { icon: '🎥', label: "Video's" };
    case 21: // Party review request
      return { icon: '🎉', label: "Party's & Events" };
    case 14: // Payment received (when no party object)
      return { icon: '💳', label: 'Betaling ontvangen' };
    default:
      return { icon: '🔔', label: 'Melding' };
  }
};

const actionInfo = computed(() => getActionIcon());

// Strip HTML tags from text
const stripHtml = (text: string | undefined): string => {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').trim();
};

// Get the title - prefer subject, but for action 21 use extra_data or body if subject has placeholders
const getTitle = () => {
  if (props.item.action === 21) {
    // For party review requests, subject has placeholders, use extra_data.title or extract from body
    if (props.item.extra_data?.title) {
      return props.item.extra_data.title;
    }
    // Fallback: use subject if no placeholders, otherwise use body
    if (props.item.subject && !props.item.subject.includes('//*')) {
      return stripHtml(props.item.subject);
    }
    // Extract title from body if available
    if (props.item.body) {
      const match = props.item.body.match(/<b[^>]*>([^<]+)<\/b>/);
      if (match) return match[1];
    }
  }
  
  // For action 14 (payment), use subject if available, otherwise use action label
  if (props.item.action === 14 && props.item.subject) {
    return stripHtml(props.item.subject);
  }
  
  // Default: use subject (strip HTML) or action label
  return stripHtml(props.item.subject) || actionInfo.value.label;
};

const title = computed(() => getTitle());

// Get the body content - prefer body, but fallback to subject
const getBodyContent = () => {
  // For action 21, always use body (subject has placeholders)
  if (props.item.action === 21) {
    return props.item.body || '';
  }
  
  // For other actions, prefer body, fallback to subject
  return props.item.body || props.item.subject || '';
};

const bodyContent = computed(() => getBodyContent());

const formatBody = (body: string | undefined) => {
  if (!body) return '';
  // Remove HTML tags for display (or use v-html if we want to render HTML)
  return body.replace(/<[^>]*>/g, '').trim();
};

const hasHtml = (text: string | undefined) => {
  if (!text) return false;
  // Check for any HTML tags (including self-closing tags like <br />)
  return /<[^>]+>/.test(text);
};

const isReplying = ref(false);

// Handle reply button click - open chat with sender
const handleReply = async () => {
  const senderDbId = props.item.sender?.db_id;
  if (!senderDbId) {
    console.error('[AdminNotificationCard] No sender db_id found');
    return;
  }

  if (isReplying.value) return; // Prevent double-clicks

  isReplying.value = true;

  try {
    const muid = getCurrentMuid();
    if (!muid) {
      console.error('[AdminNotificationCard] MUID not found');
      return;
    }

    // Call messenger_chat_details with GroupID=-1 to get/create chat
    const url = new URL('https://api.sdc.com/v1/messenger_chat_details');
    url.searchParams.set('muid', muid);
    url.searchParams.set('DB_ID', senderDbId.toString());
    url.searchParams.set('type', '0');
    url.searchParams.set('GroupID', '-1'); // -1 to get/create chat
    url.searchParams.set('page', '0');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch chat details: ${response.status}`);
    }

    const data = await response.json();
    const groupId = data.info?.group_id;

    if (!groupId) {
      throw new Error('No group_id returned from chat details API');
    }

    // Close newsfeed dialog first
    const newsfeedDialog = (window as any).__sdcBoostNewsfeedDialog;
    if (newsfeedDialog) {
      newsfeedDialog.close();
    }

    // Open chat dialog with the group_id
    const url2 = new URL(window.location.href);
    url2.searchParams.set('chat', 'open');
    url2.searchParams.set('chatId', groupId.toString());
    window.history.replaceState({}, '', url2.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));

    setTimeout(() => {
      const chatDialog = (window as any).__sdcBoostChatDialog;
      if (chatDialog) {
        chatDialog.open();
      }
    }, 0);
  } catch (error) {
    console.error('[AdminNotificationCard] Failed to open chat:', error);
    const toast = (window as any).__sdcBoostToast;
    if (toast) {
      toast.error('Failed to open chat');
    }
  } finally {
    isReplying.value = false;
  }
};
</script>

<template>
  <div class="admin-notification-card-wrapper">
    <div class="admin-notification-card">
      <!-- Icon -->
      <div class="admin-notification-card-icon">
        {{ actionInfo.icon }}
      </div>

      <!-- Content -->
      <div class="admin-notification-card-content">
        <!-- Subject/Title -->
        <div class="admin-notification-card-header">
          <p class="admin-notification-card-title">
            {{ title }}
          </p>
          <p class="admin-notification-card-time">
            {{ item.timed }}
          </p>
        </div>

        <!-- Body -->
        <div class="admin-notification-card-body">
          <div v-if="hasHtml(bodyContent)" v-html="bodyContent" class="admin-notification-prose"></div>
          <p v-else>{{ formatBody(bodyContent) }}</p>
        </div>

        <!-- Action Status Indicator -->
        <div v-if="item.action_status === 1" class="admin-notification-card-status">
          <span class="admin-notification-card-status-text">✓ Verwerkt</span>
        </div>
      </div>

      <!-- Reply Button -->
      <button 
        class="admin-notification-card-reply" 
        @click="handleReply" 
        :disabled="isReplying"
        title="Antwoorden"
      >
        <svg v-if="!isReplying" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        <svg v-else class="admin-notification-card-reply-loading" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.admin-notification-card-wrapper {
  background-color: #1f1f1f;
  border-radius: 8px;
  border: 1px solid #333;
  overflow: hidden;
}

.admin-notification-card {
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.admin-notification-card-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.admin-notification-card-content {
  flex: 1;
  min-width: 0;
}

.admin-notification-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.admin-notification-card-title {
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.admin-notification-card-time {
  color: #9ca3af;
  font-size: 12px;
  flex-shrink: 0;
  margin-left: 16px;
}

.admin-notification-card-body {
  color: #d1d5db;
  font-size: 14px;
}

.admin-notification-card-status {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-notification-card-status-text {
  font-size: 12px;
  color: #4ade80;
}

.admin-notification-card-reply {
  flex-shrink: 0;
  background-color: #3b82f6;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  min-width: 40px;
  height: 36px;
}

.admin-notification-card-reply:hover:not(:disabled) {
  background-color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.admin-notification-card-reply:active:not(:disabled) {
  transform: translateY(0);
}

.admin-notification-card-reply:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: #1e40af;
}

.admin-notification-card-reply svg {
  width: 18px;
  height: 18px;
}

.admin-notification-card-reply-loading {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.admin-notification-prose {
  color: #d1d5db;
  line-height: 1.6;
}

.admin-notification-prose a {
  color: #60a5fa;
  text-decoration: underline;
}

.admin-notification-prose a:hover {
  color: #93c5fd;
}

.admin-notification-prose b {
  color: #9ca3af;
  font-weight: 600;
}

.admin-notification-prose p {
  margin: 0.5em 0;
}

.admin-notification-prose p:first-child {
  margin-top: 0;
}

.admin-notification-prose p:last-child {
  margin-bottom: 0;
}
</style>
