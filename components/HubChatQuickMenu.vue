<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IconMessage } from '@tabler/icons-vue';

import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { getMessengerLatest } from '@/lib/sdc-api/messenger';
import { Button } from '@/lib/view-router/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/lib/view-router/ui/hover-card';
import { Spinner } from '@/lib/view-router/ui/spinner';
import {
  getBoostViewRouterUrl,
  navigateBoostHubChatWithGroupId,
  navigateBoostViewRouterPath,
  VIEW_ROUTER_CHAT_PATH,
} from '@/lib/view-router/routes';
import { cn } from '@/lib/utils';

const props = defineProps<{
  messenger: number;
}>();

const LIMIT = 10;
const FETCH_CACHE_MS = 30_000;

const FALLBACK_AVATAR =
  'https://www.sdc.com/react/assets/couple_male_female_silhouette.cae98680.svg';

const open = ref(false);
const loading = ref(false);
const loadError = ref<string | null>(null);
const items = ref<MessengerChatItem[]>([]);
const lastFetchedAt = ref(0);

const messengerBadgeLabel = computed(() => {
  const n = props.messenger;
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

function stripChatPreview(raw: string): string {
  const noTags = raw.replace(/<[^>]*>/g, '').trim();
  return noTags.length > 100 ? `${noTags.slice(0, 97)}…` : noTags;
}

function chatDisplayName(chat: MessengerChatItem): string {
  if (chat.group_type === 1 && chat.group_name?.trim()) {
    return chat.group_name.trim();
  }
  return chat.account_id || 'Chat';
}

function onChatNavClick(event: MouseEvent) {
  if (event.button !== 0) return;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateBoostViewRouterPath(VIEW_ROUTER_CHAT_PATH);
}

function onViewAllClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  open.value = false;
  navigateBoostViewRouterPath(VIEW_ROUTER_CHAT_PATH);
}

function openChat(chat: MessengerChatItem, event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  open.value = false;
  navigateBoostHubChatWithGroupId(chat.group_id);
}

async function fetchChats() {
  loading.value = true;
  loadError.value = null;
  try {
    const res = await getMessengerLatest(0);
    const list = (res.info.chat_list ?? []).slice(0, LIMIT);
    items.value = list;
    lastFetchedAt.value = Date.now();
  } catch (e) {
    console.error('[HubChatQuickMenu]', e);
    loadError.value = e instanceof Error ? e.message : 'Kon chats niet laden.';
    if (items.value.length === 0) {
      items.value = [];
    }
  } finally {
    loading.value = false;
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return;
  const stale = Date.now() - lastFetchedAt.value > FETCH_CACHE_MS;
  if (!stale && items.value.length > 0) return;
  void fetchChats();
});
</script>

<template>
  <HoverCard
    v-model:open="open"
    :open-delay="200"
    :close-delay="200"
  >
    <HoverCardTrigger as-child>
      <a
        :href="getBoostViewRouterUrl(VIEW_ROUTER_CHAT_PATH)"
        class="relative inline-flex size-9 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        :aria-label="
          messengerBadgeLabel ? `Chat (${messenger} unread)` : 'Chat'
        "
        @click="onChatNavClick"
      >
        <IconMessage class="size-5" />
        <span
          v-if="messengerBadgeLabel"
          class="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold tabular-nums leading-none text-white shadow-sm"
        >
          {{ messengerBadgeLabel }}
        </span>
      </a>
    </HoverCardTrigger>

    <HoverCardContent
      align="end"
      :side-offset="8"
      :class="
        cn(
          'w-[min(100vw-1.5rem,22rem)] border border-white/[0.08] bg-[#1c1f26] p-0 text-white shadow-xl',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        )
      "
    >
      <div class="border-b border-white/[0.06] px-3 py-2">
        <p class="text-sm font-semibold text-white">Recent chats</p>
      </div>

      <div class="max-h-[min(360px,55vh)] overflow-y-auto overflow-x-hidden">
        <div
          v-if="loading && items.length === 0"
          class="flex items-center justify-center gap-2 py-10 text-white/50"
        >
          <Spinner class="size-5" />
          <span class="text-sm">Laden…</span>
        </div>
        <p
          v-else-if="loadError"
          class="px-3 py-6 text-center text-sm text-rose-400"
        >
          {{ loadError }}
        </p>
        <p
          v-else-if="items.length === 0"
          class="px-3 py-8 text-center text-sm text-white/45"
        >
          Geen recente chats.
        </p>
        <ul v-else class="divide-y divide-white/[0.05]">
          <li
            v-for="chat in items"
            :key="String(chat.group_id)"
          >
            <button
              type="button"
              class="flex w-full cursor-pointer gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
              @click="openChat(chat, $event)"
            >
              <img
                :src="photoUrl(chat.primary_photo)"
                alt=""
                class="mt-0.5 size-10 shrink-0 rounded-full object-cover"
                @error="(e) => ((e.target as HTMLImageElement).src = FALLBACK_AVATAR)"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium text-white/90">
                  {{ chatDisplayName(chat) }}
                </p>
                <p class="truncate text-xs text-white/55">
                  {{ stripChatPreview(chat.last_message) }}
                </p>
                <p class="mt-0.5 text-[11px] text-white/35">
                  {{ chat.time_elapsed || chat.date_time }}
                </p>
              </div>
            </button>
          </li>
        </ul>
      </div>

      <div class="border-t border-white/[0.06] p-2">
        <Button
          type="button"
          variant="secondary"
          class="h-9 w-full bg-white/[0.06] text-white hover:bg-white/10"
          @click="onViewAllClick"
        >
          View All
        </Button>
      </div>
    </HoverCardContent>
  </HoverCard>
</template>
