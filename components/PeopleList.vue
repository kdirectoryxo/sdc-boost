<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { getOnlineV2, getViewedV2 } from '@/lib/sdc-api/people';
import type { OnlineV2Member, ViewedV2Member } from '@/lib/sdc-api-types';
import PeopleCard from './PeopleCard.vue';

interface Props {
  activeTab: 'online' | 'viewed';
}

const props = defineProps<Props>();

// State
const items = ref<(OnlineV2Member | ViewedV2Member)[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const hasMore = ref(true);
const currentPage = ref(0);
const abortController = ref<AbortController | null>(null);
const observerTarget = ref<HTMLElement | null>(null);
const observer = ref<IntersectionObserver | null>(null);

// Filter out banner items
const isBannerItem = (item: any): boolean => {
  return item && typeof item === 'object' && 'banner' in item && item.banner === true;
};

// Load members
const loadMembers = async (page: number = 0, append: boolean = false) => {
  // Cancel any in-flight request
  if (abortController.value) {
    abortController.value.abort();
  }

  // Create new abort controller for this request
  const controller = new AbortController();
  abortController.value = controller;

  loading.value = true;
  error.value = null;

  try {
    let response;
    
    if (props.activeTab === 'online') {
      response = await getOnlineV2({
        page,
        gender: '2,1', // Default: show all genders
        looking_for_me: 0,
        pictures: 0,
        business_profile: 1,
        speed_dating: 0,
        birthday: 0,
        video: 0,
        quickFilter: 0,
        country: 'NL',
        map: 0,
      });
    } else {
      response = await getViewedV2({
        page,
        gender: 9, // Default: show all genders
        pictures: 1,
        business_profile: 1,
        select: 1,
        order: 1,
        map: 0,
      });
    }

    // Check if request was aborted
    if (controller.signal.aborted) {
      return;
    }

    // Filter out banner items
    const members = (props.activeTab === 'online' 
      ? response.info.onlinemembers 
      : response.info.viewedmembers).filter(item => !isBannerItem(item)) as (OnlineV2Member | ViewedV2Member)[];

    if (append) {
      items.value = [...items.value, ...members];
    } else {
      items.value = members;
    }

    // Check if there are more pages
    const urlMore = response.info.url_more;
    hasMore.value = urlMore && urlMore !== '-1' && urlMore !== '';
    currentPage.value = page;
  } catch (err) {
    // Ignore abort errors
    if (err instanceof Error && err.name === 'AbortError') {
      return;
    }
    // Only set error if request wasn't aborted
    if (!controller.signal.aborted) {
      error.value = err instanceof Error ? err.message : 'Failed to load members';
      console.error('[PeopleList] Error loading members:', err);
    }
  } finally {
    // Only clear loading if this request wasn't aborted
    if (!controller.signal.aborted) {
      loading.value = false;
      abortController.value = null;
    }
  }
};

const loadMore = () => {
  if (!loading.value && hasMore.value) {
    loadMembers(currentPage.value + 1, true);
  }
};

// Setup IntersectionObserver for infinite scroll
const setupObserver = () => {
  if (observer.value) {
    observer.value.disconnect();
  }

  if (!observerTarget.value) return;

  observer.value = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore.value && !loading.value) {
        loadMore();
      }
    },
    {
      rootMargin: '1000px', // Start loading 1 page ahead (~1000px before reaching bottom)
    }
  );

  observer.value.observe(observerTarget.value);
};

// Watch for tab changes
watch(() => props.activeTab, () => {
  // Cancel any in-flight request
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
  }
  
  items.value = [];
  currentPage.value = 0;
  hasMore.value = true;
  loading.value = false;
  
  // Trigger new fetch
  loadMembers(0, false);
});

onMounted(async () => {
  // Load initial members
  await loadMembers(0, false);
  
  // Setup observer after initial load
  setTimeout(() => {
    setupObserver();
  }, 100);
});

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect();
  }
  if (abortController.value) {
    abortController.value.abort();
  }
});

// Re-setup observer when items change (to catch new observer target)
watch(() => items.value.length, () => {
  if (items.value.length > 0) {
        setTimeout(() => {
      setupObserver();
    }, 100);
  }
});
</script>

<template>
  <div class="people-list">
    <!-- Error State -->
    <div v-if="error" class="people-list-error">
      <div class="people-list-error-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <p class="people-list-error-text">{{ error }}</p>
      <button @click="loadMembers(0, false)" class="people-list-error-retry">
        Try Again
      </button>
    </div>

    <!-- Loading State (Initial) -->
    <div v-else-if="loading && items.length === 0" class="people-list-loading">
      <div class="people-list-loading-grid">
        <div v-for="i in 8" :key="i" class="people-list-skeleton-card">
          <div class="people-list-skeleton-photo"></div>
          <div class="people-list-skeleton-info">
            <div class="people-list-skeleton-line people-list-skeleton-line-short"></div>
            <div class="people-list-skeleton-line people-list-skeleton-line-medium"></div>
            <div class="people-list-skeleton-line people-list-skeleton-line-short"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && items.length === 0" class="people-list-empty">
      <div class="people-list-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <circle cx="16" cy="7" r="4"></circle>
        </svg>
      </div>
      <p class="people-list-empty-title">No members found</p>
      <p class="people-list-empty-text">
        {{ activeTab === 'online' ? 'No online members at the moment' : 'No viewed members yet' }}
      </p>
    </div>

    <!-- Members Grid -->
    <div v-else class="people-list-grid">
      <PeopleCard
        v-for="member in items"
        :key="member.db_id"
        :member="member"
        :is-online="activeTab === 'online'"
      />
    </div>

    <!-- Loading More Indicator -->
    <div v-if="loading && items.length > 0" class="people-list-loading-more">
      <div class="people-list-loading-more-spinner"></div>
      <span>Loading more...</span>
    </div>

    <!-- Observer Target for Infinite Scroll -->
    <div ref="observerTarget" class="people-list-observer-target"></div>
  </div>
</template>

<style scoped>
.people-list {
  width: 100%;
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

/* Custom scrollbar */
.people-list::-webkit-scrollbar {
  width: 8px;
}

.people-list::-webkit-scrollbar-track {
  background: transparent;
}

.people-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}

.people-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.12);
}

/* Error State */
.people-list-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  background: linear-gradient(145deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.04) 100%);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 16px;
  margin-bottom: 12px;
}

.people-list-error-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.15);
  border-radius: 50%;
  color: #f87171;
  margin-bottom: 16px;
}

.people-list-error-text {
  color: #f87171;
  font-size: 14px;
  margin-bottom: 20px;
}

.people-list-error-retry {
  padding: 10px 20px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #f87171;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.people-list-error-retry:hover {
  background: rgba(239, 68, 68, 0.3);
  transform: translateY(-1px);
}

/* Loading State */
.people-list-loading {
  padding: 0;
}

.people-list-loading-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (min-width: 640px) {
  .people-list-loading-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .people-list-loading-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1280px) {
  .people-list-loading-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

.people-list-skeleton-card {
  background: linear-gradient(145deg, #1e1e1e 0%, #151515 100%);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.people-list-skeleton-photo {
  width: 100%;
  height: 180px;
  background: linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

.people-list-skeleton-info {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.people-list-skeleton-line {
  height: 14px;
  background: linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
  border-radius: 6px;
}

.people-list-skeleton-line-short {
  width: 50%;
}

.people-list-skeleton-line-medium {
  width: 75%;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Empty State */
.people-list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 80px 24px;
  gap: 16px;
  color: #6b7280;
}

.people-list-empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 50%;
  padding: 16px;
}

.people-list-empty-title {
  font-size: 20px;
  font-weight: 600;
  color: #9ca3af;
  margin: 0;
}

.people-list-empty-text {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* Members Grid */
.people-list-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (min-width: 640px) {
  .people-list-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .people-list-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1280px) {
  .people-list-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

/* Loading More Indicator */
.people-list-loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  color: #6b7280;
  font-size: 14px;
}

.people-list-loading-more-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Observer Target */
.people-list-observer-target {
  height: 1px;
  width: 100%;
}
</style>
