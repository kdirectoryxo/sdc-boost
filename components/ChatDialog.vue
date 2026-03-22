<script lang="ts" setup>
import ChatWorkspace from '@/components/chat/ChatWorkspace.vue';
import { Dialog, DialogContent } from '@/lib/view-router/ui/dialog';

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

function onOpenChange(open: boolean) {
  if (!open) {
    handleClose();
  }
}
</script>

<template>
  <Dialog :open="modelValue" @update:open="onOpenChange">
    <DialogContent
      :show-close-button="false"
      overlay-class="!z-[999999] bg-black/80 backdrop-blur-sm"
      class="flex !h-[95vh] !max-h-[95vh] !w-[95vw] !max-w-[95vw] flex-col gap-0 overflow-hidden border-0 p-0 shadow-2xl !z-[999999] md:!h-[90vh] md:!max-h-[90vh] md:!w-[90vw] md:!max-w-[90vw]"
    >
      <ChatWorkspace variant="overlay" :active="modelValue" @close="handleClose" />
    </DialogContent>
  </Dialog>
</template>
