<script lang="ts" setup>
import { computed } from 'vue';
import { useDragContainer } from '@vue-dnd-kit/core';
import type { CSSProperties } from 'vue';

const { elementRef, pointerPosition, isDragging, draggingElements } = useDragContainer({
  name: 'fade',
  duration: { enter: 150, leave: 150 },
});

const styleOverlay = computed<CSSProperties>(() => {
  const pos = pointerPosition.current.value;
  if (!pos) {
    return {
      position: 'fixed',
      top: '0px',
      left: '0px',
      zIndex: 10000000,
      pointerEvents: 'none',
      opacity: 0,
    };
  }
  
  return {
    position: 'fixed',
    top: `${pos.y}px`,
    left: `${pos.x}px`,
    zIndex: 10000000,
    pointerEvents: 'none',
    transform: 'translate(-50%, -50%)',
  };
});
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-150 ease-out"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isDragging && draggingElements.size > 0"
      ref="elementRef"
      :style="styleOverlay"
      class="z-[10000000] max-w-[300px] opacity-90 drop-shadow-[0_8px_16px_rgba(0,0,0,0.3)]"
    >
      <template v-for="[element, { id, initialHTML }] in draggingElements" :key="id">
        <div
          v-html="initialHTML"
          class="scale-95 overflow-hidden rounded-lg border-2 border-[#4a9eff] bg-background"
        ></div>
      </template>
    </div>
  </Transition>
</template>
