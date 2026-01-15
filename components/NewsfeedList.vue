<script lang="ts" setup>
import { ref, onMounted, watch, onUnmounted } from 'vue';
import { getNewsfeed, getAdminFeed, updateNewsfeedFilters, getNewsfeedFilters } from '@/lib/sdc-api/newsfeed';
import type { NewsfeedItem, NewsfeedFilterOptions } from '@/lib/sdc-api/newsfeed';
import PartyEventCard from './PartyEventCard.vue';
import SpeedDatingCard from './SpeedDatingCard.vue';
import AdminNotificationCard from './AdminNotificationCard.vue';
import GuestListCard from './GuestListCard.vue';
import ProfileInteractionCard from './ProfileInteractionCard.vue';
import ComingSoonCard from './ComingSoonCard.vue';

interface Props {
  activeTab: 'feed' | 'admin';
  filters: Partial<NewsfeedFilterOptions>;
}

const props = defineProps<Props>();

const items = ref<NewsfeedItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const hasMore = ref(true);
const currentPage = ref(0);
const lastKey = ref('');
const observerTarget = ref<HTMLElement | null>(null);
const observer = ref<IntersectionObserver | null>(null);

// Convert filter options to filter strings
// Based on the API call example: filter=3,22,300,904,200,903,906,20&filter_f=17,18,5,6,21,23,8,9,14,13,20
const getFilterStrings = () => {
  const filter: string[] = [];
  const filter_f: string[] = [];

  // Content type filters (first dropdown) -> filter param
  if (props.filters.group_post_blog) filter.push('3'); // Groepen / Blogs
  if (props.filters.speedating) filter.push('904'); // Speed Date
  if (props.filters.travelplans) filter.push('22'); // Reisplannen
  if (props.filters.parties) filter.push('14'); // Party's & Events

  // Activity filters (second dropdown) -> filter_f param
  if (props.filters.likes_sent) filter_f.push('17'); // Likes gegeven
  if (props.filters.group_joined) filter_f.push('18'); // Groepslid geworden
  if (props.filters.photos_videos) filter_f.push('5'); // Foto's & Video's
  if (props.filters.validations) filter_f.push('6'); // Validaties
  if (props.filters.birthday) filter_f.push('21'); // Verjaardag
  if (props.filters.speedating) filter_f.push('9'); // Speed Date (in activity filters)
  if (props.filters.travelplans) filter_f.push('13'); // Reisplannen (in activity filters)
  if (props.filters.parties) filter_f.push('14'); // Party's & Events (in activity filters)
  if (props.filters.member_services) filter_f.push('23'); // Ledenservice
  if (props.filters.friends_new) filter_f.push('8'); // Nieuwe vrienden / volgers

  return {
    filter: filter.join(','),
    filter_f: filter_f.join(',')
  };
};

const loadFeed = async (page: number = 0, append: boolean = false) => {
  if (loading.value) return;

  loading.value = true;
  error.value = null;

  try {
    const filterStrings = getFilterStrings();

    if (props.activeTab === 'feed') {
      const response = await getNewsfeed(
        page,
        filterStrings.filter,
        filterStrings.filter_f,
        undefined,
        Date.now(),
        false,
        append ? lastKey.value : '',
        new Date().getTimezoneOffset() * -1
      );

      if (append) {
        items.value = [...items.value, ...response.info.newsfeed];
      } else {
        items.value = response.info.newsfeed;
      }

      lastKey.value = response.info.last_key;
      hasMore.value = response.info.url_more !== '-1';
      currentPage.value = page;
    } else {
      const response = await getAdminFeed(
        page,
        filterStrings.filter,
        filterStrings.filter_f,
        undefined,
        false,
        '0'
      );

      if (append) {
        items.value = [...items.value, ...response.info.newsfeed];
      } else {
        items.value = response.info.newsfeed;
      }

      hasMore.value = response.info.url_more !== '-1';
      currentPage.value = page;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load feed';
    console.error('[NewsfeedList] Error loading feed:', err);
  } finally {
    loading.value = false;
  }
};

const loadMore = () => {
  if (!loading.value && hasMore.value) {
    loadFeed(currentPage.value + 1, true);
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
      rootMargin: '200px', // Start loading 200px before reaching bottom
    }
  );

  observer.value.observe(observerTarget.value);
};

// Watch for tab changes
watch(() => props.activeTab, () => {
  items.value = [];
  currentPage.value = 0;
  lastKey.value = '';
  hasMore.value = true;
  loadFeed(0, false);
});

// Watch for filter changes
watch(() => props.filters, () => {
  items.value = [];
  currentPage.value = 0;
  lastKey.value = '';
  hasMore.value = true;
  loadFeed(0, false);
}, { deep: true });

onMounted(async () => {
  // Load initial feed
  await loadFeed(0, false);

  // Setup observer after initial load
  setTimeout(() => {
    setupObserver();
  }, 100);
});

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect();
  }
});

// Re-setup observer when target element changes
watch(observerTarget, () => {
  if (observerTarget.value) {
    setupObserver();
  }
});
</script>

<template>
  <div class="newsfeed-list">
    <!-- Error State -->
    <div v-if="error" class="newsfeed-error">
      <p class="newsfeed-error-text">{{ error }}</p>
    </div>

    <!-- Loading State (Initial) -->
    <div v-if="loading && items.length === 0" class="newsfeed-loading">
      <p>Loading feed...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && items.length === 0" class="newsfeed-empty">
      <p>No items found</p>
    </div>

    <!-- Feed Items -->
    <div v-else class="newsfeed-items">
      <template v-for="item in items" :key="item.action_id">
        <!-- Guest List Card: action 600 -->
        <GuestListCard v-if="item.action === 600" :item="item" />
        <!-- Profile Interaction Cards: actions 3 (like), 21 (validation), 22 (follow) - only for regular feed -->
        <ProfileInteractionCard v-else-if="activeTab === 'feed' && (item.action === 3 || item.action === 21 || item.action === 22)" :item="item" />
        <!-- Party Event Card: action 14 with valid party object (has party_id or title) -->
        <PartyEventCard v-else-if="item.action === 14 && item.party && (item.party.party_id || item.party.title)" :item="item" />
        <!-- Speed Dating Card: action 904 -->
        <SpeedDatingCard v-else-if="item.action === 904" :item="item" />
        <!-- Admin Notification Card: admin-specific actions (2, 3, 21, 14 without party) or admin tab fallback -->
        <AdminNotificationCard v-else-if="activeTab === 'admin' || item.action === 2 || item.action === 3 || item.action === 21 || (item.action === 14 && !item.party)" :item="item" />
        <!-- Coming Soon Card: unsupported actions in regular feed -->
        <ComingSoonCard v-else :item="item" />
      </template>
    </div>

    <!-- Loading More Indicator -->
    <div v-if="loading && items.length > 0" class="newsfeed-loading-more">
      <p>Loading more...</p>
    </div>

    <!-- Observer Target for Infinite Scroll -->
    <div ref="observerTarget" class="newsfeed-observer-target"></div>
  </div>
</template>

<style scoped>
.newsfeed-list {
  max-width: 896px;
  margin: 0 auto;
  padding: 24px 16px;
}

.newsfeed-error {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.5);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.newsfeed-error-text {
  color: #f87171;
  font-size: 14px;
}

.newsfeed-loading {
  text-align: center;
  padding: 48px 0;
  color: #9ca3af;
}

.newsfeed-empty {
  text-align: center;
  padding: 48px 0;
  color: #9ca3af;
}

.newsfeed-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.newsfeed-loading-more {
  text-align: center;
  padding: 24px 0;
  color: #9ca3af;
  font-size: 14px;
}

.newsfeed-observer-target {
  height: 4px;
}
</style>
