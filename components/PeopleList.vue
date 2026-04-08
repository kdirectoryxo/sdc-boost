<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { getOnlineV2, getViewedV2, getLatestMembersV2, getFeaturedMembersV2 } from '@/lib/sdc-api/people';
import type { OnlineV2Member, ViewedV2Member } from '@/lib/sdc-api-types';
import type { ClientSideFilters } from '@/lib/people-filters-storage';
import { getAgesForClientAgeFilter } from '@/lib/people-age-filter';
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

export interface LatestMembersFilters {
  gender: number;
  looking_for_me: number;
}

interface Props {
  activeTab: 'online' | 'viewed' | 'latest' | 'featured';
  viewedFilters?: ViewedFilters;
  onlineFilters?: OnlineFilters;
  latestMembersFilters?: LatestMembersFilters;
  clientSideFilters?: ClientSideFilters;
  /** Real URLs for `<a href>` (view router); enables middle-click / new tab. */
  getProfileHref?: (userId: number) => string;
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
  latestMembersFilters: () => ({
    gender: 1,
    looking_for_me: 0,
  }),
  clientSideFilters: () => ({
    ageMin: null,
    ageMax: null,
    kmWithin: null,
    ageFilterMode: 'any',
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

// Apply client-side filtering (age and distance)
const filteredItems = computed(() => {
  const { ageMin, ageMax, kmWithin, ageFilterMode } = props.clientSideFilters;
  const mode = ageFilterMode ?? 'any';

  // If no filters are set, return all items
  if (!ageMin && !ageMax && !kmWithin) return items.value;

  return items.value.filter((member) => {
    // Age filtering
    let ageMatch = true;
    if (ageMin || ageMax) {
      const relevantAges = getAgesForClientAgeFilter(
        member.age,
        member.gender1,
        member.gender2,
        mode,
      );
      const hasParsedSlots =
        typeof member.age === 'string' &&
        member.age.split('|').some((p) => {
          const a = parseInt(p.trim(), 10);
          return !isNaN(a) && a >= 18 && a <= 100;
        });

      if (relevantAges.length === 0) {
        // No applicable age for this mode (or unparseable): keep rows with no ages; hide when ages exist but none match the mode.
        ageMatch = !hasParsedSlots;
      } else {
        ageMatch = relevantAges.some((age) => {
          const minOk = !ageMin || age >= ageMin;
          const maxOk = !ageMax || age <= ageMax;
          return minOk && maxOk;
        });
      }
    }
    
    // Distance filtering
    let distanceMatch = true;
    if (kmWithin !== null) {
      const distance = 'location_how_far' in member ? member.location_how_far : 0;
      // Include members with distance <= kmWithin, or if distance is 0/undefined (unknown distance)
      distanceMatch = distance === 0 || distance <= kmWithin;
    }
    
    return ageMatch && distanceMatch;
  });
});

// Auto-load more pages when filtered results are too few
const autoLoadingRef = ref(false);
const checkAndLoadMore = async () => {
  // Only auto-load if we have a client-side filter active
  const { ageMin, ageMax, kmWithin } = props.clientSideFilters;
  if (!ageMin && !ageMax && !kmWithin) {
    autoLoadingRef.value = false;
    return;
  }
  
  // Prevent multiple simultaneous auto-load attempts
  if (autoLoadingRef.value || loading.value) return;
  
  // Estimate how many items we need to fill the viewport
  // Based on grid layout: ~2-6 columns depending on screen size, ~3-4 rows visible
  // So we want at least 25-30 items to fill the viewport comfortably
  const MIN_ITEMS_THRESHOLD = 25;
  
  await nextTick();
  
  // Check if we need more items
  if (filteredItems.value.length < MIN_ITEMS_THRESHOLD && hasMore.value && !loading.value) {
    autoLoadingRef.value = true;
    
    // Load more and then check again recursively
    loadMore();
    
    // Wait for the load to complete, then check again
    const checkAgain = () => {
      setTimeout(async () => {
        if (!loading.value) {
          autoLoadingRef.value = false;
          // Check again after a brief delay to allow filteredItems to update
          await nextTick();
          if (filteredItems.value.length < MIN_ITEMS_THRESHOLD && hasMore.value && !loading.value) {
            await checkAndLoadMore();
          }
        } else {
          checkAgain();
        }
      }, 200);
    };
    
    checkAgain();
  } else {
    autoLoadingRef.value = false;
  }
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
    } else if (props.activeTab === 'latest') {
      response = await getLatestMembersV2({
        page,
        gender: props.latestMembersFilters.gender,
        looking_for_me: props.latestMembersFilters.looking_for_me,
        pictures: 1,
        business_profile: 1,
        map: 0,
      });
    } else if (props.activeTab === 'featured') {
      response = await getFeaturedMembersV2({
        page,
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
    } else if (props.activeTab === 'latest') {
      const latestResponse = response as import('@/lib/sdc-api-types').LatestMembersV2Response;
      members = latestResponse.info.latestmembers.filter((item: any) => !isBannerItem(item)) as (OnlineV2Member | ViewedV2Member)[];
    } else if (props.activeTab === 'featured') {
      const featuredResponse = response as import('@/lib/sdc-api-types').FeaturedMembersV2Response;
      members = featuredResponse.info.featuremembers.filter((item: any) => !isBannerItem(item)) as (OnlineV2Member | ViewedV2Member)[];
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
    
    // After loading, check if we need more items due to client-side filtering
    await nextTick();
    if (append) {
      // Only check after appending (loading more pages), not on initial load
      setTimeout(() => checkAndLoadMore(), 100);
    }
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

watch(() => props.latestMembersFilters, () => {
  if (props.activeTab === 'latest') {
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

// Watch filteredItems to auto-load more when client-side filtering reduces results
watch(() => filteredItems.value.length, async () => {
  await checkAndLoadMore();
});

// Also watch client-side filters to trigger auto-load when filter changes
watch(() => props.clientSideFilters, async () => {
  await nextTick();
  await checkAndLoadMore();
}, { deep: true });
</script>

<template>
  <div
    class="min-h-0 w-full flex-1 overflow-y-auto p-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/[0.06] hover:[&::-webkit-scrollbar-thumb]:bg-white/10"
  >
    <!-- Error -->
    <div
      v-if="error"
      class="flex flex-col items-center rounded-[10px] border border-red-500/15 bg-red-500/[0.06] px-5 py-10 text-center"
    >
      <div
        class="mb-3 flex size-10 items-center justify-center rounded-full bg-red-500/10 text-red-400"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <p class="mb-4 text-[13px] text-red-400">{{ error }}</p>
      <button
        type="button"
        class="cursor-pointer rounded-md border border-red-500/25 bg-red-500/15 px-4 py-2 text-xs font-medium text-red-400 transition-all duration-150 ease-in-out hover:bg-red-500/20"
        @click="loadMembers(0, false)"
      >
        Retry
      </button>
    </div>

    <!-- Loading Initial -->
    <div v-else-if="loading && items.length === 0">
      <div
        class="grid grid-cols-2 gap-2.5 min-[640px]:grid-cols-3 min-[900px]:grid-cols-4 min-[1200px]:grid-cols-5 min-[1500px]:grid-cols-6"
      >
        <div
          v-for="i in 12"
          :key="i"
          class="overflow-hidden rounded-[10px] border border-white/[0.04] bg-[#1a1d21]"
        >
          <div
            class="aspect-square w-full bg-[linear-gradient(90deg,#16181c_25%,#1e2227_50%,#16181c_75%)] bg-[length:200%_100%] animate-hub-shimmer"
          />
          <div class="flex flex-col gap-1.5 p-2.5">
            <div
              class="h-2.5 w-[60%] rounded bg-[linear-gradient(90deg,#16181c_25%,#1e2227_50%,#16181c_75%)] bg-[length:200%_100%] animate-hub-shimmer"
            />
            <div
              class="h-2.5 w-[40%] rounded bg-[linear-gradient(90deg,#16181c_25%,#1e2227_50%,#16181c_75%)] bg-[length:200%_100%] animate-hub-shimmer"
            />
            <div
              class="h-2.5 w-[80%] rounded bg-[linear-gradient(90deg,#16181c_25%,#1e2227_50%,#16181c_75%)] bg-[length:200%_100%] animate-hub-shimmer"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!loading && filteredItems.length === 0"
      class="flex flex-col items-center px-5 py-16 text-center text-gray-600"
    >
      <svg
        class="mb-4 opacity-50"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <p class="mb-1 text-base font-semibold text-gray-500">No members found</p>
      <p class="text-[13px] text-gray-600">
        {{
          activeTab === 'online'
            ? 'No online members right now'
            : activeTab === 'latest'
              ? 'No new members found'
              : activeTab === 'featured'
                ? 'No featured members found'
                : 'No viewed members yet'
        }}
      </p>
    </div>

    <!-- Grid -->
    <div
      v-else
      class="grid grid-cols-2 gap-2.5 min-[640px]:grid-cols-3 min-[900px]:grid-cols-4 min-[1200px]:grid-cols-5 min-[1500px]:grid-cols-6"
    >
      <PeopleCard
        v-for="member in filteredItems"
        :key="member.db_id"
        :member="member"
        :is-online="activeTab === 'online'"
        :profile-href="getProfileHref?.(member.db_id)"
      />
    </div>

    <!-- Loading More -->
    <div
      v-if="loading && filteredItems.length > 0"
      class="flex items-center justify-center gap-2.5 p-6 text-xs text-gray-500"
    >
      <div class="size-[18px] animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
      <span>Loading more...</span>
    </div>

    <div ref="observerTarget" class="h-px w-full" />
  </div>
</template>
