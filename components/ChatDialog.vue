<script lang="ts" setup>
import ChatWorkspace from '@/components/chat/ChatWorkspace.vue';

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    style="
      pointer-events: auto;
      z-index: 999999;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    "
    @click.self="handleClose"
  >
    <div
      class="flex h-[95vh] w-[95vw] flex-col overflow-hidden rounded-lg bg-background shadow-2xl md:h-[90vh] md:w-[90vw]"
      @click.stop
    >
      <ChatWorkspace variant="overlay" :active="modelValue" @close="handleClose" />
    </div>
  </div>
</template>
