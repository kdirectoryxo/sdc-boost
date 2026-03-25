<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { IconBell } from '@tabler/icons-vue';

import type { FeedNotificationItem } from '@/lib/sdc-api-types';
import { formatFeedNotificationBodyHtml } from '@/lib/feed-notification-html';
import { getFeedNotifications } from '@/lib/sdc-api/notifications';
import { Button } from '@/lib/view-router/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/lib/view-router/ui/dropdown-menu';
import { Spinner } from '@/lib/view-router/ui/spinner';
import { getBoostProfilePath, getBoostViewRouterUrl, navigateBoostViewRouterPath } from '@/lib/view-router/routes';

const props = defineProps<{
  feedCounter: number;
}>();

const FALLBACK_AVATAR =
  'https://www.sdc.com/react/assets/couple_male_female_silhouette.cae98680.svg';

const open = ref(false);
const loading = ref(false);
const loadError = ref<string | null>(null);
const items = ref<FeedNotificationItem[]>([]);
const page = ref(0);
const hasMore = ref(false);

const scrollRoot = ref<HTMLElement | null>(null);
const infiniteSentinel = ref<HTMLElement | null>(null);
let infiniteScrollObserver: IntersectionObserver | null = null;

function disconnectInfiniteScroll() {
  infiniteScrollObserver?.disconnect();
  infiniteScrollObserver = null;
}

async function connectInfiniteScroll() {
  disconnectInfiniteScroll();
  await nextTick();
  if (!open.value) return;
  const root = scrollRoot.value;
  const target = infiniteSentinel.value;
  if (!root || !target || !hasMore.value) return;

  infiniteScrollObserver = new IntersectionObserver(
    (entries) => {
      if (!entries[0]?.isIntersecting) return;
      if (loading.value || !hasMore.value) return;
      fetchPage(page.value + 1, true);
    },
    { root, rootMargin: '100px 0px 0px 0px', threshold: 0 },
  );
  infiniteScrollObserver.observe(target);
}

const badgeLabel = computed(() => {
  const n = props.feedCounter;
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
});

function photoUrl(photo: string | undefined): string {
  if (!photo?.trim() || photo === '/thumbnail/' || photo.endsWith('/thumbnail/')) {
    return FALLBACK_AVATAR;
  }
  if (photo.startsWith('http')) return photo;
  return `https://pictures.sdc.com/photos/${photo}`;
}

function formatNotificationTitle(title: string, post: FeedNotificationItem['post']): string {
  let t = title;
  const data = post.data;
  if (data && typeof data === 'object' && !Array.isArray(data) && 'title' in data) {
    const eventTitle = String((data as { title?: unknown }).title ?? '');
    if (eventTitle) {
      t = t.replace(/\/\/\*event_title\*\/\//g, eventTitle);
    }
  }
  return t.replace(/<[^>]*>/g, '').trim() || title;
}

async function fetchPage(nextPage: number, append: boolean) {
  loading.value = true;
  loadError.value = null;
  try {
    const res = await getFeedNotifications({ page: nextPage });
    if (res.info.code !== 200) {
      throw new Error(`Notifications API code ${res.info.code}`);
    }
    const list = res.info.notifications ?? [];
    if (append) {
      items.value = [...items.value, ...list];
    } else {
      items.value = list;
    }
    page.value = nextPage;
    hasMore.value = res.info.url_more === 1;
  } catch (e) {
    console.error('[HubNotificationsMenu]', e);
    loadError.value = e instanceof Error ? e.message : 'Kon meldingen niet laden.';
    if (!append) items.value = [];
  } finally {
    loading.value = false;
  }
}

function resetAndLoad() {
  page.value = 0;
  hasMore.value = false;
  return fetchPage(0, false);
}

watch(open, (isOpen) => {
  if (isOpen) {
    resetAndLoad();
  } else {
    disconnectInfiniteScroll();
  }
});

watch(
  () => [open.value, items.value.length, hasMore.value] as const,
  () => {
    if (!open.value) return;
    void connectInfiniteScroll();
  },
  { flush: 'post' },
);

onUnmounted(() => {
  disconnectInfiniteScroll();
});

function onRowClick(event: MouseEvent, n: FeedNotificationItem) {
  const t = event.target as HTMLElement | null;
  if (t?.closest('a, button')) return;
  event.preventDefault();
  navigateBoostViewRouterPath(getBoostProfilePath(n.sender.db_id));
}

function onRowMiddleClick(event: MouseEvent, n: FeedNotificationItem) {
  if (event.button !== 1) return;
  const t = event.target as HTMLElement | null;
  if (t?.closest('a, button')) return;
  event.preventDefault();
  window.open(getBoostViewRouterUrl(getBoostProfilePath(n.sender.db_id)), '_blank');
}

function openSenderProfile(n: FeedNotificationItem) {
  navigateBoostViewRouterPath(getBoostProfilePath(n.sender.db_id));
}
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="relative text-white/70 hover:bg-white/10 hover:text-white"
        :aria-label="badgeLabel ? `Meldingen (${feedCounter} ongelezen)` : 'Meldingen'"
      >
        <IconBell class="size-5" />
        <span
          v-if="badgeLabel"
          class="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-[#16181c] shadow-sm"
        >
          {{ badgeLabel }}
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      :side-offset="8"
      class="w-[min(100vw-1.5rem,22rem)] border border-white/[0.08] bg-[#1c1f26] p-0 text-white shadow-xl"
    >
      <div class="border-b border-white/[0.06] px-3 py-2">
        <p class="text-sm font-semibold text-white">Meldingen</p>
      </div>

      <div
        ref="scrollRoot"
        class="max-h-[min(420px,70vh)] overflow-y-auto overflow-x-hidden"
      >
        <div v-if="loading && items.length === 0" class="flex items-center justify-center gap-2 py-10 text-white/50">
          <Spinner class="size-5" />
          <span class="text-sm">Laden…</span>
        </div>
        <p v-else-if="loadError" class="px-3 py-6 text-center text-sm text-rose-400">
          {{ loadError }}
        </p>
        <p v-else-if="items.length === 0" class="px-3 py-8 text-center text-sm text-white/45">
          Geen meldingen.
        </p>
        <template v-else>
          <ul class="divide-y divide-white/[0.05]">
            <li
              v-for="n in items"
              :key="n.id"
              class="flex cursor-pointer gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
              role="button"
              tabindex="0"
              @click="onRowClick($event, n)"
              @auxclick="onRowMiddleClick($event, n)"
              @keydown.enter="openSenderProfile(n)"
            >
              <img
                :src="photoUrl(n.sender.primary_photo)"
                alt=""
                class="mt-0.5 size-10 shrink-0 rounded-full object-cover"
                @error="(e) => ((e.target as HTMLImageElement).src = FALLBACK_AVATAR)"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium text-white/90">
                  {{ formatNotificationTitle(n.post.title, n.post) }}
                </p>
                <p class="truncate text-xs text-white/55">
                  {{ n.sender.account_id }}
                </p>
                <div
                  class="notification-body-prose mt-1 text-xs leading-snug text-white/70 [&_a]:text-sky-400 [&_a]:underline [&_a:hover]:text-sky-300"
                  v-html="formatFeedNotificationBodyHtml(n.post.body, n.sender.account_id)"
                />
                <p class="mt-1 text-[11px] text-white/35">
                  {{ n.timed }}
                </p>
              </div>
            </li>
          </ul>
          <div
            v-if="loading && items.length > 0"
            class="flex justify-center py-3 text-white/45"
            aria-hidden="true"
          >
            <Spinner class="size-5" />
          </div>
          <div
            v-if="hasMore"
            ref="infiniteSentinel"
            class="h-6 w-full shrink-0"
            aria-hidden="true"
          />
        </template>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<style scoped>
.notification-body-prose :deep(p) {
  margin: 0.25em 0;
}
.notification-body-prose :deep(p:first-child) {
  margin-top: 0;
}
.notification-body-prose :deep(p:last-child) {
  margin-bottom: 0;
}
.notification-body-prose :deep(.feed-notification-account-name) {
  color: #c4b5fd;
  font-weight: 600;
}
</style>
