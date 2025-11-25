<script lang="ts" setup>
import { ref, watch } from 'vue';
import Popup from '@/components/ui/Popup.vue';
import Switch from '@/components/ui/Switch.vue';

interface Props {
  modelValue: boolean;
  filterByActive: boolean;
  triggerRef?: HTMLElement | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:filterByActive': [value: boolean];
}>();

watch(() => props.modelValue, (newValue) => {
  console.log('[FilterPopup] modelValue changed to:', newValue, 'triggerRef:', !!props.triggerRef);
});

watch(() => props.triggerRef, (newRef) => {
  console.log('[FilterPopup] triggerRef changed:', !!newRef);
});

function handleFilterChange(value: boolean) {
  console.log('[FilterPopup] Filter change:', value);
  emit('update:filterByActive', value);
}
</script>

<template>
  <Popup
    :model-value="modelValue"
    :trigger-ref="triggerRef"
    position="bottom"
    align="end"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="px-4 py-3">
      <div class="flex items-center justify-between gap-4 min-w-[200px]">
        <label class="text-sm text-[#e0e0e0] cursor-pointer flex-1">
          Show only active modules
        </label>
        <Switch
          :model-value="filterByActive"
          @update:model-value="handleFilterChange"
        />
      </div>
    </div>
  </Popup>
</template>

