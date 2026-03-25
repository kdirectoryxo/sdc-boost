<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { IconBroadcast } from '@tabler/icons-vue';

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
      <!-- Subtle strip: start your stream (link built from session; no IDs shown in UI) -->
      <div class="shrink-0 border-b border-white/[0.06] bg-white/[0.015] px-4 py-2.5">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div class="flex min-w-0 items-start gap-2.5 sm:items-center">
            <IconBroadcast
              class="mt-0.5 size-4 shrink-0 text-white/35 sm:mt-0"
              aria-hidden="true"
            />
            <p class="text-xs leading-relaxed text-white/45">
              Start or manage your stream on chat.sdc.com. Below are members who are live; cards open
              their profile in the hub.
            </p>
          </div>
          <div class="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              class="h-8 self-end px-3 text-xs font-medium"
              @click="openOwnStream"
            >
              Start Stream
            </Button>
            <p
              v-if="ownStreamError"
              class="max-w-full text-right text-[11px] text-red-400"
              role="alert"
            >
              {{ ownStreamError }}
            </p>
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
        <div class="shrink-0 border-b border-white/[0.06] bg-white/[0.015] px-4 py-2.5">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div class="flex min-w-0 flex-1 items-center gap-2.5">
              <div class="hub-skeleton-shimmer h-4 w-4 shrink-0 rounded-sm" />
              <div class="hub-skeleton-shimmer h-3 min-h-[2.25rem] w-full max-w-xl rounded hub-skeleton-rounded" />
            </div>
            <div class="hub-skeleton-shimmer h-8 w-[7.5rem] shrink-0 self-end rounded-md sm:self-auto" />
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
          live-voyeur
          :profile-href="getProfileHref?.(member.db_id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Match chatroom hub: wider cards, fewer columns on small viewports */
.live-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (min-width: 640px) {
  .live-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
}

@media (min-width: 1024px) {
  .live-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .live-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
</style>
