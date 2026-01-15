<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import NewsfeedDialog from './NewsfeedDialog.vue';

const dialogOpen = ref(false);
const isRestoringFromURL = ref(false);

/**
 * Update URL query parameters
 * @param open - Whether dialog should be open
 */
function updateURLParams(open: boolean) {
  const url = new URL(window.location.href);
  
  if (open) {
    url.searchParams.set('newsfeed', 'open');
  } else {
    url.searchParams.delete('newsfeed');
  }
  
  // Update URL without reloading
  window.history.replaceState({}, '', url.toString());
}

/**
 * Read URL query parameters
 */
function readURLParams(): { open: boolean } {
  const params = new URLSearchParams(window.location.search);
  const open = params.get('newsfeed') === 'open';
  return { open };
}

// Check URL on mount - only restore from browser navigation, not initial load
onMounted(() => {
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
  console.log('[NewsfeedDialogWrapper] dialogOpen ref changed to:', newVal);
  // Only update URL if we're not restoring from URL
  if (!isRestoringFromURL.value) {
    updateURLParams(newVal);
  }
});

// Expose methods to parent
defineExpose({
  open: () => {
    console.log('[NewsfeedDialogWrapper] Opening dialog, current value:', dialogOpen.value);
    dialogOpen.value = true;
    updateURLParams(true);
    console.log('[NewsfeedDialogWrapper] After setting, value is:', dialogOpen.value);
  },
  close: () => {
    dialogOpen.value = false;
    updateURLParams(false);
  },
});
</script>

<template>
  <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 999999;">
    <NewsfeedDialog 
      :modelValue="dialogOpen" 
      @update:modelValue="dialogOpen = $event"
      @close="dialogOpen = false"
    />
  </div>
</template>
