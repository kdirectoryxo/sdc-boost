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
      zIndex: 1000000,
      pointerEvents: 'none',
      opacity: 0,
    };
  }
  
  return {
    position: 'fixed',
    top: `${pos.y}px`,
    left: `${pos.x}px`,
    zIndex: 1000000,
    pointerEvents: 'none',
    transform: 'translate(-50%, -50%)',
  };
});
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isDragging && draggingElements.size > 0" ref="elementRef" :style="styleOverlay" class="chat-drag-preview">
        <template v-for="[element, { id, initialHTML }] in draggingElements" :key="id">
          <div 
            v-html="initialHTML" 
            class="preview-content"
          ></div>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.chat-drag-preview {
  max-width: 300px;
  opacity: 0.9;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3));
  z-index: 1000000 !important;
}

.preview-content {
  background: #1a1a1a;
  border: 2px solid #4a9eff;
  border-radius: 8px;
  overflow: hidden;
  transform: scale(0.95);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
