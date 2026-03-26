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
  <div class="filter-age" :class="{ active: hasAgeFilter }">
    <Icon icon="mdi:account-clock-outline" width="12" height="12" />
    <span class="filter-age-label">Leeftijd</span>
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          class="filter-age-help inline-flex cursor-help items-center border-0 bg-transparent p-0 text-[#6b7280] transition-colors hover:text-[#9ca3af]"
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
      class="filter-age-input"
      @input="handleAgeMinInput"
      @blur="updateAgeFilter"
    />
    <span class="filter-age-sep">-</span>
    <input
      type="text"
      inputmode="numeric"
      :value="ageMaxInput"
      maxlength="2"
      placeholder="99"
      class="filter-age-input"
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
      class="filter-age-clear h-3.5 w-3.5 min-w-0 shrink-0 p-0 text-[#6b7280] hover:text-red-400"
      title="Wissen"
      aria-label="Wissen"
      @click="clearAgeFilter"
    >
      <Icon icon="mdi:close" width="10" height="10" />
    </Button>
  </div>
</template>

<style scoped>
.filter-age {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  transition: all 0.15s ease;
}

.filter-age:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.filter-age.active {
  background: rgba(96, 165, 250, 0.15);
  border-color: rgba(96, 165, 250, 0.3);
}

.filter-age .iconify,
.filter-age svg {
  flex-shrink: 0;
  color: #6b7280;
  transition: color 0.15s ease;
}

.filter-age.active .iconify:first-child,
.filter-age.active > svg:first-child {
  color: #60a5fa;
}

.filter-age-label {
  font-size: 12px;
  font-weight: 500;
  color: #9ca3af;
  transition: color 0.15s ease;
}

.filter-age.active .filter-age-label {
  color: white;
}

.filter-age-help {
  display: inline-flex;
  align-items: center;
  margin: 0 -2px 0 -4px;
}

.filter-age-input {
  width: 24px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  padding: 0;
  margin: 0;
  outline: none;
  transition: all 0.15s ease;
}

.filter-age-input:focus {
  border-color: #60a5fa;
}

.filter-age.active .filter-age-input {
  color: white;
  border-color: rgba(96, 165, 250, 0.5);
}

.filter-age-input::placeholder {
  color: #4b5563;
  font-weight: 400;
}

.filter-age-sep {
  color: #4b5563;
  font-size: 12px;
  font-weight: 400;
}

.filter-age.active .filter-age-sep {
  color: #9ca3af;
}

.filter-age.active .filter-age-mode {
  border-color: rgba(96, 165, 250, 0.25);
}
</style>
