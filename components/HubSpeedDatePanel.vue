<script setup lang="ts">
import type { DateValue } from '@internationalized/date';
import { DateFormatter, getLocalTimeZone, parseDate, today, toCalendarDate } from '@internationalized/date';
import { Calendar as CalendarIcon, ChevronDown, MapPin } from 'lucide-vue-next';
import { useDebounceFn } from '@vueuse/core';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import SpeedDateCard from '@/components/SpeedDateCard.vue';
import SpeedDateCreateDialog from '@/components/SpeedDateCreateDialog.vue';
import SpeedDateMyDialog from '@/components/SpeedDateMyDialog.vue';
import {
  getMySpeedDates,
  getSpeedDatingV2,
  parseNextPageFromUrlMore,
} from '@/lib/sdc-api/speed-dating';
import { formatDaysForApi } from '@/lib/speed-date-interests';
import { getProfileV2 } from '@/lib/sdc-api/profile';
import {
  parsePlaceLatLon,
  searchLocationPlaces,
  type LocationSearchPlace,
} from '@/lib/sdc-api/location-search';
import { resolvePeopleApiMuid } from '@/lib/sdc-api/session-credentials';
import type { SpeedDatingV2Item } from '@/lib/sdc-api-types';
import {
  loadSpeedDateFilters,
  saveSpeedDateFilters,
  SPEED_DATE_FILTERS_VERSION,
  type SpeedDateFiltersStored,
} from '@/lib/speed-date-filters-storage';
import { cn } from '@/lib/utils';
import { Button } from '@/lib/view-router/ui/button';
import { Calendar } from '@/lib/view-router/ui/calendar';
import { Checkbox } from '@/lib/view-router/ui/checkbox';
import { Input } from '@/lib/view-router/ui/input';
import { Label } from '@/lib/view-router/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/lib/view-router/ui/popover';
import { Skeleton } from '@/lib/view-router/ui/skeleton';

/** Matches `hub-skeleton.css` `.hub-skeleton-live-card` */
const hubSkLiveCard =
  'overflow-hidden rounded-[10px] border border-white/[0.04] bg-[#1a1d21]';
/** Matches `hub-skeleton.css` `.hub-skeleton-shimmer` */
const hubSkShimmer =
  'bg-[linear-gradient(90deg,#16181c_25%,#1e2227_50%,#16181c_75%)] bg-[length:200%_100%] animate-hub-shimmer';

const speedGridClass =
  'grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5';

const sdInputClass =
  'h-8 min-h-8 text-[13px] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:border-white/20 focus-visible:ring-0';

const props = defineProps<{
  getProfileHref?: (userId: number) => string;
}>();

const initialFilters = loadSpeedDateFilters();

function parseInitialFilterDate(iso: string | null): DateValue | undefined {
  if (!iso) return undefined;
  try {
    return parseDate(iso);
  } catch {
    return undefined;
  }
}

const items = ref<SpeedDatingV2Item[]>([]);
/** True until first mount load finishes — avoids empty Selects + empty list flash before `onMounted` runs. */
const bootstrapping = ref(true);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref<string | null>(null);
const loadMoreError = ref<string | null>(null);
const pageLoaded = ref(0);
const urlMore = ref<string | null>(null);
const allowPost = ref(true);

const mySpeedItems = ref<SpeedDatingV2Item[]>([]);

const lat = ref(initialFilters.lat);
const lon = ref(initialFilters.lon);

const filterPrive = ref(initialFilters.filterPrive);
const filterOpenbaar = ref(initialFilters.filterOpenbaar);
const filterVirtueel = ref(initialFilters.filterVirtueel);

const locationSearch = computed(() =>
  `${filterPrive.value ? '1' : '0'}${filterOpenbaar.value ? '1' : '0'}${filterVirtueel.value ? '1' : '0'}`,
);

function toggleLocFilter(which: 'prive' | 'openbaar' | 'virtueel') {
  const refs = { prive: filterPrive, openbaar: filterOpenbaar, virtueel: filterVirtueel };
  const target = refs[which];
  const checkedCount = [filterPrive.value, filterOpenbaar.value, filterVirtueel.value].filter(Boolean).length;
  if (target.value && checkedCount <= 1) return;
  target.value = !target.value;
}

const orderStr = ref(initialFilters.orderStr);
const distance = ref(initialFilters.distance);
const pickedFilterDate = ref<DateValue | undefined>(parseInitialFilterDate(initialFilters.dateIso));
const datePickerOpen = ref(false);
const tz = getLocalTimeZone();
const dateFormatter = new DateFormatter('nl-NL', { dateStyle: 'long' });
const dateDefaultPlaceholder = today(tz);
const ageFromStr = ref(initialFilters.ageFromStr);
const ageUntilStr = ref(initialFilters.ageUntilStr);
const gender = ref(initialFilters.gender);
const lookingForMe = ref(initialFilters.lookingForMe);

const createOpen = ref(false);
const myOpen = ref(false);
/** Skip filter watch until initial load + profile coords complete */
const listFiltersReady = ref(false);
/** Avoid duplicate list loads while `resetFilters` runs */
const filterResetInProgress = ref(false);
/** False until after first paint post-bootstrap — avoids reset firing before UI is stable */
const allowFilterReset = ref(false);
/** Skip persisting until bootstrap finished so hydrateCoords lat/lon updates do not race debounced save */
const persistReady = ref(false);

const placeSearchQuery = ref(initialFilters.placeSearchQuery);
const placeSearchResults = ref<LocationSearchPlace[]>([]);
const placeSearchLoading = ref(false);
const placeSearchError = ref<string | null>(null);
const placeSearchEmpty = ref(false);
const placeInputFocused = ref(false);
/** Avoid re-querying when we fill the field from a chosen result */
const skipNextPlaceSearch = ref(initialFilters.placeSearchQuery.trim().length > 0);

function buildSpeedDateFiltersSnapshot(): SpeedDateFiltersStored {
  return {
    v: SPEED_DATE_FILTERS_VERSION,
    filterPrive: filterPrive.value,
    filterOpenbaar: filterOpenbaar.value,
    filterVirtueel: filterVirtueel.value,
    orderStr: orderStr.value,
    distance: distance.value,
    dateIso: pickedFilterDate.value ? toCalendarDate(pickedFilterDate.value).toString() : null,
    ageFromStr: ageFromStr.value,
    ageUntilStr: ageUntilStr.value,
    gender: gender.value,
    lookingForMe: lookingForMe.value,
    lat: lat.value,
    lon: lon.value,
    placeSearchQuery: placeSearchQuery.value,
  };
}

const persistSpeedDateFilters = useDebounceFn(() => {
  if (filterResetInProgress.value || !persistReady.value) return;
  saveSpeedDateFilters(buildSpeedDateFiltersSnapshot());
}, 300);

watch(
  () => [
    filterPrive.value,
    filterOpenbaar.value,
    filterVirtueel.value,
    orderStr.value,
    distance.value,
    pickedFilterDate.value,
    ageFromStr.value,
    ageUntilStr.value,
    gender.value,
    lookingForMe.value,
    lat.value,
    lon.value,
    placeSearchQuery.value,
  ],
  () => {
    if (!persistReady.value) return;
    persistSpeedDateFilters();
  },
);

const showPlaceDropdown = computed(
  () =>
    placeInputFocused.value &&
    placeSearchQuery.value.trim().length >= 2 &&
    (placeSearchLoading.value ||
      placeSearchResults.value.length > 0 ||
      placeSearchError.value != null ||
      placeSearchEmpty.value),
);

const runPlaceSearch = useDebounceFn(async (raw: string) => {
  const q = raw.trim();
  if (q.length < 2) {
    placeSearchResults.value = [];
    placeSearchError.value = null;
    placeSearchEmpty.value = false;
    placeSearchLoading.value = false;
    return;
  }
  placeSearchLoading.value = true;
  placeSearchError.value = null;
  placeSearchEmpty.value = false;
  try {
    const list = await searchLocationPlaces(q);
    placeSearchResults.value = list;
    placeSearchEmpty.value = list.length === 0;
  } catch (e) {
    placeSearchResults.value = [];
    placeSearchEmpty.value = false;
    placeSearchError.value = e instanceof Error ? e.message : 'Zoeken mislukt.';
  } finally {
    placeSearchLoading.value = false;
  }
}, 300);

watch(placeSearchQuery, (q) => {
  if (skipNextPlaceSearch.value) {
    skipNextPlaceSearch.value = false;
    return;
  }
  if (q.trim().length < 2) {
    placeSearchResults.value = [];
    placeSearchError.value = null;
    placeSearchEmpty.value = false;
    placeSearchLoading.value = false;
    return;
  }
  placeSearchLoading.value = true;
  placeSearchError.value = null;
  void runPlaceSearch(q);
});

function selectPlace(p: LocationSearchPlace) {
  const { lat: la, lon: lo } = parsePlaceLatLon(p);
  if (!Number.isNaN(la) && !Number.isNaN(lo)) {
    lat.value = la;
    lon.value = lo;
  }
  skipNextPlaceSearch.value = true;
  placeSearchQuery.value = p.display_name;
  placeSearchResults.value = [];
  placeSearchError.value = null;
  placeSearchEmpty.value = false;
  placeInputFocused.value = false;
}

function onPlaceInputBlur() {
  window.setTimeout(() => {
    placeInputFocused.value = false;
  }, 180);
}

const hasMySpeeddates = computed(() => mySpeedItems.value.length > 0);

const hasMore = computed(() => {
  const u = urlMore.value?.trim();
  return Boolean(u && u.length > 0);
});

function onMySpeeddatesChanged() {
  void refreshMySpeed();
  void loadList(true);
}

async function hydrateCoords() {
  try {
    const id = await resolvePeopleApiMuid();
    const res = await getProfileV2(id);
    const u = res.info.profile_user;
    if (typeof u.lat === 'number') lat.value = u.lat;
    if (typeof u.lon === 'number') lon.value = u.lon;
  } catch {
    /* defaults */
  }
}

async function resetFilters() {
  filterResetInProgress.value = true;
  try {
    filterPrive.value = true;
    filterOpenbaar.value = true;
    filterVirtueel.value = true;
    orderStr.value = '1';
    distance.value = 500;
    pickedFilterDate.value = undefined;
    datePickerOpen.value = false;
    ageFromStr.value = '';
    ageUntilStr.value = '';
    skipNextPlaceSearch.value = true;
    placeSearchQuery.value = '';
    placeSearchResults.value = [];
    placeSearchError.value = null;
    placeSearchEmpty.value = false;
    placeSearchLoading.value = false;
    placeInputFocused.value = false;
    await hydrateCoords();
    await loadList(true);
  } finally {
    filterResetInProgress.value = false;
    saveSpeedDateFilters(buildSpeedDateFiltersSnapshot());
  }
}

const ageFrom = computed(() => {
  const n = Number(ageFromStr.value);
  return ageFromStr.value === '' || Number.isNaN(n) ? -1 : n;
});
const ageUntil = computed(() => {
  const n = Number(ageUntilStr.value);
  return ageUntilStr.value === '' || Number.isNaN(n) ? -1 : n;
});

const dateButtonLabel = computed(() => {
  const v = pickedFilterDate.value;
  if (!v) return 'Kies een datum';
  return dateFormatter.format(toCalendarDate(v).toDate(tz));
});

function apiDateFilter(): string {
  const v = pickedFilterDate.value;
  if (!v) return '';
  const d = toCalendarDate(v).toDate(tz);
  d.setHours(12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return '';
  return formatDaysForApi(d);
}

function clearDateFilter() {
  pickedFilterDate.value = undefined;
}

function buildParams(overrides: { page?: number } = {}) {
  const p: Parameters<typeof getSpeedDatingV2>[0] = {
    gender: gender.value,
    looking_for_me: lookingForMe.value,
    distance: distance.value,
    order: Number(orderStr.value) || 0,
    quickFilter: 0,
    date: apiDateFilter(),
    country: '',
    lat: lat.value,
    lon: lon.value,
    locationSearch: locationSearch.value,
    map: 0,
    ageFrom: ageFrom.value,
    ageUntil: ageUntil.value,
    page: overrides.page ?? 0,
  };
  return p;
}

async function loadList(reset: boolean) {
  if (reset) {
    loading.value = true;
    pageLoaded.value = 0;
    urlMore.value = null;
    items.value = [];
  }
  error.value = null;
  loadMoreError.value = null;
  try {
    const res = await getSpeedDatingV2(buildParams({ page: 0 }));
    items.value = res.info.speeddating ?? [];
    urlMore.value = res.info.url_more?.trim() ?? null;
    allowPost.value = res.info.allow_post !== false;
    pageLoaded.value = 0;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Laden mislukt.';
    if (reset) items.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value || loading.value) return;
  const next = parseNextPageFromUrlMore(urlMore.value ?? undefined);
  if (next == null) return;
  loadingMore.value = true;
  loadMoreError.value = null;
  try {
    const res = await getSpeedDatingV2(buildParams({ page: next }));
    const batch = res.info.speeddating ?? [];
    const seen = new Set(items.value.map((x) => x.db_id));
    for (const row of batch) {
      if (!seen.has(row.db_id)) {
        seen.add(row.db_id);
        items.value.push(row);
      }
    }
    urlMore.value = res.info.url_more?.trim() ?? null;
    pageLoaded.value = next;
  } catch (e) {
    loadMoreError.value = e instanceof Error ? e.message : 'Meer laden mislukt.';
  } finally {
    loadingMore.value = false;
  }
}

async function refreshMySpeed() {
  try {
    const res = await getMySpeedDates();
    mySpeedItems.value = res.info.speeddating ?? [];
  } catch {
    mySpeedItems.value = [];
  }
}

function openCreate() {
  if (!allowPost.value) return;
  createOpen.value = true;
}

function onCreateSuccess() {
  void loadList(true);
  void refreshMySpeed();
}

onMounted(async () => {
  const useSavedPlace = placeSearchQuery.value.trim().length > 0;
  if (!useSavedPlace) {
    await hydrateCoords();
  }
  await loadList(true);
  await refreshMySpeed();
  listFiltersReady.value = true;
  bootstrapping.value = false;
  persistReady.value = true;
  await nextTick();
  allowFilterReset.value = true;
});

onBeforeUnmount(() => {
  if (!persistReady.value || filterResetInProgress.value) return;
  saveSpeedDateFilters(buildSpeedDateFiltersSnapshot());
});

watch(
  () => [
    filterPrive.value,
    filterOpenbaar.value,
    filterVirtueel.value,
    orderStr.value,
    distance.value,
    pickedFilterDate.value,
    ageFromStr.value,
    ageUntilStr.value,
    gender.value,
    lookingForMe.value,
    lat.value,
    lon.value,
  ],
  () => {
    if (!listFiltersReady.value || filterResetInProgress.value) return;
    void loadList(true);
  },
);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0c0d10]">
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <!-- First paint: no real Selects yet (avoids empty placeholder flash). -->
      <div
        v-if="bootstrapping"
        class="flex min-h-0 flex-1 flex-col"
        aria-busy="true"
        aria-label="Speed Date laden"
      >
        <div class="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0c0d10]/95 px-4 py-3 backdrop-blur">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 flex-1 space-y-2">
              <Skeleton class="h-5 w-36 rounded-md bg-white/10" />
              <Skeleton class="h-3 w-full max-w-md rounded-md bg-white/10" />
            </div>
            <div class="flex shrink-0 gap-2 self-end sm:self-auto">
              <Skeleton class="h-8 w-[8.5rem] rounded-md bg-white/10" />
              <Skeleton class="h-8 w-[8.5rem] rounded-md bg-white/10" />
            </div>
          </div>
          <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div v-for="n in 8" :key="`sk-f-${n}`" class="space-y-1.5">
              <Skeleton class="h-3 w-24 rounded-md bg-white/10" />
              <Skeleton class="h-9 w-full rounded-md bg-white/10" />
            </div>
          </div>
        </div>
        <div class="px-4 py-4">
          <div :class="speedGridClass">
            <div v-for="n in 12" :key="`sk-c-${n}`" :class="cn(hubSkLiveCard)">
              <div :class="cn('aspect-square w-full rounded-t-[10px]', hubSkShimmer)" />
              <div class="flex flex-col gap-2 p-2.5">
                <div :class="cn('h-2.5 w-[72%] rounded-md', hubSkShimmer)" />
                <div :class="cn('h-2.5 w-[48%] rounded-md', hubSkShimmer)" />
                <div :class="cn('h-2.5 w-[88%] rounded-md', hubSkShimmer)" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <template v-else>
        <div
          class="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0c0d10]/95 px-4 py-3 backdrop-blur"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 class="text-lg font-semibold text-white">Speed Date</h1>
              <p class="mt-0.5 text-xs text-white/45">
                Speeddates in jouw omgeving — filter op soort, plaats, afstand en datum.
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button
                v-if="hasMySpeeddates"
                type="button"
                size="sm"
                variant="secondary"
                class="h-8"
                @click="myOpen = true"
              >
                Mijn speeddates
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                class="h-8"
                :disabled="!allowPost"
                :title="!allowPost ? 'Plaatsen niet toegestaan' : 'Nieuwe speeddate'"
                @click="openCreate"
              >
                Plaats speeddate
              </Button>
            </div>
          </div>

          <!-- Kind: privé / openbaar / virtueel (API locationSearch bitmask) -->
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <span class="text-[11px] font-medium uppercase tracking-wider text-white/40">Soort</span>
            <button
              type="button"
              :class="
                cn(
                  'inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border py-[5px] pl-2 pr-3 text-xs font-medium leading-none transition-all duration-150 ease-in-out',
                  filterPrive
                    ? 'border-white/[0.14] bg-white/[0.08] text-white/90'
                    : 'border-white/[0.06] bg-white/[0.04] text-white/50 hover:bg-white/[0.07] hover:text-white/70',
                )
              "
              @click="toggleLocFilter('prive')"
            >
              <Checkbox
                :model-value="filterPrive"
                class="pointer-events-none size-3.5"
                tabindex="-1"
              />
              <span>Privé</span>
            </button>
            <button
              type="button"
              :class="
                cn(
                  'inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border py-[5px] pl-2 pr-3 text-xs font-medium leading-none transition-all duration-150 ease-in-out',
                  filterOpenbaar
                    ? 'border-white/[0.14] bg-white/[0.08] text-white/90'
                    : 'border-white/[0.06] bg-white/[0.04] text-white/50 hover:bg-white/[0.07] hover:text-white/70',
                )
              "
              @click="toggleLocFilter('openbaar')"
            >
              <Checkbox
                :model-value="filterOpenbaar"
                class="pointer-events-none size-3.5"
                tabindex="-1"
              />
              <span>Openbaar</span>
            </button>
            <button
              type="button"
              :class="
                cn(
                  'inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border py-[5px] pl-2 pr-3 text-xs font-medium leading-none transition-all duration-150 ease-in-out',
                  filterVirtueel
                    ? 'border-white/[0.14] bg-white/[0.08] text-white/90'
                    : 'border-white/[0.06] bg-white/[0.04] text-white/50 hover:bg-white/[0.07] hover:text-white/70',
                )
              "
              @click="toggleLocFilter('virtueel')"
            >
              <Checkbox
                :model-value="filterVirtueel"
                class="pointer-events-none size-3.5"
                tabindex="-1"
              />
              <span>Virtueel</span>
            </button>
          </div>

          <!-- Compact filter row -->
          <div class="mt-3 grid grid-cols-2 gap-x-2.5 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
            <div class="flex flex-col gap-1">
              <Label class="text-[10px] font-medium uppercase tracking-wider text-white/35">Sortering</Label>
              <div class="relative">
                <select
                  :value="orderStr"
                  class="h-8 w-full appearance-none rounded-md border border-white/[0.08] bg-white/[0.04] px-2 pr-8 text-[13px] text-white outline-none transition-colors focus:border-white/20 focus:outline-none focus:ring-0 [&>option]:bg-[#1a1b1f]"
                  @change="orderStr = ($event.target as HTMLSelectElement).value"
                >
                  <option value="1">Recent</option>
                  <option value="0">Oud</option>
                </select>
                <ChevronDown
                  class="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-[#999]"
                  aria-hidden="true"
                />
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-[10px] font-medium uppercase tracking-wider text-white/35">Afstand</Label>
              <div class="relative">
                <Input
                  v-model.number="distance"
                  type="number"
                  min="1"
                  max="2000"
                  :class="cn(sdInputClass, 'pr-8')"
                />
                <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-white/30">km</span>
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-[10px] font-medium uppercase tracking-wider text-white/35">Plaats</Label>
              <div class="relative">
                <MapPin
                  class="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-white/35"
                  aria-hidden="true"
                />
                <Input
                  v-model="placeSearchQuery"
                  type="search"
                  autocomplete="off"
                  placeholder="Stad of regio…"
                  :class="cn(sdInputClass, 'pl-8')"
                  @focus="placeInputFocused = true"
                  @blur="onPlaceInputBlur"
                />
                <div
                  v-if="showPlaceDropdown"
                  class="sd-place-dropdown absolute left-0 right-0 top-full z-50 mt-1 min-w-[min(100%,18rem)] rounded-md border border-white/[0.1] bg-[#141518] py-1 shadow-xl"
                  role="listbox"
                >
                  <ScrollArea class="max-h-52">
                    <div
                      v-if="placeSearchLoading"
                      class="px-3 py-2 text-xs text-white/45"
                    >
                      Zoeken…
                    </div>
                    <div
                      v-else-if="placeSearchError"
                      class="px-3 py-2 text-xs text-destructive"
                    >
                      {{ placeSearchError }}
                    </div>
                    <div
                      v-else-if="placeSearchEmpty"
                      class="px-3 py-2 text-xs text-white/45"
                    >
                      Geen resultaten
                    </div>
                    <button
                      v-for="p in placeSearchResults"
                      :key="p.place_id"
                      type="button"
                      role="option"
                      class="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-xs text-white/85 hover:bg-white/[0.06]"
                      @mousedown.prevent="selectPlace(p)"
                    >
                      <MapPin class="mt-0.5 size-3 shrink-0 text-white/35" aria-hidden="true" />
                      <span class="min-w-0 leading-snug">{{ p.display_name }}</span>
                    </button>
                  </ScrollArea>
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-[10px] font-medium uppercase tracking-wider text-white/35">Datum</Label>
              <Popover v-model:open="datePickerOpen">
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    variant="outline"
                    :class="
                      cn(
                        sdInputClass,
                        'w-full justify-start border-white/[0.08] bg-white/[0.04] text-left font-normal',
                        !pickedFilterDate && 'text-white/40',
                      )
                    "
                  >
                    <CalendarIcon class="mr-2 size-3.5 shrink-0 opacity-50" />
                    {{ dateButtonLabel }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" class="w-auto border border-white/[0.08] bg-[#1a1c1f] p-0 text-white shadow-xl">
                  <Calendar
                    v-model="pickedFilterDate"
                    locale="nl-NL"
                    layout="month-and-year"
                    :default-placeholder="dateDefaultPlaceholder"
                    initial-focus
                    class="rounded-md border-0 bg-transparent text-white"
                    @update:model-value="datePickerOpen = false"
                  />
                  <div class="border-t border-white/[0.06] px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="h-7 w-full text-xs text-white/50 hover:text-white"
                      @click="clearDateFilter(); datePickerOpen = false"
                    >
                      Filter wissen
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-[10px] font-medium uppercase tracking-wider text-white/35">Leeftijd</Label>
              <div class="flex items-center gap-1.5">
                <Input
                  v-model="ageFromStr"
                  type="number"
                  min="18"
                  max="100"
                  placeholder="van"
                  :class="cn(sdInputClass, 'min-w-0 flex-1')"
                />
                <span class="text-[11px] text-white/25">–</span>
                <Input
                  v-model="ageUntilStr"
                  type="number"
                  min="18"
                  max="100"
                  placeholder="tot"
                  :class="cn(sdInputClass, 'min-w-0 flex-1')"
                />
              </div>
            </div>
          </div>

          <div class="mt-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 text-xs text-white/45 hover:text-white/80 disabled:pointer-events-none disabled:opacity-40"
              :disabled="!allowFilterReset || loading || filterResetInProgress"
              @click="resetFilters"
            >
              Filters resetten
            </Button>
          </div>
        </div>

        <div class="px-4 py-4">
          <div
            v-if="error"
            class="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <p>{{ error }}</p>
            <Button type="button" variant="outline" size="sm" class="w-fit" @click="loadList(true)">
              Opnieuw proberen
            </Button>
          </div>

          <div
            v-else-if="loading"
            :class="speedGridClass"
            aria-busy="true"
            aria-label="Speeddates laden"
          >
            <div v-for="n in 12" :key="n" :class="cn(hubSkLiveCard)">
              <div :class="cn('aspect-square w-full rounded-t-[10px]', hubSkShimmer)" />
              <div class="flex flex-col gap-2 p-2.5">
                <div :class="cn('h-2.5 w-[72%] rounded-md', hubSkShimmer)" />
                <div :class="cn('h-2.5 w-[48%] rounded-md', hubSkShimmer)" />
                <div :class="cn('h-2.5 w-[88%] rounded-md', hubSkShimmer)" />
              </div>
            </div>
          </div>

          <template v-else>
            <div :class="speedGridClass">
              <SpeedDateCard
                v-for="row in items"
                :key="row.db_id"
                :item="row"
                :profile-href="getProfileHref ? getProfileHref(row.db_id) : undefined"
              />
            </div>

            <div v-if="loadMoreError" class="mt-3 text-center text-sm text-destructive">
              {{ loadMoreError }}
            </div>

            <div v-if="items.length === 0" class="py-12 text-center text-sm text-white/45">
              Geen speeddates gevonden met deze filters.
            </div>

            <div v-if="hasMore" class="mt-6 flex justify-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                :disabled="loadingMore"
                @click="loadMore"
              >
                {{ loadingMore ? 'Laden…' : 'Meer laden' }}
              </Button>
            </div>
          </template>
        </div>
      </template>
    </div>

    <SpeedDateCreateDialog
      v-model="createOpen"
      mode="create"
      :edit-id-speed="null"
      :initial="null"
      @success="onCreateSuccess"
    />

    <SpeedDateMyDialog
      v-model="myOpen"
      :items="mySpeedItems"
      @changed="onMySpeeddatesChanged"
    />
  </div>
</template>
