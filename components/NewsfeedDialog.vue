<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import NewsfeedFeed from './NewsfeedFeed.vue';
import NewsfeedHeader from './NewsfeedHeader.vue';
import { getNewsfeedFilters, updateNewsfeedFilters } from '@/lib/sdc-api/newsfeed';
import type { NewsfeedFilterOptions } from '@/lib/sdc-api/newsfeed';
import { getCachedFilters, setCachedFilters } from '@/lib/newsfeed-filter-cache';
import { Button } from '@/lib/view-router/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/lib/view-router/ui/dialog';
import { cn } from '@/lib/utils';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const activeTab = ref<'feed' | 'admin'>('feed');
const filters = ref<Partial<NewsfeedFilterOptions>>({});
const filtersReady = ref(false);

/** Only fetch filter schema + enable the feed when the dialog is open — avoids newsfeed API traffic on every page load while the modal is closed. */
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;

    const cachedFilters = getCachedFilters();
    if (cachedFilters) {
      filters.value = cachedFilters;
      filtersReady.value = true;
    }

    try {
      const response = await getNewsfeedFilters();
      if (!props.modelValue) return;
      filters.value = response.info.options;
      setCachedFilters(response.info.options);
      filtersReady.value = true;
    } catch (error) {
      console.error('[NewsfeedDialog] Failed to load filters:', error);
      if (!cachedFilters) {
        filtersReady.value = true;
      }
    }
  },
);

function handleClose() {
  isOpen.value = false;
  emit('close');
}

function onOpenChange(open: boolean) {
  if (!open) handleClose();
}

function handleTabChange(tab: 'feed' | 'admin') {
  activeTab.value = tab;
}

const handleFiltersChange = async (newFilters: Partial<NewsfeedFilterOptions>) => {
  filters.value = { ...filters.value, ...newFilters };
  setCachedFilters(filters.value as NewsfeedFilterOptions);

  try {
    await updateNewsfeedFilters(filters.value);
    setCachedFilters(filters.value as NewsfeedFilterOptions);
  } catch (error) {
    console.error('[NewsfeedDialog] Failed to update filters:', error);
  }
};
</script>

<template>
  <Dialog :open="isOpen" @update:open="onOpenChange">
    <DialogContent
      :show-close-button="false"
      :class="
        cn(
          'flex max-h-[min(95vh,900px)] min-h-0 w-[95vw] max-w-[95vw] flex-col gap-0 overflow-hidden border border-white/[0.06] bg-[#131517] p-0 shadow-2xl sm:max-h-[90vh] sm:w-[90vw] sm:max-w-[90vw]',
        )
      "
      :overlay-class="'bg-black/80 backdrop-blur-md'"
    >
      <DialogHeader
        class="flex shrink-0 flex-row flex-wrap items-center gap-2 border-b border-white/[0.06] bg-[#1a1d21] px-3 py-2.5 text-left sm:gap-4 sm:px-3.5"
      >
        <div class="flex min-w-0 items-center gap-2">
          <div
            class="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-600 text-white"
          >
            <Icon icon="mdi:rss" width="16" height="16" />
          </div>
          <DialogTitle class="text-sm font-semibold tracking-tight text-white">Activity Feed</DialogTitle>
        </div>

        <div class="ml-auto flex flex-wrap justify-end gap-0.5 rounded-lg bg-white/[0.04] p-0.5" role="tablist" aria-label="Feed tabs">
          <Button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'feed'"
            variant="ghost"
            size="sm"
            :class="
              cn(
                'h-8 gap-1.5 rounded-md px-3.5 text-[13px] font-medium text-muted-foreground hover:text-foreground',
                activeTab === 'feed' && 'bg-white/[0.08] text-white shadow-none',
              )
            "
            @click="handleTabChange('feed')"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="shrink-0"
            >
              <path d="M4 11a9 9 0 0 1 9 9" />
              <path d="M4 4a16 16 0 0 1 16 16" />
              <circle cx="5" cy="19" r="1" />
            </svg>
            <span>Feed</span>
          </Button>
          <Button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'admin'"
            variant="ghost"
            size="sm"
            :class="
              cn(
                'h-8 gap-1.5 rounded-md px-3.5 text-[13px] font-medium text-muted-foreground hover:text-foreground',
                activeTab === 'admin' && 'bg-white/[0.08] text-white shadow-none',
              )
            "
            @click="handleTabChange('admin')"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="shrink-0"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>SDC Berichten</span>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          class="size-8 shrink-0 text-muted-foreground hover:bg-white/[0.06] hover:text-white"
          aria-label="Close"
          @click="handleClose"
        >
          <Icon icon="mdi:close" width="18" height="18" />
        </Button>
      </DialogHeader>

      <DialogDescription class="sr-only">
        Activity feed and SDC berichten. Switch tabs above to change view.
      </DialogDescription>

      <div v-if="isOpen && filtersReady" class="shrink-0 border-b border-white/[0.04] bg-[#16181c]">
        <NewsfeedHeader
          :active-tab="activeTab"
          :filters="filters"
          @filters-change="handleFiltersChange"
        />
      </div>

      <div v-if="isOpen" class="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#131517]">
        <NewsfeedFeed
          :active-tab="activeTab"
          :filters="filters"
          :filters-ready="filtersReady"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
