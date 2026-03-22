<script lang="ts" setup>
import { Icon } from '@iconify/vue';
import type { PeopleTabId } from '@/lib/view-router/routes';

defineProps<{
  modelValue: boolean;
  activeTab: PeopleTabId;
  viewedCount: number;
}>();

const emit = defineEmits<{
  close: [];
  'tab-change': [tab: PeopleTabId];
}>();

function handleClose() {
  emit('close');
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    handleClose();
  }
}

function handleTabChange(tab: PeopleTabId) {
  emit('tab-change', tab);
}
</script>

<template>
  <Transition name="dialog-fade">
    <div v-if="modelValue" class="people-overlay" @click="handleBackdropClick">
      <div class="people-container" @click.stop>
        <div class="people-header">
          <div class="people-header-left">
            <div class="people-icon">
              <Icon icon="mdi:account-group" width="16" height="16" />
            </div>
            <span class="people-title">People</span>
          </div>

          <div class="people-tabs">
            <button
              :class="['people-tab', { active: activeTab === 'viewed' }]"
              type="button"
              @click="handleTabChange('viewed')"
            >
              Bekeken
              <span v-if="viewedCount > 0" class="people-tab-badge">
                {{ viewedCount > 99 ? '99+' : viewedCount }}
              </span>
            </button>
            <button
              :class="['people-tab', { active: activeTab === 'online' }]"
              type="button"
              @click="handleTabChange('online')"
            >
              Online
            </button>
            <button
              :class="['people-tab', { active: activeTab === 'latest' }]"
              type="button"
              @click="handleTabChange('latest')"
            >
              Nieuwe leden
            </button>
            <button
              :class="['people-tab', { active: activeTab === 'featured' }]"
              type="button"
              @click="handleTabChange('featured')"
            >
              Spotlight leden
            </button>
          </div>

          <button class="people-close" type="button" aria-label="Close" @click="handleClose">
            <Icon icon="mdi:close" width="18" height="18" />
          </button>
        </div>

        <slot />
      </div>
      <slot name="after" />
    </div>
  </Transition>
</template>

<style scoped>
.people-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
  padding: 16px;
  pointer-events: auto;
}

.people-container {
  width: 95vw;
  height: 95vh;
  background: #131517;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06), 0 24px 64px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
  position: relative;
}

@media (min-width: 768px) {
  .people-container {
    width: 90vw;
    height: 90vh;
  }
}

.people-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: #1a1d21;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.people-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.people-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 6px;
  color: white;
}

.people-title {
  font-size: 14px;
  font-weight: 600;
  color: white;
  letter-spacing: -0.01em;
}

.people-tabs {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.04);
  padding: 3px;
  border-radius: 8px;
  margin-left: auto;
}

.people-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.people-tab:hover {
  color: #9ca3af;
}

.people-tab.active {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

.people-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  background: #ef4444;
  color: white;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
}

.people-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-left: 8px;
}

.people-close:hover {
  background: rgba(255, 255, 255, 0.06);
  color: white;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-active .people-container,
.dialog-fade-leave-active .people-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .people-container,
.dialog-fade-leave-to .people-container {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}
</style>
