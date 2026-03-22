<script lang="ts" setup>
import { Icon } from '@iconify/vue';
import PeopleList from '@/components/PeopleList.vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import { usePeopleExplorerState } from '@/lib/people-explorer';
import type { PeopleTabId } from '@/lib/view-router/routes';

const props = defineProps<{
  activeTab: PeopleTabId;
  /**
   * When set (e.g. view router), each card is a real link (`<a href>`) for middle-click / new tab.
   * Plain click still uses in-app navigation without full reload.
   */
  getProfileHref?: (userId: number) => string;
  /** @deprecated Prefer `getProfileHref` for view-router; legacy dialog hook path. */
  openProfile?: (userId: number) => void;
}>();

const {
  viewedFilters,
  onlineFilters,
  latestMembersFilters,
  clientSideFilters,
  selectDropdownOpen,
  orderDropdownOpen,
  genderDropdownOpen,
  latestGenderDropdownOpen,
  ageMinInput,
  ageMaxInput,
  kmWithinInput,
  currentSelectOption,
  currentOrderOption,
  currentGenderOption,
  currentLatestGenderOption,
  hasAgeFilter,
  hasKmFilter,
  updateAgeFilter,
  updateKmFilter,
  handleAgeMinInput,
  handleAgeMaxInput,
  handleKmInput,
  clearAgeFilter,
  clearKmFilter,
  handleSelectChange,
  handleOrderChange,
  handleGenderChange,
  handleLatestGenderChange,
  toggleGender,
  isGenderSelected,
  SELECT_OPTIONS,
  ORDER_OPTIONS,
  GENDER_OPTIONS,
  GENDER_OPTIONS_LATEST,
  GENDER_OPTIONS_ONLINE,
} = usePeopleExplorerState();
</script>

<template>
  <div class="people-explorer-panel flex min-h-0 flex-1 flex-col overflow-hidden">
    <!-- Compact Filter Bar for Viewed -->
    <div v-if="activeTab === 'viewed'" class="people-filters">
      <Dropdown
        :model-value="selectDropdownOpen"
        @update:model-value="selectDropdownOpen = $event"
        placement="bottom"
        alignment="start"
        width="w-48"
        offset="mt-1"
      >
        <template #trigger="{ toggle }">
          <button type="button" @click.stop="toggle" class="filter-chip">
            <Icon :icon="currentSelectOption.icon" width="12" height="12" :style="{ color: currentSelectOption.color }" />
            <span class="filter-chip-value">{{ currentSelectOption.label }}</span>
            <Icon icon="mdi:chevron-down" width="12" height="12" />
          </button>
        </template>
        <template #content>
          <div class="filter-menu">
            <button
              v-for="option in SELECT_OPTIONS"
              :key="option.value"
              type="button"
              @click="handleSelectChange(option.value)"
              :class="['filter-menu-item', { active: viewedFilters.select === option.value }]"
            >
              <Icon :icon="option.icon" width="14" height="14" :style="{ color: option.color }" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </template>
      </Dropdown>

      <Dropdown
        :model-value="orderDropdownOpen"
        @update:model-value="orderDropdownOpen = $event"
        placement="bottom"
        alignment="start"
        width="w-44"
        offset="mt-1"
      >
        <template #trigger="{ toggle }">
          <button type="button" @click.stop="toggle" class="filter-chip">
            <Icon :icon="currentOrderOption.icon" width="12" height="12" :style="{ color: currentOrderOption.color }" />
            <span class="filter-chip-value">{{ currentOrderOption.label }}</span>
            <Icon icon="mdi:chevron-down" width="12" height="12" />
          </button>
        </template>
        <template #content>
          <div class="filter-menu">
            <button
              v-for="option in ORDER_OPTIONS"
              :key="option.value"
              type="button"
              @click="handleOrderChange(option.value)"
              :class="['filter-menu-item', { active: viewedFilters.order === option.value }]"
            >
              <Icon :icon="option.icon" width="14" height="14" :style="{ color: option.color }" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </template>
      </Dropdown>

      <Dropdown
        :model-value="genderDropdownOpen"
        @update:model-value="genderDropdownOpen = $event"
        placement="bottom"
        alignment="start"
        width="w-48"
        offset="mt-1"
      >
        <template #trigger="{ toggle }">
          <button type="button" @click.stop="toggle" class="filter-chip">
            <Icon :icon="currentGenderOption.icon" width="12" height="12" :style="{ color: currentGenderOption.color }" />
            <span class="filter-chip-value">{{ currentGenderOption.label }}</span>
            <Icon icon="mdi:chevron-down" width="12" height="12" />
          </button>
        </template>
        <template #content>
          <div class="filter-menu">
            <button
              v-for="option in GENDER_OPTIONS"
              :key="option.value"
              type="button"
              @click="handleGenderChange(option.value)"
              :class="['filter-menu-item', { active: viewedFilters.gender === option.value }]"
            >
              <Icon :icon="option.icon" width="14" height="14" :style="{ color: option.color }" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </template>
      </Dropdown>

      <div class="filter-age" :class="{ active: hasAgeFilter }">
        <Icon icon="mdi:account-clock-outline" width="12" height="12" />
        <span class="filter-age-label">Leeftijd</span>
        <input
          type="text"
          v-model="ageMinInput"
          @input="handleAgeMinInput"
          @blur="updateAgeFilter"
          placeholder="18"
          maxlength="2"
          class="filter-age-input"
        />
        <span class="filter-age-sep">-</span>
        <input
          type="text"
          v-model="ageMaxInput"
          @input="handleAgeMaxInput"
          placeholder="99"
          maxlength="2"
          class="filter-age-input"
        />
        <button v-if="hasAgeFilter" type="button" class="filter-age-clear" @click="clearAgeFilter" title="Clear">
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>

      <div class="filter-age" :class="{ active: hasKmFilter }">
        <Icon icon="mdi:map-marker-distance" width="12" height="12" />
        <span class="filter-age-label">Km binnen</span>
        <input
          type="text"
          v-model="kmWithinInput"
          @input="handleKmInput"
          @blur="updateKmFilter"
          placeholder="50"
          maxlength="4"
          class="filter-age-input"
        />
        <button v-if="hasKmFilter" type="button" class="filter-age-clear" @click="clearKmFilter" title="Clear">
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>
    </div>

    <!-- Compact Filter Bar for Online -->
    <div v-if="activeTab === 'online'" class="people-filters people-filters-online">
      <div class="filter-group">
        <button
          v-for="option in GENDER_OPTIONS_ONLINE"
          :key="option.value"
          type="button"
          @click="toggleGender(option.value)"
          :class="['filter-pill', { active: isGenderSelected(option.value) }]"
          :style="isGenderSelected(option.value) ? { borderColor: option.color, backgroundColor: `${option.color}20` } : {}"
        >
          <Icon :icon="option.icon" width="12" height="12" :style="{ color: isGenderSelected(option.value) ? option.color : '#6b7280' }" />
          <span>{{ option.label }}</span>
        </button>
      </div>

      <div class="filter-divider"></div>

      <div class="filter-toggles">
        <label class="filter-toggle" :class="{ active: onlineFilters.looking_for_me === 1 }">
          <input type="checkbox" :checked="onlineFilters.looking_for_me === 1" @change="onlineFilters.looking_for_me = onlineFilters.looking_for_me === 1 ? 0 : 1" />
          <Icon icon="mdi:heart-outline" width="12" height="12" />
          <span>Zoekt mij</span>
        </label>
        <label class="filter-toggle" :class="{ active: onlineFilters.pictures === 1 }">
          <input type="checkbox" :checked="onlineFilters.pictures === 1" @change="onlineFilters.pictures = onlineFilters.pictures === 1 ? 0 : 1" />
          <Icon icon="mdi:image-outline" width="12" height="12" />
          <span>Foto</span>
        </label>
        <label class="filter-toggle" :class="{ active: onlineFilters.video === 1 }">
          <input type="checkbox" :checked="onlineFilters.video === 1" @change="onlineFilters.video = onlineFilters.video === 1 ? 0 : 1" />
          <Icon icon="mdi:video-outline" width="12" height="12" />
          <span>Video</span>
        </label>
        <label class="filter-toggle" :class="{ active: onlineFilters.speed_dating === 1 }">
          <input type="checkbox" :checked="onlineFilters.speed_dating === 1" @change="onlineFilters.speed_dating = onlineFilters.speed_dating === 1 ? 0 : 1" />
          <Icon icon="mdi:lightning-bolt-outline" width="12" height="12" />
          <span>Speed</span>
        </label>
        <label class="filter-toggle" :class="{ active: onlineFilters.birthday === 1 }">
          <input type="checkbox" :checked="onlineFilters.birthday === 1" @change="onlineFilters.birthday = onlineFilters.birthday === 1 ? 0 : 1" />
          <Icon icon="mdi:cake-variant-outline" width="12" height="12" />
          <span>Verjaardag</span>
        </label>
        <label class="filter-toggle" :class="{ active: onlineFilters.business_profile === 1 }">
          <input type="checkbox" :checked="onlineFilters.business_profile === 1" @change="onlineFilters.business_profile = onlineFilters.business_profile === 1 ? 0 : 1" />
          <Icon icon="mdi:briefcase-outline" width="12" height="12" />
          <span>Bedrijf</span>
        </label>
      </div>

      <div class="filter-divider"></div>

      <div class="filter-age" :class="{ active: hasAgeFilter }">
        <Icon icon="mdi:account-clock-outline" width="12" height="12" />
        <span class="filter-age-label">Leeftijd</span>
        <input
          type="text"
          :value="clientSideFilters.ageMin ?? ''"
          @input="handleAgeMinInput"
          placeholder="18"
          maxlength="2"
          class="filter-age-input"
        />
        <span class="filter-age-sep">-</span>
        <input
          type="text"
          v-model="ageMaxInput"
          @input="handleAgeMaxInput"
          @blur="updateAgeFilter"
          placeholder="99"
          maxlength="2"
          class="filter-age-input"
        />
        <button v-if="hasAgeFilter" type="button" class="filter-age-clear" @click="clearAgeFilter" title="Clear">
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>

      <div class="filter-age" :class="{ active: hasKmFilter }">
        <Icon icon="mdi:map-marker-distance" width="12" height="12" />
        <span class="filter-age-label">Km binnen</span>
        <input
          type="text"
          v-model="kmWithinInput"
          @input="handleKmInput"
          @blur="updateKmFilter"
          placeholder="50"
          maxlength="4"
          class="filter-age-input"
        />
        <button v-if="hasKmFilter" type="button" class="filter-age-clear" @click="clearKmFilter" title="Clear">
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>
    </div>

    <!-- Compact Filter Bar for Latest Members -->
    <div v-if="activeTab === 'latest'" class="people-filters people-filters-online">
      <Dropdown
        :model-value="latestGenderDropdownOpen"
        @update:model-value="latestGenderDropdownOpen = $event"
        placement="bottom"
        alignment="start"
        width="w-48"
        offset="mt-1"
      >
        <template #trigger="{ toggle }">
          <button type="button" @click.stop="toggle" class="filter-chip">
            <Icon :icon="currentLatestGenderOption.icon" width="12" height="12" :style="{ color: currentLatestGenderOption.color }" />
            <span class="filter-chip-value">{{ currentLatestGenderOption.label }}</span>
            <Icon icon="mdi:chevron-down" width="12" height="12" />
          </button>
        </template>
        <template #content>
          <div class="filter-menu">
            <button
              v-for="option in GENDER_OPTIONS_LATEST"
              :key="option.value"
              type="button"
              @click="handleLatestGenderChange(option.value)"
              :class="['filter-menu-item', { active: latestMembersFilters.gender === option.value }]"
            >
              <Icon :icon="option.icon" width="14" height="14" :style="{ color: option.color }" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </template>
      </Dropdown>

      <div class="filter-divider"></div>

      <div class="filter-toggles">
        <label class="filter-toggle" :class="{ active: latestMembersFilters.looking_for_me === 1 }">
          <input type="checkbox" :checked="latestMembersFilters.looking_for_me === 1" @change="latestMembersFilters.looking_for_me = latestMembersFilters.looking_for_me === 1 ? 0 : 1" />
          <Icon icon="mdi:heart-outline" width="12" height="12" />
          <span>Zoekt mij</span>
        </label>
      </div>

      <div class="filter-divider"></div>

      <div class="filter-age" :class="{ active: hasAgeFilter }">
        <Icon icon="mdi:account-clock-outline" width="12" height="12" />
        <span class="filter-age-label">Leeftijd</span>
        <input
          type="text"
          :value="clientSideFilters.ageMin ?? ''"
          @input="handleAgeMinInput"
          placeholder="18"
          maxlength="2"
          class="filter-age-input"
        />
        <span class="filter-age-sep">-</span>
        <input
          type="text"
          v-model="ageMaxInput"
          @input="handleAgeMaxInput"
          @blur="updateAgeFilter"
          placeholder="99"
          maxlength="2"
          class="filter-age-input"
        />
        <button v-if="hasAgeFilter" type="button" class="filter-age-clear" @click="clearAgeFilter" title="Clear">
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>

      <div class="filter-age" :class="{ active: hasKmFilter }">
        <Icon icon="mdi:map-marker-distance" width="12" height="12" />
        <span class="filter-age-label">Km binnen</span>
        <input
          type="text"
          v-model="kmWithinInput"
          @input="handleKmInput"
          @blur="updateKmFilter"
          placeholder="50"
          maxlength="4"
          class="filter-age-input"
        />
        <button v-if="hasKmFilter" type="button" class="filter-age-clear" @click="clearKmFilter" title="Clear">
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>
    </div>

    <!-- Featured -->
    <div v-if="activeTab === 'featured'" class="people-filters">
      <div class="filter-age" :class="{ active: hasAgeFilter }">
        <Icon icon="mdi:account-clock-outline" width="12" height="12" />
        <span class="filter-age-label">Leeftijd</span>
        <input
          type="text"
          :value="clientSideFilters.ageMin ?? ''"
          @input="handleAgeMinInput"
          placeholder="18"
          maxlength="2"
          class="filter-age-input"
        />
        <span class="filter-age-sep">-</span>
        <input
          type="text"
          v-model="ageMaxInput"
          @input="handleAgeMaxInput"
          @blur="updateAgeFilter"
          placeholder="99"
          maxlength="2"
          class="filter-age-input"
        />
        <button v-if="hasAgeFilter" type="button" class="filter-age-clear" @click="clearAgeFilter" title="Clear">
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>

      <div class="filter-age" :class="{ active: hasKmFilter }">
        <Icon icon="mdi:map-marker-distance" width="12" height="12" />
        <span class="filter-age-label">Km binnen</span>
        <input
          type="text"
          v-model="kmWithinInput"
          @input="handleKmInput"
          @blur="updateKmFilter"
          placeholder="50"
          maxlength="4"
          class="filter-age-input"
        />
        <button v-if="hasKmFilter" type="button" class="filter-age-clear" @click="clearKmFilter" title="Clear">
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>
    </div>

    <div class="people-content">
      <PeopleList
        :active-tab="activeTab"
        :viewed-filters="viewedFilters"
        :online-filters="onlineFilters"
        :latest-members-filters="latestMembersFilters"
        :client-side-filters="clientSideFilters"
        :get-profile-href="props.getProfileHref"
        :open-profile="props.openProfile"
      />
    </div>
  </div>
</template>

<style scoped>
.people-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.people-filters-online {
  gap: 12px;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  color: #e5e7eb;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.filter-chip:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.filter-chip .iconify {
  color: #6b7280;
  flex-shrink: 0;
}

.filter-chip svg {
  color: #6b7280;
  flex-shrink: 0;
}

.filter-chip-value {
  color: white;
}

.filter-menu {
  padding: 4px;
}

.filter-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.1s ease;
}

.filter-menu-item .iconify,
.filter-menu-item svg {
  flex-shrink: 0;
}

.filter-menu-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: white;
}

.filter-menu-item.active {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.filter-group {
  display: flex;
  gap: 4px;
}

.filter-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  color: #9ca3af;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-pill .iconify,
.filter-pill svg {
  flex-shrink: 0;
}

.filter-pill:hover {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

.filter-pill.active {
  color: white;
}

.filter-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.08);
}

.filter-toggles {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.filter-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.filter-toggle input {
  display: none;
}

.filter-toggle .iconify,
.filter-toggle svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.filter-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #9ca3af;
}

.filter-toggle:hover .iconify,
.filter-toggle:hover svg {
  opacity: 1;
}

.filter-toggle.active {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.3);
  color: #4ade80;
}

.filter-toggle.active .iconify,
.filter-toggle.active svg {
  opacity: 1;
  color: #4ade80;
}

.filter-age {
  display: flex;
  align-items: center;
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

.people-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
