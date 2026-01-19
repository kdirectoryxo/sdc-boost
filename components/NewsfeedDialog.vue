<script lang="ts" setup>
import { computed, ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import NewsfeedFeed from './NewsfeedFeed.vue';
import NewsfeedHeader from './NewsfeedHeader.vue';
import { getNewsfeedFilters, updateNewsfeedFilters } from '@/lib/sdc-api/newsfeed';
import type { NewsfeedFilterOptions } from '@/lib/sdc-api/newsfeed';
import { getCachedFilters, setCachedFilters } from '@/lib/newsfeed-filter-cache';

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

const activeTab = ref<'feed' | 'admin'>('feed');
const filters = ref<Partial<NewsfeedFilterOptions>>({});
const filtersReady = ref(false);

// Load initial filters (with caching)
onMounted(async () => {
  // Try to load from cache first
  const cachedFilters = getCachedFilters();
  if (cachedFilters) {
    filters.value = cachedFilters;
    filtersReady.value = true;
  }

  // Always fetch fresh filters in background and update cache
  try {
    const response = await getNewsfeedFilters();
    filters.value = response.info.options;
    setCachedFilters(response.info.options);
    filtersReady.value = true;
  } catch (error) {
    console.error('[NewsfeedDialog] Failed to load filters:', error);
    if (!cachedFilters) {
      filtersReady.value = true;
    }
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

function handleTabChange(tab: 'feed' | 'admin') {
  activeTab.value = tab;
}

const handleFiltersChange = async (newFilters: Partial<NewsfeedFilterOptions>) => {
  filters.value = { ...filters.value, ...newFilters };
  setCachedFilters(filters.value as NewsfeedFilterOptions);
  
  try {
    await updateNewsfeedFilters(filters.value);
    setCachedFilters(filters.value as NewsfeedFilterOptions);
  } catch (error) {
    console.error('[NewsfeedDialog] Failed to update filters:', error);
  }
};
</script>

<template>
  <Transition name="dialog-fade">
    <div
      v-if="isOpen"
      class="newsfeed-dialog-overlay"
      @click="handleBackdropClick"
    >
      <div class="newsfeed-dialog-container" @click.stop>
        <!-- Header with Tabs -->
        <div class="newsfeed-dialog-header">
          <div class="newsfeed-dialog-header-left">
            <div class="newsfeed-dialog-icon">
              <Icon icon="mdi:rss" width="16" height="16" />
            </div>
            <span class="newsfeed-dialog-title">Activity Feed</span>
          </div>
          
          <!-- Tabs in header -->
          <div class="newsfeed-dialog-tabs">
            <button
              :class="['newsfeed-dialog-tab', { active: activeTab === 'feed' }]"
              @click="handleTabChange('feed')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 11a9 9 0 0 1 9 9" />
                <path d="M4 4a16 16 0 0 1 16 16" />
                <circle cx="5" cy="19" r="1" />
              </svg>
              <span>Feed</span>
            </button>
            <button
              :class="['newsfeed-dialog-tab', { active: activeTab === 'admin' }]"
              @click="handleTabChange('admin')"
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
          
          <button class="newsfeed-dialog-close" @click="handleClose" aria-label="Close">
            <Icon icon="mdi:close" width="18" height="18" />
          </button>
        </div>

        <!-- Filters Section -->
        <div v-if="filtersReady" class="newsfeed-dialog-filters">
          <NewsfeedHeader 
            :active-tab="activeTab"
            :filters="filters"
            @filters-change="handleFiltersChange"
          />
        </div>

        <!-- Dialog Content -->
        <div class="newsfeed-dialog-content">
          <NewsfeedFeed 
            :active-tab="activeTab"
            :filters="filters"
            :filters-ready="filtersReady"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.newsfeed-dialog-overlay {
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

.newsfeed-dialog-container {
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
  .newsfeed-dialog-container {
    width: 90vw;
    height: 90vh;
  }
}

/* Header */
.newsfeed-dialog-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: #1a1d21;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.newsfeed-dialog-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.newsfeed-dialog-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 6px;
  color: white;
}

.newsfeed-dialog-title {
  font-size: 14px;
  font-weight: 600;
  color: white;
  letter-spacing: -0.01em;
}

/* Tabs */
.newsfeed-dialog-tabs {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.04);
  padding: 3px;
  border-radius: 8px;
  margin-left: auto;
}

.newsfeed-dialog-tab {
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

.newsfeed-dialog-tab svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.newsfeed-dialog-tab:hover {
  color: #9ca3af;
}

.newsfeed-dialog-tab.active {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

/* Close Button */
.newsfeed-dialog-close {
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

.newsfeed-dialog-close:hover {
  background: rgba(255, 255, 255, 0.06);
  color: white;
}

/* Filters */
.newsfeed-dialog-filters {
  flex-shrink: 0;
  background: #16181c;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.newsfeed-dialog-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #131517;
}

/* Transitions */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-active .newsfeed-dialog-container,
.dialog-fade-leave-active .newsfeed-dialog-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .newsfeed-dialog-container,
.dialog-fade-leave-to .newsfeed-dialog-container {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}
</style>
