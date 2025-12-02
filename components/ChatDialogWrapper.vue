<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import ChatDialog from './ChatDialog.vue';

const dialogOpen = ref(false);
// Track if we're restoring from URL to avoid removing chatId
const isRestoringFromURL = ref(false);

/**
 * Update URL query parameters
 * @param open - Whether dialog should be open
 * @param chatId - Chat ID to set (if undefined, preserves existing chatId in URL; if null, removes it)
 */
function updateURLParams(open: boolean, chatId?: string | null) {
  const url = new URL(window.location.href);
  const existingChatId = url.searchParams.get('chatId');
  
  if (open) {
    url.searchParams.set('chat', 'open');
    if (chatId !== undefined) {
      // Explicitly set or remove chatId
      if (chatId) {
        url.searchParams.set('chatId', chatId);
      } else {
        url.searchParams.delete('chatId');
      }
    }
    // If chatId is undefined, preserve existing chatId (don't modify it)
  } else {
    url.searchParams.delete('chat');
    url.searchParams.delete('chatId');
  }
  
  // Update URL without reloading
  window.history.replaceState({}, '', url.toString());
}

/**
 * Read URL query parameters
 */
function readURLParams(): { open: boolean; chatId: string | null } {
  const params = new URLSearchParams(window.location.search);
  const open = params.get('chat') === 'open';
  const chatId = params.get('chatId');
  return { open, chatId };
}

// Check URL on mount to restore state
onMounted(() => {
  const { open } = readURLParams();
  if (open) {
    isRestoringFromURL.value = true;
    dialogOpen.value = true;
    // Small delay to ensure watcher has processed, then reset flag
    setTimeout(() => {
      isRestoringFromURL.value = false;
    }, 0);
  }
  
  // Listen for browser back/forward navigation
  window.addEventListener('popstate', () => {
    const { open } = readURLParams();
    isRestoringFromURL.value = true;
    dialogOpen.value = open;
    setTimeout(() => {
      isRestoringFromURL.value = false;
    }, 0);
  });
});

// Watch for dialog state changes and update URL
watch(dialogOpen, (newVal) => {
  console.log('[ChatDialogWrapper] dialogOpen ref changed to:', newVal);
  // Only update URL if we're not restoring from URL (to preserve existing chatId)
  if (!isRestoringFromURL.value) {
    updateURLParams(newVal);
  }
});

// Expose methods to parent
defineExpose({
  open: () => {
    console.log('[ChatDialogWrapper] Opening dialog, current value:', dialogOpen.value);
    dialogOpen.value = true;
    // Preserve existing chatId when opening
    updateURLParams(true);
    console.log('[ChatDialogWrapper] After setting, value is:', dialogOpen.value);
  },
  close: () => {
    dialogOpen.value = false;
    updateURLParams(false);
  },
});
</script>

<template>
  <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 999999;">
    <ChatDialog 
      :modelValue="dialogOpen" 
      @update:modelValue="dialogOpen = $event"
      @close="dialogOpen = false"
    />
  </div>
</template>

