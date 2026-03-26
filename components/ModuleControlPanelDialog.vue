<script lang="ts" setup>
import ModuleControlPanel from '@/components/ModuleControlPanel.vue';
import { moduleDefinitions } from '@/lib/modules/moduleDefinitions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/lib/view-router/ui/dialog';
import { cn } from '@/lib/utils';

interface Props {
  modelValue: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}

function onOpenChange(open: boolean) {
  if (!open) handleClose();
}
</script>

<template>
  <Dialog :open="modelValue" @update:open="onOpenChange">
    <DialogContent
      :show-close-button="true"
      :class="
        cn(
          'flex max-h-[95vh] min-h-0 w-[95vw] max-w-[95vw] flex-col gap-0 overflow-hidden border border-[#333] bg-[#1a1a1a] p-0 sm:max-w-[95vw]',
        )
      "
      :overlay-class="'bg-black/60 backdrop-blur-sm'"
    >
      <DialogHeader class="shrink-0 border-b border-[#333] px-6 py-4 text-left">
        <div class="flex items-center gap-3 pr-10">
          <DialogTitle class="text-xl font-semibold text-white">SDC Boost</DialogTitle>
          <span class="text-sm text-[#999]">Module Control Panel</span>
        </div>
      </DialogHeader>

      <div class="min-h-0 flex-1 overflow-hidden">
        <ModuleControlPanel :available-modules="moduleDefinitions" :grid-layout="true" />
      </div>
    </DialogContent>
  </Dialog>
</template>
