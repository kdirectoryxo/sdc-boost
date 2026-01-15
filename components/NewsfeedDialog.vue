<script lang="ts" setup>
import { computed } from 'vue';
import NewsfeedFeed from './NewsfeedFeed.vue';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'close': [];
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

function handleClose() {
  isOpen.value = false;
  emit('close');
}

function handleBackdropClick(e: MouseEvent) {
  // Close if clicking on backdrop (not on dialog content)
  if (e.target === e.currentTarget) {
    handleClose();
  }
}
</script>

<template>
  <Transition name="dialog-fade">
    <div
      v-if="isOpen"
      class="newsfeed-dialog-overlay"
      @click="handleBackdropClick"
    >
      <div class="newsfeed-dialog-container" @click.stop>
        <!-- Dialog Header -->
        <div class="newsfeed-dialog-header">
          <h2 class="newsfeed-dialog-title">SDC Feed</h2>
          <button
            class="newsfeed-dialog-close"
            @click="handleClose"
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Dialog Content -->
        <div class="newsfeed-dialog-content">
          <NewsfeedFeed />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.newsfeed-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
  padding: 20px;
  pointer-events: auto;
}

.newsfeed-dialog-container {
  width: 100%;
  max-width: 1200px;
  max-height: 90vh;
  background-color: #262B2F;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.newsfeed-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background-color: #2E353B;
  border-bottom: 1px solid #3a3a3a;
  flex-shrink: 0;
}

.newsfeed-dialog-title {
  font-size: 20px;
  font-weight: 600;
  color: white;
  margin: 0;
}

.newsfeed-dialog-close {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.newsfeed-dialog-close:hover {
  background-color: #333;
  color: white;
}

.newsfeed-dialog-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* Dialog transitions */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-active .newsfeed-dialog-container,
.dialog-fade-leave-active .newsfeed-dialog-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.dialog-fade-enter-from .newsfeed-dialog-container,
.dialog-fade-leave-to .newsfeed-dialog-container {
  transform: scale(0.95);
  opacity: 0;
}
</style>
