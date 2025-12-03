<script setup lang="ts">
import { ref } from 'vue';
import ModuleControlPanelDialog from './ModuleControlPanelDialog.vue';

const dialogOpen = ref(false);

// Expose methods to parent
defineExpose({
  open: () => {
    console.log('[ModuleControlPanelDialogWrapper] Opening dialog, current value:', dialogOpen.value);
    dialogOpen.value = true;
    console.log('[ModuleControlPanelDialogWrapper] After setting, value is:', dialogOpen.value);
  },
  close: () => {
    dialogOpen.value = false;
  },
});
</script>

<template>
  <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 999999;">
    <ModuleControlPanelDialog 
      :modelValue="dialogOpen" 
      @update:modelValue="dialogOpen = $event"
      @close="dialogOpen = false"
    />
  </div>
</template>

