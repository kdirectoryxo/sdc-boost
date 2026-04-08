<script lang="ts" setup>
import { ref, onMounted, watch, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { getNewsfeed, getAdminFeed } from '@/lib/sdc-api/newsfeed';
import type { NewsfeedItem, NewsfeedFilterOptions } from '@/lib/sdc-api/newsfeed';
import PartyEventCard from './PartyEventCard.vue';
import SpeedDatingCard from './SpeedDatingCard.vue';
import AdminNotificationCard from './AdminNotificationCard.vue';
import GuestListCard from './GuestListCard.vue';
import ProfileInteractionCard from './ProfileInteractionCard.vue';
import BirthdayCard from './BirthdayCard.vue';
import TravelPlanCard from './TravelPlanCard.vue';
import GroupBlogCard from './GroupBlogCard.vue';
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
const abortController = ref<AbortController | null>(null);
/** Prevents intersection observer from chaining many pages while the sentinel stays “in view”. */
const loadMoreDebounceId = ref<ReturnType<typeof setTimeout> | null>(null);

// Convert filter options to filter strings
// Based on SDC source code classes Q7 (Vrienden/filter_f) and Z7 (Algemeen/filter)
const getFilterStrings = () => {
  const filter: string[] = [];
  const filter_f: string[] = [];

  // Content type filters (first dropdown - "Algemeen") -> filter param
  // Based on Z7 class: always include base values [3, 22, 903, 906, 20]
  filter.push('3', '22', '903', '906', '20');
  
  // Then add specific filters based on props
  if (props.filters.group_post_blog) filter.push('300'); // Groepen / Blogs (groupsAndBlogs)
  if (props.filters.speed_area) filter.push('904'); // Speed Date (Algemeen) (speedDate)
  if (props.filters.travelplans_area) filter.push('200'); // Reisplannen (Algemeen) (travelPlans)
  if (props.filters.my_parties) filter.push('26', '100'); // Party's & Events (Algemeen) - my parties and party announcements
  if (props.filters.viewed_me) filter.push('24'); // Viewed me

  // Activity filters (second dropdown - "Vrienden") -> filter_f param
  // Based on Q7 class mapping
  if (props.filters.likes_sent) filter_f.push('3'); // Likes gegeven (likesGiven)
  if (props.filters.group_joined) filter_f.push('17', '18', '38'); // Groepslid geworden (joinedGroup) - includes actions 17, 18, and 38
  if (props.filters.photos_videos) filter_f.push('5', '6'); // Foto's & Video's (photosAndVideos)
  if (props.filters.validations) filter_f.push('21'); // Validaties (validations)
  if (props.filters.birthday) filter_f.push('23'); // Verjaardag (birthdays)
  if (props.filters.speedating) filter_f.push('8'); // Speed Date (Vrienden) (speedDate)
  if (props.filters.travelplans) filter_f.push('9'); // Reisplannen (Vrienden) (travelPlans)
  if (props.filters.parties) filter_f.push('14'); // Party's & Events (partiesAndEvents)
  if (props.filters.member_services) filter_f.push('13'); // Ledenservice (memberServices)
  if (props.filters.friends_new) filter_f.push('20'); // Nieuwe vrienden / volgers (newFriendsAndFollowers)
  
  // Remove duplicates and sort
  const uniqueFilter = [...new Set(filter)].sort((a, b) => parseInt(a) - parseInt(b));
  const uniqueFilterF = [...new Set(filter_f)].sort((a, b) => parseInt(a) - parseInt(b));
  
  return {
    filter: uniqueFilter.join(','),
    filter_f: uniqueFilterF.join(',')
  };
};

const loadFeed = async (page: number = 0, append: boolean = false) => {
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
        new Date().getTimezoneOffset() * -1,
        controller.signal
      );

      // Check if request was aborted
      if (controller.signal.aborted) {
        return;
      }

      const chunk = response.info.newsfeed ?? [];
      if (append) {
        items.value = [...items.value, ...chunk];
        if (chunk.length === 0) {
          hasMore.value = false;
        }
      } else {
        items.value = chunk;
      }

      lastKey.value = response.info.last_key;
      hasMore.value = response.info.url_more !== '-1';
      if (append && chunk.length === 0) {
        hasMore.value = false;
      }
      currentPage.value = page;
    } else {
      const response = await getAdminFeed(
        page,
        filterStrings.filter,
        filterStrings.filter_f,
        undefined,
        false,
        '0',
        controller.signal
      );

      // Check if request was aborted
      if (controller.signal.aborted) {
        return;
      }

      const chunk = response.info.newsfeed ?? [];
      if (append) {
        items.value = [...items.value, ...chunk];
        if (chunk.length === 0) {
          hasMore.value = false;
        }
      } else {
        items.value = chunk;
      }

      hasMore.value = response.info.url_more !== '-1';
      if (append && chunk.length === 0) {
        hasMore.value = false;
      }
      currentPage.value = page;
    }
  } catch (err) {
    // Ignore abort errors
    if (err instanceof Error && err.name === 'AbortError') {
      return;
    }
    // Only set error if request wasn't aborted
    if (!controller.signal.aborted) {
      error.value = err instanceof Error ? err.message : 'Failed to load feed';
      console.error('[NewsfeedList] Error loading feed:', err);
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
    loadFeed(currentPage.value + 1, true);
  }
};

/** IO + large rootMargin against viewport caused chained loads (page 12+); debounce + scroll root fixes that. */
function scheduleLoadMoreFromObserver() {
  if (!hasMore.value || loading.value) return;
  if (loadMoreDebounceId.value != null) {
    clearTimeout(loadMoreDebounceId.value);
  }
  loadMoreDebounceId.value = setTimeout(() => {
    loadMoreDebounceId.value = null;
    if (!loading.value && hasMore.value) {
      loadMore();
    }
  }, 450);
}

// Setup IntersectionObserver for infinite scroll (root = scroll container, not viewport)
const setupObserver = () => {
  if (observer.value) {
    observer.value.disconnect();
  }

  if (!observerTarget.value) return;

  const scrollRoot = observerTarget.value.closest('.newsfeed-content');

  observer.value = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore.value && !loading.value) {
        scheduleLoadMoreFromObserver();
      }
    },
    {
      root: scrollRoot instanceof HTMLElement ? scrollRoot : null,
      rootMargin: '0px 0px 280px 0px',
      threshold: 0,
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

// Watch for filter changes - use immediate flush to ensure rapid changes are handled
watch(() => props.filters, () => {
  // Cancel any in-flight request immediately
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
  }
  
  items.value = [];
  currentPage.value = 0;
  lastKey.value = '';
  hasMore.value = true;
  loading.value = false; // Reset loading state to allow new request
  
  // Trigger new fetch with latest filters
  loadFeed(0, false);
}, { deep: true, flush: 'sync' });

onMounted(async () => {
  // Load initial feed
  await loadFeed(0, false);

  // Setup observer after initial load
  setTimeout(() => {
    setupObserver();
  }, 100);
});

onUnmounted(() => {
  if (loadMoreDebounceId.value != null) {
    clearTimeout(loadMoreDebounceId.value);
    loadMoreDebounceId.value = null;
  }
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
  <div class="w-full max-w-full px-6 pb-6 pt-4">
    <!-- Error State -->
    <div
      v-if="error"
      class="mb-3 flex flex-col items-center rounded-[10px] border border-red-500/20 bg-red-500/[0.08] px-4 py-8 text-center"
    >
      <div
        class="mb-3 flex size-9 items-center justify-center rounded-full bg-red-500/15 text-red-400"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p class="mb-1.5 text-[15px] font-semibold text-red-400">Something went wrong</p>
      <p class="text-sm text-red-300">{{ error }}</p>
    </div>

    <!-- Loading State (Initial) -->
    <div v-else-if="loading && items.length === 0" class="py-1">
      <div class="flex flex-col gap-2.5">
        <div
          v-for="i in 6"
          :key="i"
          class="rounded-[10px] border border-white/[0.05] bg-white/[0.03] p-3.5"
        >
          <div class="mb-3 flex items-center gap-2.5">
            <div
              class="size-11 shrink-0 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_25%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.04)_75%)] bg-[length:200%_100%] animate-hub-shimmer"
            />
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <div
                class="h-3 w-[40%] rounded bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_25%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.04)_75%)] bg-[length:200%_100%] animate-hub-shimmer"
              />
              <div
                class="h-2.5 w-1/4 rounded bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_25%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.04)_75%)] bg-[length:200%_100%] animate-hub-shimmer"
              />
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <div
              class="h-3 rounded bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_25%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.04)_75%)] bg-[length:200%_100%] animate-hub-shimmer"
            />
            <div
              class="h-3 w-[70%] rounded bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_25%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.04)_75%)] bg-[length:200%_100%] animate-hub-shimmer"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && items.length === 0" class="flex flex-col items-center px-4 py-10 text-center">
      <div
        class="mb-3.5 flex size-14 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-gray-600"
      >
        <svg
          class="size-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      </div>
      <p class="mb-1.5 text-[15px] font-semibold text-gray-400">No activity yet</p>
      <p class="max-w-[260px] text-sm text-gray-500">When there's new activity, it will show up here</p>
    </div>

    <!-- Feed Items -->
    <div v-else class="flex flex-col gap-3">
      <template v-for="(item, index) in items" :key="item.action_id">
        <!-- Guest List Card: action 600 -->
        <GuestListCard v-if="item.action === 600" :item="item" :index="index" />
        <!-- Birthday Card: action 906 -->
        <BirthdayCard v-else-if="item.action === 906" :item="item" :index="index" />
        <!-- Profile Interaction Cards: actions 3 (like), 21 (validation), 22 (follow) - only for regular feed -->
        <ProfileInteractionCard v-else-if="activeTab === 'feed' && (item.action === 3 || item.action === 21 || item.action === 22)" :item="item" :index="index" />
        <!-- Party Event Card: action 14 with valid party object (has party_id or title) -->
        <PartyEventCard v-else-if="item.action === 14 && item.party && (item.party.party_id || item.party.title)" :item="item" :index="index" />
        <!-- Speed Dating Card: actions 8 (Vrienden) and 904 (Algemeen) -->
        <SpeedDatingCard v-else-if="item.action === 8 || item.action === 904" :item="item" :index="index" />
        <!-- Travel Plan Card: action 200 -->
        <TravelPlanCard v-else-if="item.action === 200" :item="item" :index="index" />
        <!-- Group Blog Card: action 300 (group/blog posts), action 18 & 38 (group joins), and action 100 (party announcements) -->
        <GroupBlogCard v-else-if="item.action === 300 || item.action === 18 || item.action === 38 || item.action === 100" :item="item" :index="index" />
        <!-- Admin Notification Card: admin-specific actions (2, 3, 21, 14 without party) or admin tab fallback -->
        <AdminNotificationCard v-else-if="activeTab === 'admin' || item.action === 2 || item.action === 3 || item.action === 21 || (item.action === 14 && !item.party)" :item="item" :index="index" />
        <!-- Coming Soon Card: unsupported actions in regular feed -->
        <ComingSoonCard v-else :item="item" :index="index" />
      </template>
    </div>

    <!-- Loading More Indicator -->
    <div
      v-if="loading && items.length > 0"
      class="flex items-center justify-center gap-2 py-4 text-[13px] text-gray-500"
    >
      <div
        class="size-3.5 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500"
      />
      <span>Loading more...</span>
    </div>

    <!-- Observer Target for Infinite Scroll -->
    <div ref="observerTarget" class="h-px" />
  </div>
</template>
