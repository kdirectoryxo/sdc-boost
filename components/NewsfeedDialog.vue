<script lang="ts" setup>
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
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
          <div class="newsfeed-dialog-header-left">
            <div class="newsfeed-dialog-icon">
              <Icon icon="mdi:rss" width="20" height="20" />
            </div>
            <div class="newsfeed-dialog-title-group">
              <h2 class="newsfeed-dialog-title">Activity Feed</h2>
              <span class="newsfeed-dialog-subtitle-separator">·</span>
              <span class="newsfeed-dialog-subtitle">Stay updated</span>
            </div>
          </div>
          <button
            class="newsfeed-dialog-close"
            @click="handleClose"
            aria-label="Close"
          >
            <Icon icon="mdi:close" width="20" height="20" />
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
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
  padding: 24px;
  pointer-events: auto;
}

.newsfeed-dialog-container {
  width: 100%;
  max-width: 1000px;
  height: 90vh;
  background-color: #1a1d21;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 24px 48px -12px rgba(0, 0, 0, 0.5);
}

.newsfeed-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: linear-gradient(135deg, #252a30 0%, #1e2227 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.newsfeed-dialog-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.newsfeed-dialog-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 6px;
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
}

.newsfeed-dialog-icon svg {
  width: 18px;
  height: 18px;
}

.newsfeed-dialog-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.newsfeed-dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: white;
  margin: 0;
  letter-spacing: -0.01em;
}

.newsfeed-dialog-subtitle {
  font-size: 13px;
  color: #6b7280;
}

.newsfeed-dialog-subtitle-separator {
  color: #4b5563;
  font-size: 13px;
}

.newsfeed-dialog-close {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.newsfeed-dialog-close svg {
  width: 18px;
  height: 18px;
}

.newsfeed-dialog-close:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
  color: white;
  transform: scale(1.05);
}

.newsfeed-dialog-close:active {
  transform: scale(0.95);
}

.newsfeed-dialog-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  background-color: #1a1d21;
}

/* Custom scrollbar for content */
.newsfeed-dialog-content::-webkit-scrollbar {
  width: 8px;
}

.newsfeed-dialog-content::-webkit-scrollbar-track {
  background: transparent;
}

.newsfeed-dialog-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.newsfeed-dialog-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* Dialog transitions */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-active .newsfeed-dialog-container,
.dialog-fade-leave-active .newsfeed-dialog-container {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.dialog-fade-enter-from .newsfeed-dialog-container {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}

.dialog-fade-leave-to .newsfeed-dialog-container {
  transform: scale(0.98);
  opacity: 0;
}
</style>
