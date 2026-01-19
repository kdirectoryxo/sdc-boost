<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { getOnlineV2, getViewedV2 } from '@/lib/sdc-api/people';
import type { OnlineV2Member, ViewedV2Member } from '@/lib/sdc-api-types';
import PeopleCard from './PeopleCard.vue';

export interface ViewedFilters {
  select: number;
  order: number;
  gender: number;
}

export interface OnlineFilters {
  genders: number[];
  looking_for_me: number;
  business_profile: number;
  birthday: number;
  speed_dating: number;
  video: number;
  pictures: number;
}

interface Props {
  activeTab: 'online' | 'viewed';
  viewedFilters?: ViewedFilters;
  onlineFilters?: OnlineFilters;
}

const props = withDefaults(defineProps<Props>(), {
  viewedFilters: () => ({
    select: 1,
    order: 1,
    gender: 9,
  }),
  onlineFilters: () => ({
    genders: [2, 1, 0, 3],
    looking_for_me: 1,
    business_profile: 0,
    birthday: 0,
    speed_dating: 0,
    video: 0,
    pictures: 0,
  }),
});

const items = ref<(OnlineV2Member | ViewedV2Member)[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const hasMore = ref(true);
const currentPage = ref(0);
const abortController = ref<AbortController | null>(null);
const observerTarget = ref<HTMLElement | null>(null);
const observer = ref<IntersectionObserver | null>(null);

const isBannerItem = (item: any): boolean => {
  return item && typeof item === 'object' && 'banner' in item && item.banner === true;
};

const loadMembers = async (page: number = 0, append: boolean = false) => {
  if (abortController.value) {
    abortController.value.abort();
  }

  const controller = new AbortController();
  abortController.value = controller;

  loading.value = true;
  error.value = null;

  try {
    let response;
    
    if (props.activeTab === 'online') {
      const genderString = props.onlineFilters.genders.join(',');
      response = await getOnlineV2({
        page,
        gender: genderString,
        looking_for_me: props.onlineFilters.looking_for_me,
        pictures: props.onlineFilters.pictures,
        business_profile: props.onlineFilters.business_profile,
        speed_dating: props.onlineFilters.speed_dating,
        birthday: props.onlineFilters.birthday,
        video: props.onlineFilters.video,
        quickFilter: 0,
        country: 'NL',
        map: 0,
      });
    } else {
      response = await getViewedV2({
        page,
        gender: props.viewedFilters.gender,
        pictures: 1,
        business_profile: 1,
        select: props.viewedFilters.select,
        order: props.viewedFilters.order,
        map: 0,
      });
    }

    if (controller.signal.aborted) return;

    let members: (OnlineV2Member | ViewedV2Member)[];
    if (props.activeTab === 'online') {
      const onlineResponse = response as import('@/lib/sdc-api-types').OnlineV2Response;
      members = onlineResponse.info.onlinemembers.filter((item: any) => !isBannerItem(item)) as (OnlineV2Member | ViewedV2Member)[];
    } else {
      const viewedResponse = response as import('@/lib/sdc-api-types').ViewedV2Response;
      members = viewedResponse.info.viewedmembers.filter((item: any) => !isBannerItem(item)) as (OnlineV2Member | ViewedV2Member)[];
    }

    if (append) {
      items.value = [...items.value, ...members];
    } else {
      items.value = members;
    }

    const urlMore = response.info.url_more;
    hasMore.value = Boolean(urlMore && urlMore !== '-1' && urlMore !== '');
    currentPage.value = page;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    if (!controller.signal.aborted) {
      error.value = err instanceof Error ? err.message : 'Failed to load members';
      console.error('[PeopleList] Error loading members:', err);
    }
  } finally {
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

const setupObserver = () => {
  if (observer.value) observer.value.disconnect();
  if (!observerTarget.value) return;

  observer.value = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore.value && !loading.value) {
        loadMore();
      }
    },
    { rootMargin: '800px' }
  );

  observer.value.observe(observerTarget.value);
};

watch(() => props.activeTab, () => {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
  }
  items.value = [];
  currentPage.value = 0;
  hasMore.value = true;
  loading.value = false;
  loadMembers(0, false);
});

watch(() => props.viewedFilters, () => {
  if (props.activeTab === 'viewed') {
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
    }
    items.value = [];
    currentPage.value = 0;
    hasMore.value = true;
    loading.value = false;
    loadMembers(0, false);
  }
}, { deep: true });

watch(() => props.onlineFilters, () => {
  if (props.activeTab === 'online') {
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
    }
    items.value = [];
    currentPage.value = 0;
    hasMore.value = true;
    loading.value = false;
    loadMembers(0, false);
  }
}, { deep: true });

onMounted(async () => {
  await loadMembers(0, false);
  setTimeout(() => setupObserver(), 100);
});

onUnmounted(() => {
  if (observer.value) observer.value.disconnect();
  if (abortController.value) abortController.value.abort();
});

watch(() => items.value.length, () => {
  if (items.value.length > 0) {
    setTimeout(() => setupObserver(), 100);
  }
});
</script>

<template>
  <div class="list">
    <!-- Error -->
    <div v-if="error" class="list-error">
      <div class="list-error-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <p class="list-error-text">{{ error }}</p>
      <button @click="loadMembers(0, false)" class="list-error-btn">Retry</button>
    </div>

    <!-- Loading Initial -->
    <div v-else-if="loading && items.length === 0" class="list-loading">
      <div class="skeleton-grid">
        <div v-for="i in 12" :key="i" class="skeleton-card">
          <div class="skeleton-photo"></div>
          <div class="skeleton-info">
            <div class="skeleton-line w-60"></div>
            <div class="skeleton-line w-40"></div>
            <div class="skeleton-line w-80"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!loading && items.length === 0" class="list-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <p class="list-empty-title">No members found</p>
      <p class="list-empty-text">{{ activeTab === 'online' ? 'No online members right now' : 'No viewed members yet' }}</p>
    </div>

    <!-- Grid -->
    <div v-else class="grid">
      <PeopleCard
        v-for="member in items"
        :key="member.db_id"
        :member="member"
        :is-online="activeTab === 'online'"
      />
    </div>

    <!-- Loading More -->
    <div v-if="loading && items.length > 0" class="list-loading-more">
      <div class="spinner"></div>
      <span>Loading more...</span>
    </div>

    <div ref="observerTarget" class="observer"></div>
  </div>
</template>

<style scoped>
.list {
  width: 100%;
  padding: 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.list::-webkit-scrollbar {
  width: 6px;
}

.list::-webkit-scrollbar-track {
  background: transparent;
}

.list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
}

.list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Error */
.list-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 20px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 10px;
}

.list-error-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 50%;
  color: #f87171;
  margin-bottom: 12px;
}

.list-error-text {
  color: #f87171;
  font-size: 13px;
  margin-bottom: 16px;
}

.list-error-btn {
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 6px;
  color: #f87171;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.list-error-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* Loading */
.list-loading {
  padding: 0;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

@media (min-width: 640px) {
  .skeleton-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 900px) {
  .skeleton-grid { grid-template-columns: repeat(4, 1fr); }
}
@media (min-width: 1200px) {
  .skeleton-grid { grid-template-columns: repeat(5, 1fr); }
}
@media (min-width: 1500px) {
  .skeleton-grid { grid-template-columns: repeat(6, 1fr); }
}

.skeleton-card {
  background: #1a1d21;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.skeleton-photo {
  width: 100%;
  aspect-ratio: 1;
  background: linear-gradient(90deg, #16181c 25%, #1e2227 50%, #16181c 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-info {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-line {
  height: 10px;
  background: linear-gradient(90deg, #16181c 25%, #1e2227 50%, #16181c 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.w-60 { width: 60%; }
.w-40 { width: 40%; }
.w-80 { width: 80%; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty */
.list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 60px 20px;
  color: #4b5563;
}

.list-empty svg {
  margin-bottom: 16px;
  opacity: 0.5;
}

.list-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 4px 0;
}

.list-empty-text {
  font-size: 13px;
  color: #4b5563;
  margin: 0;
}

/* Grid */
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

@media (min-width: 640px) {
  .grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 900px) {
  .grid { grid-template-columns: repeat(4, 1fr); }
}
@media (min-width: 1200px) {
  .grid { grid-template-columns: repeat(5, 1fr); }
}
@media (min-width: 1500px) {
  .grid { grid-template-columns: repeat(6, 1fr); }
}

/* Loading More */
.list-loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: #6b7280;
  font-size: 12px;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.observer {
  height: 1px;
  width: 100%;
}
</style>
