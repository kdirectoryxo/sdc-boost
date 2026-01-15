<script lang="ts" setup>
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
</script>

<template>
  <div class="newsfeed-tabs">
    <div class="newsfeed-tabs-container">
      <button
        @click="setTab('feed')"
        :class="['newsfeed-tab', { 'newsfeed-tab-active': activeTab === 'feed' }]"
      >
        Feed
      </button>
      <button
        @click="setTab('admin')"
        :class="['newsfeed-tab', { 'newsfeed-tab-active': activeTab === 'admin' }]"
      >
        SDC berichten
      </button>
    </div>
  </div>
</template>

<style scoped>
.newsfeed-tabs {
  background-color: #2E353B;
  border-bottom: 1px solid #3a3a3a;
}

.newsfeed-tabs-container {
  display: flex;
}

.newsfeed-tab {
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
}

.newsfeed-tab:hover {
  color: white;
  background-color: #333;
}

.newsfeed-tab-active {
  color: white;
  border-bottom: 2px solid #3b82f6;
  background-color: #262B2F;
}
</style>
