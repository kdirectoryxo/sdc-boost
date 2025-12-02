<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import ChatDialog from './ChatDialog.vue';

const dialogOpen = ref(false);

/**
 * Update URL query parameters
 */
function updateURLParams(open: boolean, chatId?: string | null) {
  const url = new URL(window.location.href);
  
  if (open) {
    url.searchParams.set('chat', 'open');
    if (chatId) {
      url.searchParams.set('chatId', chatId);
    } else {
      url.searchParams.delete('chatId');
    }
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
    dialogOpen.value = true;
  }
  
  // Listen for browser back/forward navigation
  window.addEventListener('popstate', () => {
    const { open } = readURLParams();
    dialogOpen.value = open;
  });
});

// Watch for dialog state changes and update URL
watch(dialogOpen, (newVal) => {
  console.log('[ChatDialogWrapper] dialogOpen ref changed to:', newVal);
  updateURLParams(newVal);
});

// Expose methods to parent
defineExpose({
  open: () => {
    console.log('[ChatDialogWrapper] Opening dialog, current value:', dialogOpen.value);
    dialogOpen.value = true;
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

