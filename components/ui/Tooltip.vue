<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import Popup from '@/components/ui/Popup.vue';

interface Props {
  text: string;
  position?: 'bottom' | 'top' | 'left' | 'right';
  align?: 'start' | 'center' | 'end' | 'auto';
  delay?: number;
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top',
  align: 'auto',
  delay: 300,
});

const showTooltip = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);
const actualTriggerRef = ref<HTMLElement | null>(null);
let showTimeout: ReturnType<typeof setTimeout> | null = null;

function handleMouseEnter() {
  showTimeout = setTimeout(() => {
    showTooltip.value = true;
  }, props.delay);
}

function handleMouseLeave() {
  if (showTimeout) {
    clearTimeout(showTimeout);
    showTimeout = null;
  }
  showTooltip.value = false;
}

onMounted(async () => {
  await nextTick();
  // Get the actual button/element from the slot (first child of wrapper)
  if (wrapperRef.value) {
    const element = wrapperRef.value.firstElementChild as HTMLElement;
    if (element) {
      actualTriggerRef.value = element;
      element.addEventListener('mouseenter', handleMouseEnter);
      element.addEventListener('mouseleave', handleMouseLeave);
    }
  }
});

onUnmounted(() => {
  if (showTimeout) {
    clearTimeout(showTimeout);
  }
  if (actualTriggerRef.value) {
    actualTriggerRef.value.removeEventListener('mouseenter', handleMouseEnter);
    actualTriggerRef.value.removeEventListener('mouseleave', handleMouseLeave);
  }
});
</script>

<template>
  <span ref="wrapperRef" style="display: contents;">
    <slot />
  </span>
  
  <Popup
    :model-value="showTooltip"
    :trigger-ref="actualTriggerRef"
    :position="position"
    :align="align"
    :offset="6"
    class="pointer-events-none !border-none !p-0 !bg-transparent !shadow-none !min-w-0"
    @update:model-value="showTooltip = $event"
  >
    <div class="px-2 py-1 text-xs text-white bg-black/80 backdrop-blur-sm rounded shadow-lg whitespace-nowrap w-fit">
      {{ text }}
    </div>
  </Popup>
</template>

