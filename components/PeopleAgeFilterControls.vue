<script lang="ts" setup>
import { Icon } from '@iconify/vue';

import { usePeopleExplorerState } from '@/lib/people-explorer';
import {
  AGE_FILTER_MODE_OPTIONS,
  AGE_FILTER_MODE_GROUP_HELP,
  type AgeFilterMode,
} from '@/lib/people-age-filter';
import { Button } from '@/lib/view-router/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/lib/view-router/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/lib/view-router/ui/tooltip';

const {
  clientSideFilters,
  ageMinInput,
  ageMaxInput,
  hasAgeFilter,
  updateAgeFilter,
  handleAgeMinInput,
  handleAgeMaxInput,
  clearAgeFilter,
} = usePeopleExplorerState();
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-[5px] rounded-md border px-2.5 py-[5px] transition-all duration-150 ease-in-out"
    :class="
      hasAgeFilter
        ? 'border-blue-400/30 bg-blue-400/15'
        : 'border-white/[0.06] bg-white/[0.04] hover:border-white/10 hover:bg-white/[0.08]'
    "
  >
    <Icon
      icon="mdi:account-clock-outline"
      width="12"
      height="12"
      class="shrink-0 transition-colors"
      :class="hasAgeFilter ? 'text-blue-400' : 'text-gray-500'"
    />
    <span
      class="text-xs font-medium transition-colors"
      :class="hasAgeFilter ? 'text-white' : 'text-gray-400'"
    >Leeftijd</span>
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          class="-mx-1 -ml-1 inline-flex cursor-help items-center border-0 bg-transparent p-0 text-gray-500 transition-colors hover:text-gray-400"
          :aria-label="AGE_FILTER_MODE_GROUP_HELP"
        >
          <Icon icon="mdi:information-outline" width="14" height="14" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" class="max-w-[min(100vw-2rem,20rem)] text-xs leading-snug">
        {{ AGE_FILTER_MODE_GROUP_HELP }}
      </TooltipContent>
    </Tooltip>
    <input
      type="text"
      inputmode="numeric"
      :value="ageMinInput"
      maxlength="2"
      placeholder="18"
      class="w-6 border-0 border-b border-white/15 bg-transparent p-0 text-center text-xs font-medium text-white outline-none transition-all placeholder:font-normal placeholder:text-gray-600 focus:border-blue-400"
      :class="hasAgeFilter ? 'border-blue-400/50' : ''"
      @input="handleAgeMinInput"
      @blur="updateAgeFilter"
    />
    <span class="text-xs font-normal text-gray-600" :class="hasAgeFilter && 'text-gray-400'">-</span>
    <input
      type="text"
      inputmode="numeric"
      :value="ageMaxInput"
      maxlength="2"
      placeholder="99"
      class="w-6 border-0 border-b border-white/15 bg-transparent p-0 text-center text-xs font-medium text-white outline-none transition-all placeholder:font-normal placeholder:text-gray-600 focus:border-blue-400"
      :class="hasAgeFilter ? 'border-blue-400/50' : ''"
      @input="handleAgeMaxInput"
      @blur="updateAgeFilter"
    />
    <ToggleGroup
      type="single"
      :model-value="clientSideFilters.ageFilterMode"
      variant="outline"
      size="sm"
      :spacing="0"
      class="filter-age-mode h-[22px] min-h-0 w-fit rounded border border-white/[0.08] p-0 shadow-none"
      :class="hasAgeFilter && 'border-blue-400/25'"
      role="group"
      aria-label="Leeftijd filteren op"
      @update:model-value="
        (v) => {
          const next = (Array.isArray(v) ? v[0] : v) as AgeFilterMode | undefined;
          if (next) clientSideFilters.ageFilterMode = next;
        }
      "
    >
      <ToggleGroupItem
        v-for="opt in AGE_FILTER_MODE_OPTIONS"
        :key="opt.value"
        :value="opt.value"
        :title="opt.title"
        :aria-label="opt.label"
        class="h-[22px] w-[26px] min-w-[26px] rounded-none border-0 px-0 text-[#6b7280] data-[state=on]:bg-[rgba(96,165,250,0.22)] data-[state=on]:text-[#93c5fd] first:rounded-l last:rounded-r hover:bg-white/[0.06] hover:text-[#9ca3af]"
      >
        <Icon :icon="opt.icon" width="14" height="14" />
      </ToggleGroupItem>
    </ToggleGroup>
    <Button
      v-if="hasAgeFilter"
      type="button"
      variant="ghost"
      size="icon"
      class="h-3.5 w-3.5 min-w-0 shrink-0 p-0 text-gray-500 hover:text-red-400"
      title="Wissen"
      aria-label="Wissen"
      @click="clearAgeFilter"
    >
      <Icon icon="mdi:close" width="10" height="10" />
    </Button>
  </div>
</template>
