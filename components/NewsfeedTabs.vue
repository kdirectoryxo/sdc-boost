<script lang="ts" setup>
import { computed } from 'vue';

interface Props {
  activeTab: 'feed' | 'admin';
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'tab-change': [tab: 'feed' | 'admin'];
}>();

const setTab = (tab: 'feed' | 'admin') => {
  emit('tab-change', tab);
};

const indicatorStyle = computed(() => ({
  transform: props.activeTab === 'feed' ? 'translateX(0)' : 'translateX(100%)',
}));
</script>

<template>
  <div class="newsfeed-tabs">
    <div class="newsfeed-tabs-container">
      <!-- Sliding indicator background -->
      <div class="newsfeed-tabs-indicator" :style="indicatorStyle"></div>
      
      <button
        @click="setTab('feed')"
        :class="['newsfeed-tab', { 'newsfeed-tab-active': activeTab === 'feed' }]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
        <span>Feed</span>
      </button>
      <button
        @click="setTab('admin')"
        :class="['newsfeed-tab', { 'newsfeed-tab-active': activeTab === 'admin' }]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span>SDC Berichten</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.newsfeed-tabs {
  background-color: #1a1d21;
  padding: 8px 16px 0;
}

.newsfeed-tabs-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  position: relative;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  padding: 3px;
  gap: 2px;
}

.newsfeed-tabs-indicator {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 2.5px);
  height: calc(100% - 6px);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 5px;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.newsfeed-tab {
  position: relative;
  z-index: 1;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  transition: color 0.2s ease;
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 5px;
}

.newsfeed-tab svg {
  width: 13px;
  height: 13px;
}

.newsfeed-tab:hover:not(.newsfeed-tab-active) {
  color: #9ca3af;
}

.newsfeed-tab-active {
  color: #60a5fa;
}

.newsfeed-tab svg {
  flex-shrink: 0;
}
</style>
