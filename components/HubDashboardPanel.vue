<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { IconChevronRight } from '@tabler/icons-vue';

import { getFeedNotifications } from '@/lib/sdc-api/notifications';
import { getMessengerLatest } from '@/lib/sdc-api/messenger';
import { getLatestMembersV2, getViewedV2 } from '@/lib/sdc-api/people';
import type {
  FeedNotificationItem,
  MessengerChatItem,
  OnlineV2Member,
  ViewedV2Member,
} from '@/lib/sdc-api-types';
import { Avatar, AvatarFallback, AvatarImage } from '@/lib/view-router/ui/avatar';
import { Badge } from '@/lib/view-router/ui/badge';
import { Card } from '@/lib/view-router/ui/card';
import { Skeleton } from '@/lib/view-router/ui/skeleton';
import {
  getBoostProfilePath,
  getBoostViewRouterUrl,
  navigateBoostHubChatWithGroupId,
  navigateBoostViewRouterPath,
  VIEW_ROUTER_CHAT_PATH,
  VIEW_ROUTER_PEOPLE_FIELD_PATH,
  VIEW_ROUTER_PEOPLE_VISUALLY_PATH,
} from '@/lib/view-router/routes';

const LIMIT = 10;
const CACHE_TTL_MS = 60_000;
const CACHE_PREFIX = 'sdc_dash_';

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { ts: number; data: T };
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch { /* quota / private mode */ }
}

const FALLBACK_AVATAR =
  'https://www.sdc.com/react/assets/couple_male_female_silhouette.cae98680.svg';

const visited = ref<ViewedV2Member[]>([]);
const chats = ref<MessengerChatItem[]>([]);
const notifications = ref<FeedNotificationItem[]>([]);
const newMembers = ref<OnlineV2Member[]>([]);

const loadingVisited = ref(true);
const loadingChats = ref(true);
const loadingNotifications = ref(true);
const loadingNewMembers = ref(true);

const errorVisited = ref<string | null>(null);
const errorChats = ref<string | null>(null);
const errorNotifications = ref<string | null>(null);
const errorNewMembers = ref<string | null>(null);

function isBannerItem(item: unknown): boolean {
  return (
    typeof item === 'object' &&
    item !== null &&
    'banner' in item &&
    (item as { banner?: boolean }).banner === true
  );
}

function memberPhotoUrl(photo: string | undefined): string {
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

function genderColor(gender: number | undefined): string {
  return gender === 1 ? '#ff60df' : '#3a97fe';
}

function parseAges(ageStr: string | undefined): { first: string | null; second: string | null } {
  if (!ageStr) return { first: null, second: null };
  const parts = ageStr.split('|');
  return { first: parts[0]?.trim() || null, second: parts[1]?.trim() || null };
}

function isRealAge(val: string | null): boolean {
  if (!val) return false;
  const n = parseInt(val, 10);
  return !isNaN(n) && n >= 18 && n <= 100;
}

function openProfile(userId: number) {
  navigateBoostViewRouterPath(getBoostProfilePath(userId));
}

function openChat(chat: MessengerChatItem) {
  navigateBoostHubChatWithGroupId(chat.group_id);
}

function profileHref(userId: number): string {
  return getBoostViewRouterUrl(getBoostProfilePath(userId));
}

onMounted(() => {
  void (async () => {
    const cached = readCache<ViewedV2Member[]>('visited');
    if (cached) { visited.value = cached; loadingVisited.value = false; return; }
    try {
      const res = await getViewedV2({
        page: 0, gender: 9, pictures: 1, business_profile: 1,
        select: 1, order: 1, map: 0,
      });
      if (res.info.code !== 200) throw new Error(`API code ${res.info.code}`);
      const list = (res.info.viewedmembers ?? [])
        .filter((item) => !isBannerItem(item))
        .slice(0, LIMIT) as ViewedV2Member[];
      visited.value = list;
      writeCache('visited', list);
    } catch (e) {
      console.error('[HubDashboard] viewed', e);
      errorVisited.value = e instanceof Error ? e.message : 'Laden mislukt.';
    } finally {
      loadingVisited.value = false;
    }
  })();

  void (async () => {
    const cached = readCache<MessengerChatItem[]>('chats');
    if (cached) { chats.value = cached; loadingChats.value = false; return; }
    try {
      const res = await getMessengerLatest(0);
      const list = (res.info.chat_list ?? []).slice(0, LIMIT);
      chats.value = list;
      writeCache('chats', list);
    } catch (e) {
      console.error('[HubDashboard] chats', e);
      errorChats.value = e instanceof Error ? e.message : 'Laden mislukt.';
    } finally {
      loadingChats.value = false;
    }
  })();

  void (async () => {
    const cached = readCache<FeedNotificationItem[]>('notifs');
    if (cached) { notifications.value = cached; loadingNotifications.value = false; return; }
    try {
      const res = await getFeedNotifications({ page: 0 });
      if (res.info.code !== 200) throw new Error(`API code ${res.info.code}`);
      const list = (res.info.notifications ?? []).slice(0, LIMIT);
      notifications.value = list;
      writeCache('notifs', list);
    } catch (e) {
      console.error('[HubDashboard] notifications', e);
      errorNotifications.value = e instanceof Error ? e.message : 'Laden mislukt.';
    } finally {
      loadingNotifications.value = false;
    }
  })();

  void (async () => {
    const cached = readCache<OnlineV2Member[]>('newMembers');
    if (cached) { newMembers.value = cached; loadingNewMembers.value = false; return; }
    try {
      const res = await getLatestMembersV2({
        page: 0, gender: 1, looking_for_me: 0,
        pictures: 1, business_profile: 1, map: 0,
      });
      if (res.info.code !== 200) throw new Error(`API code ${res.info.code}`);
      const list = (res.info.latestmembers ?? [])
        .filter((item) => !isBannerItem(item))
        .slice(0, LIMIT) as OnlineV2Member[];
      newMembers.value = list;
      writeCache('newMembers', list);
    } catch (e) {
      console.error('[HubDashboard] latest members', e);
      errorNewMembers.value = e instanceof Error ? e.message : 'Laden mislukt.';
    } finally {
      loadingNewMembers.value = false;
    }
  })();
});
</script>

<template>
  <div class="dashboard-root flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
    <div class="dash-scroll">
    <div class="dash-grid">

      <!-- Bekeken jou -->
      <Card class="dash-section gap-0 border border-white/[0.07] bg-white/[0.02] py-0 shadow-none" style="--dash-delay: 0">
        <div class="dash-section-header">
          <div class="dash-section-icon" style="--accent: #3a97fe">
            <Icon icon="mdi:eye-outline" width="16" height="16" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="dash-section-title">Bekeken jou</h2>
          </div>
          <button type="button" class="dash-see-all" @click="navigateBoostViewRouterPath(VIEW_ROUTER_PEOPLE_VISUALLY_PATH)">
            Alles <IconChevronRight class="size-3.5" />
          </button>
        </div>
        <div class="dash-section-body">
          <div v-if="loadingVisited" class="space-y-0 px-2 py-3" aria-busy="true">
            <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-2 py-2">
              <Skeleton class="size-9 shrink-0 rounded-full bg-white/10" />
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton class="h-3 w-[58%] rounded-md bg-white/10" />
                <Skeleton class="h-2.5 w-[36%] rounded-md bg-white/10" />
              </div>
            </div>
          </div>
          <p v-else-if="errorVisited" class="dash-error">{{ errorVisited }}</p>
          <p v-else-if="visited.length === 0" class="dash-empty">Niemand recent.</p>
          <ul v-else class="dash-list">
            <li v-for="m in visited" :key="m.db_id">
              <a
                :href="profileHref(m.db_id)"
                class="dash-row"
                @click.prevent="openProfile(m.db_id)"
              >
                <div class="dash-row-avatar">
                  <Avatar class="size-9 border border-white/[0.06]">
                    <AvatarImage
                      :src="memberPhotoUrl(m.primary_photo)"
                      alt=""
                      class="object-cover"
                      @error="(e: Event) => ((e.target as HTMLImageElement).src = FALLBACK_AVATAR)"
                    />
                    <AvatarFallback class="text-[10px]">?</AvatarFallback>
                  </Avatar>
                  <span v-if="m.online === 1" class="dash-online-dot" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="dash-row-name">{{ m.account_id }}</span>
                    <span class="dash-row-ages">
                      <span :style="{ color: genderColor(m.gender1) }">{{ parseAges(m.age).first }}</span>
                      <template v-if="parseAges(m.age).second && isRealAge(parseAges(m.age).second)">
                        <span class="age-sep">|</span>
                        <span :style="{ color: genderColor(m.gender2) }">{{ parseAges(m.age).second }}</span>
                      </template>
                    </span>
                  </div>
                  <p class="dash-row-meta">{{ m.timed }}</p>
                </div>
              </a>
            </li>
          </ul>
        </div>
      </Card>

      <!-- Laatste chats -->
      <section class="dash-section" style="--dash-delay: 1">
        <div class="dash-section-header">
          <div class="dash-section-icon" style="--accent: #22c55e">
            <Icon icon="mdi:chat-outline" width="16" height="16" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="dash-section-title">Laatste chats</h2>
          </div>
          <button type="button" class="dash-see-all" @click="navigateBoostViewRouterPath(VIEW_ROUTER_CHAT_PATH)">
            Alles <IconChevronRight class="size-3.5" />
          </button>
        </div>
        <div class="dash-section-body">
          <div v-if="loadingChats" class="space-y-0 px-2 py-3" aria-busy="true">
            <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-2 py-2">
              <Skeleton class="size-9 shrink-0 rounded-full bg-white/10" />
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton class="h-3 w-[58%] rounded-md bg-white/10" />
                <Skeleton class="h-2.5 w-[36%] rounded-md bg-white/10" />
              </div>
            </div>
          </div>
          <p v-else-if="errorChats" class="dash-error">{{ errorChats }}</p>
          <p v-else-if="chats.length === 0" class="dash-empty">Geen chats.</p>
          <ul v-else class="dash-list">
            <li v-for="c in chats" :key="String(c.group_id)">
              <button type="button" class="dash-row" @click="openChat(c)">
                <div class="dash-row-avatar">
                  <Avatar class="size-9 border border-white/[0.06]">
                    <AvatarImage
                      :src="memberPhotoUrl(c.primary_photo)"
                      alt=""
                      class="object-cover"
                      @error="(e: Event) => ((e.target as HTMLImageElement).src = FALLBACK_AVATAR)"
                    />
                    <AvatarFallback class="text-[10px]">?</AvatarFallback>
                  </Avatar>
                  <span v-if="c.online === 1" class="dash-online-dot" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="dash-row-name">{{ chatDisplayName(c) }}</span>
                    <Badge
                      v-if="c.unread_counter > 0"
                      variant="destructive"
                      class="h-4 min-w-4 shrink-0 rounded-lg px-1 text-[10px] font-semibold leading-none tabular-nums"
                    >{{ c.unread_counter > 99 ? '99+' : c.unread_counter }}</Badge>
                  </div>
                  <p class="dash-row-preview">{{ stripChatPreview(c.last_message) }}</p>
                </div>
                <span class="dash-row-time-right">{{ c.time_elapsed || c.date_time }}</span>
              </button>
            </li>
          </ul>
        </div>
      </section>

      <!-- Meldingen -->
      <Card class="dash-section gap-0 border border-white/[0.07] bg-white/[0.02] py-0 shadow-none" style="--dash-delay: 2">
        <div class="dash-section-header">
          <div class="dash-section-icon" style="--accent: #f59e0b">
            <Icon icon="mdi:bell-outline" width="16" height="16" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="dash-section-title">Meldingen</h2>
          </div>
        </div>
        <div class="dash-section-body">
          <div v-if="loadingNotifications" class="space-y-0 px-2 py-3" aria-busy="true">
            <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-2 py-2">
              <Skeleton class="size-9 shrink-0 rounded-full bg-white/10" />
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton class="h-3 w-[58%] rounded-md bg-white/10" />
                <Skeleton class="h-2.5 w-[36%] rounded-md bg-white/10" />
              </div>
            </div>
          </div>
          <p v-else-if="errorNotifications" class="dash-error">{{ errorNotifications }}</p>
          <p v-else-if="notifications.length === 0" class="dash-empty">Geen meldingen.</p>
          <ul v-else class="dash-list">
            <li v-for="n in notifications" :key="n.id">
              <button type="button" class="dash-row" @click="openProfile(n.sender.db_id)">
                <div class="dash-row-avatar">
                  <Avatar class="size-9 border border-white/[0.06]">
                    <AvatarImage
                      :src="memberPhotoUrl(n.sender.primary_photo)"
                      alt=""
                      class="object-cover"
                      @error="(e: Event) => ((e.target as HTMLImageElement).src = FALLBACK_AVATAR)"
                    />
                    <AvatarFallback class="text-[10px]">?</AvatarFallback>
                  </Avatar>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="dash-row-name truncate">{{ formatNotificationTitle(n.post.title, n.post) }}</p>
                  <p class="dash-row-meta">{{ n.sender.account_id }}</p>
                </div>
                <span class="dash-row-time-right">{{ n.timed }}</span>
              </button>
            </li>
          </ul>
        </div>
      </Card>

      <!-- Nieuwe leden -->
      <Card class="dash-section gap-0 border border-white/[0.07] bg-white/[0.02] py-0 shadow-none" style="--dash-delay: 3">
        <div class="dash-section-header">
          <div class="dash-section-icon" style="--accent: #ff60df">
            <Icon icon="mdi:account-plus-outline" width="16" height="16" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="dash-section-title">Nieuwe leden</h2>
          </div>
          <button type="button" class="dash-see-all" @click="navigateBoostViewRouterPath(VIEW_ROUTER_PEOPLE_FIELD_PATH)">
            Alles <IconChevronRight class="size-3.5" />
          </button>
        </div>
        <div class="dash-section-body">
          <div v-if="loadingNewMembers" class="space-y-0 px-2 py-3" aria-busy="true">
            <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-2 py-2">
              <Skeleton class="size-9 shrink-0 rounded-full bg-white/10" />
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton class="h-3 w-[58%] rounded-md bg-white/10" />
                <Skeleton class="h-2.5 w-[36%] rounded-md bg-white/10" />
              </div>
            </div>
          </div>
          <p v-else-if="errorNewMembers" class="dash-error">{{ errorNewMembers }}</p>
          <p v-else-if="newMembers.length === 0" class="dash-empty">Geen leden gevonden.</p>
          <ul v-else class="dash-list">
            <li v-for="m in newMembers" :key="m.db_id">
              <a
                :href="profileHref(m.db_id)"
                class="dash-row"
                @click.prevent="openProfile(m.db_id)"
              >
                <div class="dash-row-avatar">
                  <Avatar class="size-9 border border-white/[0.06]">
                    <AvatarImage
                      :src="memberPhotoUrl(m.primary_photo)"
                      alt=""
                      class="object-cover"
                      @error="(e: Event) => ((e.target as HTMLImageElement).src = FALLBACK_AVATAR)"
                    />
                    <AvatarFallback class="text-[10px]">?</AvatarFallback>
                  </Avatar>
                  <span v-if="m.online === 1" class="dash-online-dot" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="dash-row-name">{{ m.account_id }}</span>
                    <span class="dash-row-ages">
                      <span :style="{ color: genderColor(m.gender1) }">{{ parseAges(m.age).first }}</span>
                      <template v-if="parseAges(m.age).second && isRealAge(parseAges(m.age).second)">
                        <span class="age-sep">|</span>
                        <span :style="{ color: genderColor(m.gender2) }">{{ parseAges(m.age).second }}</span>
                      </template>
                    </span>
                  </div>
                  <p class="dash-row-meta">{{ m.location }}</p>
                </div>
              </a>
            </li>
          </ul>
        </div>
      </Card>

    </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── Grid: equal 2×2 on ≥1024 px, stacked on mobile ───────── */

.dashboard-root {
  --dash-avatar-size: 36px;
}

.dash-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.dash-grid {
  display: grid;
  grid-template-columns: 1fr;
  grid-auto-rows: auto;
  gap: 16px;
}

@media (min-width: 1024px) {
  .dash-scroll {
    overflow: hidden;
    display: flex;
  }

  .dash-grid {
    flex: 1;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }
}

.dash-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  animation: dash-fade-in 0.3s ease both;
  animation-delay: calc(var(--dash-delay, 0) * 50ms);
}

@keyframes dash-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ─── Section header ────────────────────────────────────────── */

.dash-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.015);
  flex-shrink: 0;
  border-radius: 12px 12px 0 0;
}

.dash-section-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
  flex-shrink: 0;
}

.dash-section-title {
  font-size: 13px;
  font-weight: 600;
  color: white;
  line-height: 1;
}

.dash-see-all {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
  flex-shrink: 0;
  white-space: nowrap;
}

.dash-see-all:hover {
  background: rgba(255, 255, 255, 0.04);
}

/* ─── Section body (scrollable list area) ───────────────────── */

.dash-section-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
}

.dash-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 16px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 13px;
}

.dash-error {
  padding: 40px 16px;
  text-align: center;
  font-size: 13px;
  color: #f87171;
}

.dash-empty {
  padding: 40px 16px;
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.35);
}

/* ─── List rows (uniform across all four sections) ──────────── */

.dash-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.dash-list > li + li {
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.dash-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 14px;
  text-align: left;
  text-decoration: none;
  color: inherit;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.12s ease;
}

.dash-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

/* Avatar */
.dash-row-avatar {
  position: relative;
  width: var(--dash-avatar-size);
  height: var(--dash-avatar-size);
  flex-shrink: 0;
}

.dash-row-avatar img {
  width: var(--dash-avatar-size);
  height: var(--dash-avatar-size);
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* Online dot */
.dash-online-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 9px;
  height: 9px;
  background: #22c55e;
  border-radius: 50%;
  border: 2px solid var(--background);
}

/* Text elements */
.dash-row-name {
  font-size: 12px;
  font-weight: 600;
  color: white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex-shrink: 1;
}

.dash-row-ages {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.dash-row-ages .age-sep {
  color: rgba(255, 255, 255, 0.15);
  font-size: 10px;
}

.dash-row-preview {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.40);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
  line-height: 1.4;
}

.dash-row-meta {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.30);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
  line-height: 1.4;
}

.dash-row-time-right {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

.dash-unread {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 16px;
  min-width: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--destructive);
  color: white;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  flex-shrink: 0;
}
</style>
