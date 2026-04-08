<script setup lang="ts">
import { onMounted, ref } from 'vue';

import HubWebinarCard from '@/components/HubWebinarCard.vue';
import { getWebinarList } from '@/lib/sdc-api/live-chatroom';
import type { WebinarListInfo, WebinarListItem } from '@/lib/sdc-api-types';
import { Button } from '@/lib/view-router/ui/button';
import { Skeleton } from '@/lib/view-router/ui/skeleton';

const PAGE_SIZE = 14;

const webinarLive = ref<WebinarListItem[]>([]);
const webinarUpcoming = ref<WebinarListItem[]>([]);
const webinarPast = ref<WebinarListItem[]>([]);
const loading = ref(false);
const loadingMorePast = ref(false);
const error = ref<string | null>(null);
/** Load-more only; does not replace the main list on failure. */
const pastLoadMoreError = ref<string | null>(null);

/** Last `page_p` we successfully merged into `webinarPast` (0 = first page from initial load). */
const pastPageLoaded = ref(0);
/** Total past count from API when provided (`total_pa`). */
const totalPastFromApi = ref<number | null>(null);
const hasMorePast = ref(false);

function updateHasMorePast(info: WebinarListInfo, lastPastBatch: WebinarListItem[]) {
  if (typeof info.total_pa === 'number' && info.total_pa >= 0) {
    totalPastFromApi.value = info.total_pa;
  }
  const total = totalPastFromApi.value;
  if (total != null) {
    hasMorePast.value = webinarPast.value.length < total;
    return;
  }
  const urlMore = info.url_more_p?.trim();
  if (urlMore) {
    hasMorePast.value = true;
    return;
  }
  if (lastPastBatch.length === 0) {
    hasMorePast.value = false;
    return;
  }
  hasMorePast.value = lastPastBatch.length >= PAGE_SIZE;
}

async function loadWebinars() {
  loading.value = true;
  error.value = null;
  pastLoadMoreError.value = null;
  pastPageLoaded.value = 0;
  totalPastFromApi.value = null;
  try {
    const res = await getWebinarList({ page_p: 0, page_u: 0, page_size: PAGE_SIZE });
    webinarLive.value = res.info.webinar_live ?? [];
    webinarUpcoming.value = res.info.upcoming_webinars ?? [];
    const past = res.info.past_webinars ?? [];
    webinarPast.value = past;
    updateHasMorePast(res.info, past);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load webinars';
  } finally {
    loading.value = false;
  }
}

async function loadMorePast() {
  if (loadingMorePast.value || !hasMorePast.value || loading.value) return;

  loadingMorePast.value = true;
  pastLoadMoreError.value = null;
  try {
    const nextPage = pastPageLoaded.value + 1;
    const res = await getWebinarList({ page_p: nextPage, page_u: 0, page_size: PAGE_SIZE });
    const batch = res.info.past_webinars ?? [];
    const seen = new Set(webinarPast.value.map((w) => w.id));
    for (const w of batch) {
      if (!seen.has(w.id)) {
        seen.add(w.id);
        webinarPast.value.push(w);
      }
    }
    pastPageLoaded.value = nextPage;
    updateHasMorePast(res.info, batch);
  } catch (e) {
    pastLoadMoreError.value = e instanceof Error ? e.message : 'Failed to load more past webinars';
  } finally {
    loadingMorePast.value = false;
  }
}

onMounted(() => {
  void loadWebinars();
});
</script>

<template>
  <div class="hub-webinars flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0c0d10]">
    <div class="h-full overflow-y-auto px-4 py-4">
      <div v-if="error" class="flex flex-col items-center gap-2 py-12 text-center">
        <p class="text-sm text-red-400">{{ error }}</p>
        <Button variant="outline" size="sm" @click="loadWebinars">Retry</Button>
      </div>
      <div
        v-else-if="loading"
        class="flex flex-col gap-10"
        aria-busy="true"
        aria-label="Loading webinars"
      >
        <section>
          <Skeleton class="mb-3 h-3 w-28 rounded-md bg-white/10" />
          <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            <div
              v-for="n in 6"
              :key="`sk-live-${n}`"
              class="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
            >
              <Skeleton class="aspect-video w-full rounded-t-xl bg-white/10" />
              <div class="space-y-2 p-3">
                <Skeleton class="h-4 w-full rounded-md bg-white/10" />
                <Skeleton class="h-3 w-32 rounded-md bg-white/10" />
                <Skeleton class="h-3 w-full rounded-md bg-white/10" />
                <Skeleton class="h-3 w-2/3 rounded-md bg-white/10" />
                <div class="flex gap-1 pt-1">
                  <Skeleton class="h-6 w-6 rounded-md bg-white/10" />
                  <Skeleton class="h-6 w-6 rounded-md bg-white/10" />
                  <Skeleton class="h-6 w-6 rounded-md bg-white/10" />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section>
          <Skeleton class="mb-3 h-3 w-32 rounded-md bg-white/10" />
          <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            <div
              v-for="n in PAGE_SIZE"
              :key="`sk-up-${n}`"
              class="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
            >
              <Skeleton class="aspect-video w-full rounded-t-xl bg-white/10" />
              <div class="space-y-2 p-3">
                <Skeleton class="h-4 w-full rounded-md bg-white/10" />
                <Skeleton class="h-3 w-32 rounded-md bg-white/10" />
                <Skeleton class="h-3 w-full rounded-md bg-white/10" />
                <Skeleton class="h-3 w-2/3 rounded-md bg-white/10" />
                <div class="flex gap-1 pt-1">
                  <Skeleton class="h-6 w-6 rounded-md bg-white/10" />
                  <Skeleton class="h-6 w-6 rounded-md bg-white/10" />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section>
          <Skeleton class="mb-3 h-3 w-24 rounded-md bg-white/10" />
          <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            <div
              v-for="n in PAGE_SIZE"
              :key="`sk-past-${n}`"
              class="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
            >
              <Skeleton class="aspect-video w-full rounded-t-xl bg-white/10" />
              <div class="space-y-2 p-3">
                <Skeleton class="h-4 w-full rounded-md bg-white/10" />
                <Skeleton class="h-3 w-32 rounded-md bg-white/10" />
                <Skeleton class="h-3 w-full rounded-md bg-white/10" />
                <Skeleton class="h-3 w-2/3 rounded-md bg-white/10" />
                <div class="flex gap-1 pt-1">
                  <Skeleton class="h-6 w-6 rounded-md bg-white/10" />
                  <Skeleton class="h-6 w-6 rounded-md bg-white/10" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div v-else class="flex flex-col gap-10">
        <section v-if="webinarLive.length">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-400/90">Live now</h3>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            <HubWebinarCard v-for="w in webinarLive" :key="`live-${w.id}`" :item="w" />
          </div>
        </section>

        <section v-if="webinarUpcoming.length">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">Upcoming</h3>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            <HubWebinarCard v-for="w in webinarUpcoming" :key="`up-${w.id}`" :item="w" />
          </div>
        </section>

        <section v-if="webinarPast.length || hasMorePast">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">Past</h3>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            <HubWebinarCard v-for="w in webinarPast" :key="`past-${w.id}`" :item="w" />
            <template v-if="loadingMorePast">
              <div
                v-for="n in PAGE_SIZE"
                :key="`sk-past-more-${n}`"
                class="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
                aria-hidden="true"
              >
                <Skeleton class="aspect-video w-full rounded-t-xl bg-white/10" />
                <div class="space-y-2 p-3">
                  <Skeleton class="h-4 w-full rounded-md bg-white/10" />
                  <Skeleton class="h-3 w-32 rounded-md bg-white/10" />
                  <Skeleton class="h-3 w-3/4 rounded-md bg-white/10" />
                  <div class="flex gap-[3px] pt-1">
                    <Skeleton class="h-3 w-3 rounded-sm bg-white/10" />
                    <Skeleton class="h-3 w-3 rounded-sm bg-white/10" />
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div
            v-if="hasMorePast"
            class="mt-4 flex flex-col items-center gap-2"
            :aria-busy="loadingMorePast"
          >
            <Skeleton
              v-if="loadingMorePast"
              class="h-8 min-w-[10rem] rounded-md bg-white/10"
              role="status"
              aria-label="Loading more webinars"
            />
            <Button
              v-else
              type="button"
              variant="outline"
              size="sm"
              class="min-w-[10rem]"
              @click="loadMorePast"
            >
              Load more
            </Button>
            <p v-if="pastLoadMoreError" class="text-center text-xs text-red-400" role="alert">
              {{ pastLoadMoreError }}
            </p>
          </div>
        </section>

        <p
          v-if="!webinarLive.length && !webinarUpcoming.length && !webinarPast.length"
          class="py-8 text-center text-sm text-white/45"
        >
          No webinars listed.
        </p>
      </div>
    </div>
  </div>
</template>
