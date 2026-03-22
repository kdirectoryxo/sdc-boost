<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { IconBroadcast, IconExternalLink } from '@tabler/icons-vue';

import PeopleCard from '@/components/PeopleCard.vue';
import '@/components/hub/hub-skeleton.css';
import {
  buildOwnLiveStreamChatroomUrl,
  getVoyeurCamListV2,
  voyeurGroupToOnlineMember,
} from '@/lib/sdc-api/live-chatroom';
import { resolvePeopleApiMuid } from '@/lib/sdc-api/session-credentials';
import type { OnlineV2Member } from '@/lib/sdc-api-types';
import { Button } from '@/lib/view-router/ui/button';

const props = defineProps<{
  getProfileHref?: (userId: number) => string;
}>();

const liveMembers = ref<OnlineV2Member[]>([]);
const liveLoading = ref(false);
const liveError = ref<string | null>(null);
const ownStreamError = ref<string | null>(null);

async function loadInitial() {
  liveLoading.value = true;
  liveError.value = null;
  try {
    const res = await getVoyeurCamListV2(0);
    const groups = res.info.groups ?? [];
    liveMembers.value = groups.map(voyeurGroupToOnlineMember);
  } catch (e) {
    liveError.value = e instanceof Error ? e.message : 'Failed to load live streams';
  } finally {
    liveLoading.value = false;
  }
}

onMounted(() => {
  void loadInitial();
});

async function openOwnStream() {
  ownStreamError.value = null;
  try {
    const dbId = await resolvePeopleApiMuid();
    const url = buildOwnLiveStreamChatroomUrl(dbId);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    ownStreamError.value =
      'Could not resolve your account. Make sure you are logged in on SDC and try again.';
  }
}
</script>

<template>
  <div class="hub-live flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0c0d10]">
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <!-- Your stream: opens chat.sdc.com with your db_id -->
      <div class="shrink-0 px-4 pb-2 pt-4">
        <div
          class="featured-stream relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#141822] via-[#0f1218] to-[#1a1530] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.65)]"
        >
          <div
            class="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl"
            aria-hidden="true"
          />
          <div
            class="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div
            class="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5"
          >
            <div class="flex min-w-0 flex-1 gap-4">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-fuchsia-300 shadow-inner shadow-fuchsia-500/10"
              >
                <IconBroadcast class="size-6" aria-hidden="true" />
              </div>
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  Your stream
                </p>
                <h2 class="mt-0.5 text-base font-semibold tracking-tight text-white sm:text-lg">
                  Go live
                </h2>
                <p class="mt-1 max-w-xl text-sm leading-snug text-white/55">
                  Opens your publisher page on chat.sdc.com using your member ID. Tiles below are other
                  members; click a card to open their profile in the hub.
                </p>
              </div>
            </div>
            <div class="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <Button
                type="button"
                size="lg"
                class="h-11 min-w-[200px] gap-2 bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-950/40 hover:bg-fuchsia-500 sm:min-w-[220px]"
                @click="openOwnStream"
              >
                <IconExternalLink class="size-4 opacity-90" aria-hidden="true" />
                Open your stream
              </Button>
              <span class="text-center text-[11px] text-white/35 sm:text-right">chat.sdc.com · your db_id</span>
              <p
                v-if="ownStreamError"
                class="max-w-[220px] text-center text-xs text-red-400 sm:text-right"
                role="alert"
              >
                {{ ownStreamError }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="liveError" class="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <p class="text-sm text-red-400">{{ liveError }}</p>
        <Button variant="outline" size="sm" @click="loadInitial">Retry</Button>
      </div>

      <div
        v-else-if="liveLoading && liveMembers.length === 0"
        class="flex min-h-0 flex-1 flex-col"
        aria-busy="true"
        aria-label="Loading live streams"
      >
        <div class="shrink-0 px-4 pb-2 pt-4">
          <div
            class="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#12141a] p-4 sm:p-5"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 flex-1 gap-4">
                <div
                  class="hub-skeleton-shimmer h-12 w-12 shrink-0 rounded-xl border border-white/[0.04]"
                />
                <div class="flex min-w-0 flex-1 flex-col gap-2">
                  <div class="hub-skeleton-shimmer h-2.5 w-16 rounded hub-skeleton-rounded" />
                  <div class="hub-skeleton-shimmer h-5 w-40 max-w-[80%] rounded-md" />
                  <div class="hub-skeleton-shimmer h-3 w-full max-w-xl rounded" />
                  <div class="hub-skeleton-shimmer h-3 w-[70%] max-w-md rounded" />
                </div>
              </div>
              <div class="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
                <div
                  class="hub-skeleton-shimmer h-11 w-full min-w-[200px] rounded-lg sm:min-w-[220px]"
                />
                <div
                  class="hub-skeleton-shimmer mx-auto h-2.5 w-28 rounded sm:ml-0 sm:mr-0"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="live-grid px-4 pb-8 pt-2">
          <div v-for="n in 12" :key="n" class="hub-skeleton-live-card">
            <div class="hub-skeleton-shimmer aspect-square w-full rounded-t-[10px]" />
            <div class="flex flex-col gap-2 p-2.5">
              <div class="hub-skeleton-shimmer h-2.5 w-[72%] rounded hub-skeleton-rounded" />
              <div class="hub-skeleton-shimmer h-2.5 w-[48%] rounded hub-skeleton-rounded" />
              <div class="hub-skeleton-shimmer h-2.5 w-[88%] rounded hub-skeleton-rounded" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="!liveLoading && liveMembers.length === 0" class="px-4 py-12 text-center text-sm text-white/45">
        No live streams right now.
      </div>

      <div v-else class="live-grid px-4 pb-8 pt-2">
        <PeopleCard
          v-for="member in liveMembers"
          :key="member.db_id"
          :member="member"
          :is-online="true"
          :profile-href="getProfileHref?.(member.db_id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

@media (min-width: 640px) {
  .live-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}
</style>
