<script lang="ts" setup>
import { Icon } from '@iconify/vue';
import { usePeopleExplorerState } from '@/lib/people-explorer';
import { AGE_FILTER_MODE_OPTIONS, AGE_FILTER_MODE_GROUP_HELP } from '@/lib/people-age-filter';

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
    <span class="filter-age-help" :title="AGE_FILTER_MODE_GROUP_HELP">
      <Icon icon="mdi:information-outline" width="14" height="14" />
    </span>
    <input
      type="text"
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
      v-model="ageMaxInput"
      maxlength="2"
      placeholder="99"
      class="filter-age-input"
      @input="handleAgeMaxInput"
      @blur="updateAgeFilter"
    />
    <div class="filter-age-mode" role="group" aria-label="Leeftijd filteren op">
      <button
        v-for="opt in AGE_FILTER_MODE_OPTIONS"
        :key="opt.value"
        type="button"
        class="filter-age-mode-btn"
        :class="{ active: clientSideFilters.ageFilterMode === opt.value }"
        :title="opt.title"
        :aria-label="opt.label"
        :aria-pressed="clientSideFilters.ageFilterMode === opt.value"
        @click="clientSideFilters.ageFilterMode = opt.value"
      >
        <Icon :icon="opt.icon" width="14" height="14" />
      </button>
    </div>
    <button v-if="hasAgeFilter" type="button" class="filter-age-clear" title="Wissen" @click="clearAgeFilter">
      <Icon icon="mdi:close" width="10" height="10" />
    </button>
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
  cursor: help;
  color: #6b7280;
}

.filter-age-help:hover {
  color: #9ca3af;
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

.filter-age-mode {
  display: inline-flex;
  align-items: center;
  gap: 0;
  margin-left: 2px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.filter-age-mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 22px;
  padding: 0;
  margin: 0;
  border: none;
  background: rgba(0, 0, 0, 0.2);
  color: #6b7280;
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.filter-age-mode-btn + .filter-age-mode-btn {
  border-left: 1px solid rgba(255, 255, 255, 0.06);
}

.filter-age-mode-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #9ca3af;
}

.filter-age-mode-btn.active {
  background: rgba(96, 165, 250, 0.22);
  color: #93c5fd;
}

.filter-age.active .filter-age-mode {
  border-color: rgba(96, 165, 250, 0.25);
}

.filter-age-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  margin-left: 2px;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-age-clear:hover {
  color: #f87171;
}
</style>
