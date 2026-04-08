<script lang="ts" setup>
import { ref, computed } from 'vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/lib/view-router/ui/dropdown-menu';
import type { NewsfeedFilterOptions } from '@/lib/sdc-api/newsfeed';

interface Props {
  activeTab: 'feed' | 'admin';
  filters: Partial<NewsfeedFilterOptions>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'filters-change': [filters: Partial<NewsfeedFilterOptions>];
}>();

const contentFilterOpen = ref(false);
const activityFilterOpen = ref(false);

// Content type filter options (first dropdown) - "Algemeen" (General area)
const contentFilters = [
  { key: 'group_post_blog', label: 'Groepen / Blogs', icon: 'users' },
  { key: 'speed_area', label: 'Speed Date', icon: 'zap' },
  { key: 'travelplans_area', label: 'Reisplannen', icon: 'map' },
  { key: 'my_parties', label: "Party's & Events", icon: 'party' },
];

// Activity filter options (second dropdown) - "Vrienden" (Friends area)
const activityFilters = [
  { key: 'likes_sent', label: 'Likes gegeven', icon: 'heart' },
  { key: 'group_joined', label: 'Groepslid geworden', icon: 'user-plus' },
  { key: 'photos_videos', label: "Foto's & Video's", icon: 'image' },
  { key: 'validations', label: 'Validaties', icon: 'check' },
  { key: 'birthday', label: 'Verjaardag', icon: 'cake' },
  { key: 'speedating', label: 'Speed Date (Vrienden)', icon: 'zap' },
  { key: 'travelplans', label: 'Reisplannen (Vrienden)', icon: 'map' },
  { key: 'parties', label: "Party's & Events", icon: 'party' },
  { key: 'member_services', label: 'Ledenservice', icon: 'info' },
  { key: 'friends_new', label: 'Nieuwe vrienden / volgers', icon: 'users' },
];

const toggleContentFilter = (key: string) => {
  const newFilters = { ...props.filters };
  const currentValue = props.filters[key as keyof NewsfeedFilterOptions] ?? false;
  (newFilters as any)[key] = !currentValue;
  emit('filters-change', newFilters);
};

const toggleActivityFilter = (key: string) => {
  const newFilters = { ...props.filters };
  const currentValue = props.filters[key as keyof NewsfeedFilterOptions] ?? false;
  (newFilters as any)[key] = !currentValue;
  emit('filters-change', newFilters);
};

const isContentFilterActive = (key: string) => {
  return props.filters[key as keyof NewsfeedFilterOptions] ?? false;
};

const isActivityFilterActive = (key: string) => {
  return props.filters[key as keyof NewsfeedFilterOptions] ?? false;
};

// Count active filters
const activeContentCount = computed(() => 
  contentFilters.filter(f => isContentFilterActive(f.key)).length
);

const activeActivityCount = computed(() => 
  activityFilters.filter(f => isActivityFilterActive(f.key)).length
);

// Check if all filters are selected
const allContentFiltersSelected = computed(() => 
  contentFilters.every(f => isContentFilterActive(f.key))
);

const allActivityFiltersSelected = computed(() => 
  activityFilters.every(f => isActivityFilterActive(f.key))
);

// Select all content filters
const selectAllContentFilters = () => {
  const newFilters = { ...props.filters };
  contentFilters.forEach(filter => {
    (newFilters as any)[filter.key] = true;
  });
  emit('filters-change', newFilters);
};

// Clear all content filters
const clearAllContentFilters = () => {
  const newFilters = { ...props.filters };
  contentFilters.forEach(filter => {
    (newFilters as any)[filter.key] = false;
  });
  emit('filters-change', newFilters);
};

// Select all activity filters
const selectAllActivityFilters = () => {
  const newFilters = { ...props.filters };
  activityFilters.forEach(filter => {
    (newFilters as any)[filter.key] = true;
  });
  emit('filters-change', newFilters);
};

// Clear all activity filters
const clearAllActivityFilters = () => {
  const newFilters = { ...props.filters };
  activityFilters.forEach(filter => {
    (newFilters as any)[filter.key] = false;
  });
  emit('filters-change', newFilters);
};
</script>

<template>
  <div class="px-3.5 py-2">
    <div class="flex flex-wrap items-center gap-2">
      <!-- Content Type Filter Dropdown -->
      <DropdownMenu
        :open="contentFilterOpen"
        @update:open="contentFilterOpen = $event"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            @click.stop
            :class="[
              'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-[5px] text-xs font-medium text-gray-200 transition-all duration-150',
              activeContentCount > 0
                ? 'border-blue-400/30 bg-blue-400/15'
                : 'border-white/6 bg-white/4 hover:border-white/10 hover:bg-white/8',
            ]"
          >
            <svg
              class="h-3 w-3 shrink-0"
              :class="activeContentCount > 0 ? 'text-blue-400' : 'text-gray-500'"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <span class="text-white">Algemeen</span>
            <span
              v-if="activeContentCount > 0"
              class="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-semibold text-white"
            >{{ activeContentCount }}</span>
            <svg
              class="ml-auto h-3 w-3 shrink-0 opacity-50 transition-transform duration-200"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" :side-offset="4" class="z-50 w-64 border border-white/6 p-0 shadow-lg">
          <div class="p-1">
            <div class="flex items-center justify-between gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <span>Algemeen</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="cursor-pointer rounded-sm border border-white/8 bg-white/4 px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap text-gray-400 transition-all duration-150 hover:border-white/12 hover:bg-white/6 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                  @click.stop="clearAllContentFilters"
                  :disabled="activeContentCount === 0"
                >
                  Wis alles
                </button>
                <button
                  type="button"
                  class="cursor-pointer rounded-sm border border-white/8 bg-white/4 px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap text-gray-400 transition-all duration-150 hover:border-white/12 hover:bg-white/6 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                  @click.stop="selectAllContentFilters"
                  :disabled="allContentFiltersSelected"
                >
                  Selecteer alles
                </button>
              </div>
            </div>
            <div class="p-1">
              <button
                v-for="filter in contentFilters"
                :key="filter.key"
                type="button"
                @click="toggleContentFilter(filter.key)"
                :class="[
                  'flex w-full cursor-pointer items-center gap-2 rounded border-0 px-3 py-2 text-left text-xs font-medium transition-all duration-100',
                  isContentFilterActive(filter.key)
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-transparent text-gray-400 hover:bg-white/6 hover:text-white',
                ]"
              >
                <div class="shrink-0">
                  <div
                    :class="[
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-white/20 transition-all duration-150',
                      isContentFilterActive(filter.key)
                        ? 'border-blue-500 bg-linear-to-br from-blue-500 to-blue-600 text-white'
                        : '',
                    ]"
                  >
                    <svg
                      v-if="isContentFilterActive(filter.key)"
                      class="h-2.5 w-2.5 shrink-0"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
                <span>{{ filter.label }}</span>
              </button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Activity Filter Dropdown -->
      <DropdownMenu
        :open="activityFilterOpen"
        @update:open="activityFilterOpen = $event"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            @click.stop
            :class="[
              'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-[5px] text-xs font-medium text-gray-200 transition-all duration-150',
              activeActivityCount > 0
                ? 'border-blue-400/30 bg-blue-400/15'
                : 'border-white/6 bg-white/4 hover:border-white/10 hover:bg-white/8',
            ]"
          >
            <svg
              class="h-3 w-3 shrink-0"
              :class="activeActivityCount > 0 ? 'text-blue-400' : 'text-gray-500'"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span class="text-white">Vrienden</span>
            <span
              v-if="activeActivityCount > 0"
              class="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-semibold text-white"
            >{{ activeActivityCount }}</span>
            <svg
              class="ml-auto h-3 w-3 shrink-0 opacity-50 transition-transform duration-200"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" :side-offset="4" class="z-50 w-64 border border-white/6 p-0 shadow-lg">
          <div class="p-1">
            <div class="flex items-center justify-between gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <span>Vrienden</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="cursor-pointer rounded-sm border border-white/8 bg-white/4 px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap text-gray-400 transition-all duration-150 hover:border-white/12 hover:bg-white/6 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                  @click.stop="clearAllActivityFilters"
                  :disabled="activeActivityCount === 0"
                >
                  Wis alles
                </button>
                <button
                  type="button"
                  class="cursor-pointer rounded-sm border border-white/8 bg-white/4 px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap text-gray-400 transition-all duration-150 hover:border-white/12 hover:bg-white/6 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                  @click.stop="selectAllActivityFilters"
                  :disabled="allActivityFiltersSelected"
                >
                  Selecteer alles
                </button>
              </div>
            </div>
            <div class="max-h-[280px] overflow-y-auto p-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
              <button
                v-for="filter in activityFilters"
                :key="filter.key"
                type="button"
                @click="toggleActivityFilter(filter.key)"
                :class="[
                  'flex w-full cursor-pointer items-center gap-2 rounded border-0 px-3 py-2 text-left text-xs font-medium transition-all duration-100',
                  isActivityFilterActive(filter.key)
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-transparent text-gray-400 hover:bg-white/6 hover:text-white',
                ]"
              >
                <div class="shrink-0">
                  <div
                    :class="[
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-white/20 transition-all duration-150',
                      isActivityFilterActive(filter.key)
                        ? 'border-blue-500 bg-linear-to-br from-blue-500 to-blue-600 text-white'
                        : '',
                    ]"
                  >
                    <svg
                      v-if="isActivityFilterActive(filter.key)"
                      class="h-2.5 w-2.5 shrink-0"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
                <span>{{ filter.label }}</span>
              </button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>
