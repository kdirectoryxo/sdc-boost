<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import PeopleList from './PeopleList.vue';

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

const activeTab = ref<'online' | 'viewed'>('online');
const viewedCount = ref(0);

// Subscribe to counter updates
let unsubscribeCounters: (() => void) | null = null;

onMounted(() => {
  // Access counters manager from window
  const countersManager = (window as any).__sdcBoostCounters;
  if (countersManager) {
    // Get initial count
    const counters = countersManager.getCounters();
    if (counters) {
      viewedCount.value = counters.viewed || 0;
    }
    
    // Subscribe to updates
    unsubscribeCounters = countersManager.onUpdate((counters: any) => {
      viewedCount.value = counters.viewed || 0;
    });
  }
});

onUnmounted(() => {
  if (unsubscribeCounters) {
    unsubscribeCounters();
    unsubscribeCounters = null;
  }
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

function handleTabChange(tab: 'online' | 'viewed') {
  activeTab.value = tab;
}
</script>

<template>
  <Transition name="dialog-fade">
    <div
      v-if="isOpen"
      class="people-dialog-overlay"
      @click="handleBackdropClick"
    >
      <div class="people-dialog-container" @click.stop>
        <!-- Dialog Header -->
        <div class="people-dialog-header">
          <div class="people-dialog-header-left">
            <div class="people-dialog-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <circle cx="16" cy="7" r="4"></circle>
              </svg>
            </div>
            <div class="people-dialog-title-group">
              <h2 class="people-dialog-title">People</h2>
            </div>
          </div>
          <button
            class="people-dialog-close"
            @click="handleClose"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="people-dialog-tabs">
          <button
            :class="['people-dialog-tab', { 'people-dialog-tab-active': activeTab === 'online' }]"
            @click="handleTabChange('online')"
          >
            Online
          </button>
          <button
            :class="['people-dialog-tab', { 'people-dialog-tab-active': activeTab === 'viewed' }]"
            @click="handleTabChange('viewed')"
          >
            Bekeken
            <span v-if="viewedCount > 0" class="people-dialog-tab-badge">
              {{ viewedCount > 99 ? '99+' : viewedCount }}
            </span>
          </button>
        </div>

        <!-- Dialog Content -->
        <div class="people-dialog-content">
          <PeopleList :active-tab="activeTab" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.people-dialog-overlay {
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

.people-dialog-container {
  width: 95vw;
  height: 95vh;
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

@media (min-width: 768px) {
  .people-dialog-container {
    width: 90vw;
    height: 90vh;
  }
}

.people-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #252a30 0%, #1e2227 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.people-dialog-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.people-dialog-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 6px;
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
}

.people-dialog-icon svg {
  width: 14px;
  height: 14px;
}

.people-dialog-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.people-dialog-title {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin: 0;
  letter-spacing: -0.01em;
}

.people-dialog-close {
  width: 28px;
  height: 28px;
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

.people-dialog-close svg {
  width: 14px;
  height: 14px;
}

.people-dialog-close:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
  color: white;
  transform: scale(1.05);
}

.people-dialog-close:active {
  transform: scale(0.95);
}

.people-dialog-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(135deg, #252a30 0%, #1e2227 100%);
  flex-shrink: 0;
}

.people-dialog-tab {
  flex: 1;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
  position: relative;
}

.people-dialog-tab:hover {
  color: #9ca3af;
  background: rgba(255, 255, 255, 0.02);
}

.people-dialog-tab-active {
  color: white;
  border-bottom-color: #3b82f6;
}

.people-dialog-tab-active:hover {
  color: white;
  background: rgba(255, 255, 255, 0.04);
}

.people-dialog-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  margin-left: 6px;
  background-color: #f44336;
  color: white;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.people-dialog-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Transition animations */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-active .people-dialog-container,
.dialog-fade-leave-active .people-dialog-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .people-dialog-container,
.dialog-fade-leave-to .people-dialog-container {
  transform: scale(0.95);
  opacity: 0;
}
</style>
