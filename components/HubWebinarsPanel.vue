<script setup lang="ts">
import { onMounted, ref } from 'vue';

import '@/components/hub/hub-skeleton.css';
import { getWebinarList, webinarPartyUrl } from '@/lib/sdc-api/live-chatroom';
import type { WebinarListItem } from '@/lib/sdc-api-types';
import { Button } from '@/lib/view-router/ui/button';

const webinarLive = ref<WebinarListItem[]>([]);
const webinarUpcoming = ref<WebinarListItem[]>([]);
const webinarPast = ref<WebinarListItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function loadWebinars() {
  loading.value = true;
  error.value = null;
  try {
    const res = await getWebinarList({ page_p: 0, page_u: 0, page_size: 12 });
    webinarLive.value = res.info.webinar_live ?? [];
    webinarUpcoming.value = res.info.upcoming_webinars ?? [];
    webinarPast.value = res.info.past_webinars ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load webinars';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadWebinars();
});

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
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
          <div class="mb-3 h-3 w-28 rounded hub-skeleton-shimmer hub-skeleton-rounded" />
          <div class="webinar-grid">
            <div v-for="n in 6" :key="`sk-live-${n}`" class="hub-skeleton-webinar-card">
              <div class="aspect-video w-full rounded-t-xl hub-skeleton-shimmer" />
              <div class="space-y-2 p-3">
                <div class="hub-skeleton-shimmer h-4 w-full rounded hub-skeleton-rounded" />
                <div class="hub-skeleton-shimmer h-3 w-24 rounded hub-skeleton-rounded" />
              </div>
            </div>
          </div>
        </section>
        <section>
          <div class="mb-3 h-3 w-32 rounded hub-skeleton-shimmer hub-skeleton-rounded" />
          <div class="webinar-grid">
            <div v-for="n in 6" :key="`sk-up-${n}`" class="hub-skeleton-webinar-card">
              <div class="aspect-video w-full rounded-t-xl hub-skeleton-shimmer" />
              <div class="space-y-2 p-3">
                <div class="hub-skeleton-shimmer h-4 w-full rounded hub-skeleton-rounded" />
                <div class="hub-skeleton-shimmer h-3 w-28 rounded hub-skeleton-rounded" />
              </div>
            </div>
          </div>
        </section>
      </div>
      <div v-else class="flex flex-col gap-10">
        <section v-if="webinarLive.length">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-400/90">Live now</h3>
          <div class="webinar-grid">
            <article
              v-for="w in webinarLive"
              :key="`live-${w.id}`"
              class="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]"
            >
              <button
                type="button"
                class="block w-full text-left"
                @click="openExternal(webinarPartyUrl(w.id))"
              >
                <div class="relative aspect-video w-full bg-black/40">
                  <img
                    v-if="w.flyer"
                    :src="w.flyer"
                    :alt="w.title"
                    class="h-full w-full object-cover transition group-hover:opacity-90"
                  />
                </div>
                <div class="p-3">
                  <p class="line-clamp-2 text-sm font-medium text-white">{{ w.title }}</p>
                  <p v-if="w.date_str" class="mt-1 text-xs text-white/45">{{ w.date_str }}</p>
                </div>
              </button>
            </article>
          </div>
        </section>

        <section v-if="webinarUpcoming.length">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">Upcoming</h3>
          <div class="webinar-grid">
            <article
              v-for="w in webinarUpcoming"
              :key="`up-${w.id}`"
              class="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]"
            >
              <button
                type="button"
                class="block w-full text-left"
                @click="openExternal(webinarPartyUrl(w.id))"
              >
                <div class="relative aspect-video w-full bg-black/40">
                  <img
                    v-if="w.flyer"
                    :src="w.flyer"
                    :alt="w.title"
                    class="h-full w-full object-cover transition group-hover:opacity-90"
                  />
                </div>
                <div class="p-3">
                  <p class="line-clamp-2 text-sm font-medium text-white">{{ w.title }}</p>
                  <p v-if="w.date_str" class="mt-1 text-xs text-white/45">{{ w.date_str }}</p>
                </div>
              </button>
            </article>
          </div>
        </section>

        <section v-if="webinarPast.length">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">Past</h3>
          <div class="webinar-grid">
            <article
              v-for="w in webinarPast"
              :key="`past-${w.id}`"
              class="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]"
            >
              <button
                type="button"
                class="block w-full text-left"
                @click="openExternal(webinarPartyUrl(w.id))"
              >
                <div class="relative aspect-video w-full bg-black/40">
                  <img
                    v-if="w.flyer"
                    :src="w.flyer"
                    :alt="w.title"
                    class="h-full w-full object-cover transition group-hover:opacity-90"
                  />
                </div>
                <div class="p-3">
                  <p class="line-clamp-2 text-sm font-medium text-white">{{ w.title }}</p>
                  <p v-if="w.date_str" class="mt-1 text-xs text-white/45">{{ w.date_str }}</p>
                </div>
              </button>
            </article>
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

<style scoped>
.webinar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
</style>
