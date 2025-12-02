<script setup lang="ts">
import { ref, watch } from 'vue';
import ChatDialog from './ChatDialog.vue';

const dialogOpen = ref(false);

// Expose methods to parent
defineExpose({
  open: () => {
    console.log('[ChatDialogWrapper] Opening dialog, current value:', dialogOpen.value);
    dialogOpen.value = true;
    console.log('[ChatDialogWrapper] After setting, value is:', dialogOpen.value);
  },
  close: () => {
    dialogOpen.value = false;
  },
});

// Watch for changes to debug
watch(dialogOpen, (newVal) => {
  console.log('[ChatDialogWrapper] dialogOpen ref changed to:', newVal);
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

