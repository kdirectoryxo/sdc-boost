<script lang="ts" setup>
import { Icon } from '@iconify/vue';
import PeopleList from '@/components/PeopleList.vue';
import PeopleAgeFilterControls from '@/components/PeopleAgeFilterControls.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/lib/view-router/ui/dropdown-menu';
import { usePeopleExplorerState } from '@/lib/people-explorer';
import type { PeopleTabId } from '@/lib/view-router/routes';

const props = defineProps<{
  activeTab: PeopleTabId;
  /**
   * When set (e.g. view router), each card is a real link (`<a href>`) for middle-click / new tab.
   * Plain click still uses in-app navigation without full reload.
   */
  getProfileHref?: (userId: number) => string;
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
  kmWithinInput,
  currentSelectOption,
  currentOrderOption,
  currentGenderOption,
  currentLatestGenderOption,
  hasKmFilter,
  updateKmFilter,
  handleKmInput,
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
} = usePeopleExplorerState(() => props.activeTab);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <!-- Compact Filter Bar for Viewed -->
    <div
      v-if="activeTab === 'viewed'"
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.04] bg-white/[0.02] px-3.5 py-2"
    >
      <DropdownMenu
        :open="selectDropdownOpen"
        @update:open="selectDropdownOpen = $event"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            @click.stop
            class="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-xs font-medium text-gray-200 transition-all duration-150 hover:border-white/10 hover:bg-white/[0.08]"
          >
            <Icon :icon="currentSelectOption.icon" width="12" height="12" :style="{ color: currentSelectOption.color }" />
            <span class="text-white">{{ currentSelectOption.label }}</span>
            <Icon icon="mdi:chevron-down" width="12" height="12" class="shrink-0 text-gray-500" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" :side-offset="4" class="z-50 w-48 border border-white/[0.06] p-0 shadow-lg">
          <div class="p-1">
            <button
              v-for="option in SELECT_OPTIONS"
              :key="option.value"
              type="button"
              @click="handleSelectChange(option.value)"
              class="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-xs font-medium transition-all duration-100"
              :class="
                viewedFilters.select === option.value
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-transparent text-gray-400 hover:bg-white/[0.06] hover:text-white'
              "
            >
              <Icon :icon="option.icon" width="14" height="14" class="shrink-0" :style="{ color: option.color }" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu
        :open="orderDropdownOpen"
        @update:open="orderDropdownOpen = $event"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            @click.stop
            class="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-xs font-medium text-gray-200 transition-all duration-150 hover:border-white/10 hover:bg-white/[0.08]"
          >
            <Icon :icon="currentOrderOption.icon" width="12" height="12" :style="{ color: currentOrderOption.color }" />
            <span class="text-white">{{ currentOrderOption.label }}</span>
            <Icon icon="mdi:chevron-down" width="12" height="12" class="shrink-0 text-gray-500" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" :side-offset="4" class="z-50 w-44 border border-white/[0.06] p-0 shadow-lg">
          <div class="p-1">
            <button
              v-for="option in ORDER_OPTIONS"
              :key="option.value"
              type="button"
              @click="handleOrderChange(option.value)"
              class="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-xs font-medium transition-all duration-100"
              :class="
                viewedFilters.order === option.value
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-transparent text-gray-400 hover:bg-white/[0.06] hover:text-white'
              "
            >
              <Icon :icon="option.icon" width="14" height="14" class="shrink-0" :style="{ color: option.color }" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu
        :open="genderDropdownOpen"
        @update:open="genderDropdownOpen = $event"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            @click.stop
            class="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-xs font-medium text-gray-200 transition-all duration-150 hover:border-white/10 hover:bg-white/[0.08]"
          >
            <Icon :icon="currentGenderOption.icon" width="12" height="12" :style="{ color: currentGenderOption.color }" />
            <span class="text-white">{{ currentGenderOption.label }}</span>
            <Icon icon="mdi:chevron-down" width="12" height="12" class="shrink-0 text-gray-500" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" :side-offset="4" class="z-50 w-48 border border-white/[0.06] p-0 shadow-lg">
          <div class="p-1">
            <button
              v-for="option in GENDER_OPTIONS"
              :key="option.value"
              type="button"
              @click="handleGenderChange(option.value)"
              class="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-xs font-medium transition-all duration-100"
              :class="
                viewedFilters.gender === option.value
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-transparent text-gray-400 hover:bg-white/[0.06] hover:text-white'
              "
            >
              <Icon :icon="option.icon" width="14" height="14" class="shrink-0" :style="{ color: option.color }" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <PeopleAgeFilterControls />

      <div
        class="flex items-center gap-[5px] rounded-md border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 transition-all duration-150 hover:border-white/10 hover:bg-white/[0.08]"
        :class="hasKmFilter ? 'border-blue-400/30 bg-blue-400/15' : ''"
      >
        <Icon
          icon="mdi:map-marker-distance"
          width="12"
          height="12"
          class="shrink-0 transition-colors duration-150"
          :class="hasKmFilter ? 'text-blue-400' : 'text-gray-500'"
        />
        <span
          class="text-xs font-medium transition-colors duration-150"
          :class="hasKmFilter ? 'text-white' : 'text-gray-400'"
        >
          Km binnen
        </span>
        <input
          type="text"
          v-model="kmWithinInput"
          @input="handleKmInput"
          @blur="updateKmFilter"
          placeholder="50"
          maxlength="4"
          class="m-0 w-6 border-0 border-b border-white/15 bg-transparent p-0 text-center text-xs font-medium text-white outline-none transition-all duration-150 placeholder:font-normal placeholder:text-gray-600 focus:border-blue-400"
          :class="hasKmFilter ? 'border-blue-400/50' : ''"
        />
        <button
          v-if="hasKmFilter"
          type="button"
          class="ml-0.5 flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-gray-500 transition-all hover:text-red-400"
          title="Clear"
          @click="clearKmFilter"
        >
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>
    </div>

    <!-- Compact Filter Bar for Online -->
    <div
      v-if="activeTab === 'online'"
      class="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.04] bg-white/[0.02] px-3.5 py-2"
    >
      <div class="flex gap-1">
        <button
          v-for="option in GENDER_OPTIONS_ONLINE"
          :key="option.value"
          type="button"
          @click="toggleGender(option.value)"
          class="flex cursor-pointer items-center gap-[5px] rounded-[14px] border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-[11px] font-medium text-gray-400 transition-all duration-150 hover:bg-white/[0.08] hover:text-white"
          :class="{ 'text-white': isGenderSelected(option.value) }"
          :style="isGenderSelected(option.value) ? { borderColor: option.color, backgroundColor: `${option.color}20` } : {}"
        >
          <Icon
            :icon="option.icon"
            width="12"
            height="12"
            class="shrink-0"
            :style="{ color: isGenderSelected(option.value) ? option.color : '#6b7280' }"
          />
          <span>{{ option.label }}</span>
        </button>
      </div>

      <div class="h-5 w-px shrink-0 bg-white/[0.08]" />

      <div class="flex flex-wrap items-center gap-1">
        <label
          class="group flex cursor-pointer select-none items-center gap-[5px] rounded-[14px] border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-[11px] font-medium text-gray-500 transition-all duration-150 hover:bg-white/[0.08] hover:text-gray-400"
          :class="onlineFilters.looking_for_me === 1 ? 'border-green-500/30 bg-green-500/15 text-green-400' : ''"
        >
          <input type="checkbox" class="hidden" :checked="onlineFilters.looking_for_me === 1" @change="onlineFilters.looking_for_me = onlineFilters.looking_for_me === 1 ? 0 : 1" />
          <Icon
            icon="mdi:heart-outline"
            width="12"
            height="12"
            class="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
            :class="onlineFilters.looking_for_me === 1 ? 'text-green-400 opacity-100' : ''"
          />
          <span>Zoekt mij</span>
        </label>
        <label
          class="group flex cursor-pointer select-none items-center gap-[5px] rounded-[14px] border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-[11px] font-medium text-gray-500 transition-all duration-150 hover:bg-white/[0.08] hover:text-gray-400"
          :class="onlineFilters.pictures === 1 ? 'border-green-500/30 bg-green-500/15 text-green-400' : ''"
        >
          <input type="checkbox" class="hidden" :checked="onlineFilters.pictures === 1" @change="onlineFilters.pictures = onlineFilters.pictures === 1 ? 0 : 1" />
          <Icon
            icon="mdi:image-outline"
            width="12"
            height="12"
            class="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
            :class="onlineFilters.pictures === 1 ? 'text-green-400 opacity-100' : ''"
          />
          <span>Foto</span>
        </label>
        <label
          class="group flex cursor-pointer select-none items-center gap-[5px] rounded-[14px] border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-[11px] font-medium text-gray-500 transition-all duration-150 hover:bg-white/[0.08] hover:text-gray-400"
          :class="onlineFilters.video === 1 ? 'border-green-500/30 bg-green-500/15 text-green-400' : ''"
        >
          <input type="checkbox" class="hidden" :checked="onlineFilters.video === 1" @change="onlineFilters.video = onlineFilters.video === 1 ? 0 : 1" />
          <Icon
            icon="mdi:video-outline"
            width="12"
            height="12"
            class="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
            :class="onlineFilters.video === 1 ? 'text-green-400 opacity-100' : ''"
          />
          <span>Video</span>
        </label>
        <label
          class="group flex cursor-pointer select-none items-center gap-[5px] rounded-[14px] border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-[11px] font-medium text-gray-500 transition-all duration-150 hover:bg-white/[0.08] hover:text-gray-400"
          :class="onlineFilters.speed_dating === 1 ? 'border-green-500/30 bg-green-500/15 text-green-400' : ''"
        >
          <input type="checkbox" class="hidden" :checked="onlineFilters.speed_dating === 1" @change="onlineFilters.speed_dating = onlineFilters.speed_dating === 1 ? 0 : 1" />
          <Icon
            icon="mdi:lightning-bolt-outline"
            width="12"
            height="12"
            class="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
            :class="onlineFilters.speed_dating === 1 ? 'text-green-400 opacity-100' : ''"
          />
          <span>Speed</span>
        </label>
        <label
          class="group flex cursor-pointer select-none items-center gap-[5px] rounded-[14px] border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-[11px] font-medium text-gray-500 transition-all duration-150 hover:bg-white/[0.08] hover:text-gray-400"
          :class="onlineFilters.birthday === 1 ? 'border-green-500/30 bg-green-500/15 text-green-400' : ''"
        >
          <input type="checkbox" class="hidden" :checked="onlineFilters.birthday === 1" @change="onlineFilters.birthday = onlineFilters.birthday === 1 ? 0 : 1" />
          <Icon
            icon="mdi:cake-variant-outline"
            width="12"
            height="12"
            class="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
            :class="onlineFilters.birthday === 1 ? 'text-green-400 opacity-100' : ''"
          />
          <span>Verjaardag</span>
        </label>
        <label
          class="group flex cursor-pointer select-none items-center gap-[5px] rounded-[14px] border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-[11px] font-medium text-gray-500 transition-all duration-150 hover:bg-white/[0.08] hover:text-gray-400"
          :class="onlineFilters.business_profile === 1 ? 'border-green-500/30 bg-green-500/15 text-green-400' : ''"
        >
          <input type="checkbox" class="hidden" :checked="onlineFilters.business_profile === 1" @change="onlineFilters.business_profile = onlineFilters.business_profile === 1 ? 0 : 1" />
          <Icon
            icon="mdi:briefcase-outline"
            width="12"
            height="12"
            class="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
            :class="onlineFilters.business_profile === 1 ? 'text-green-400 opacity-100' : ''"
          />
          <span>Bedrijf</span>
        </label>
      </div>

      <div class="h-5 w-px shrink-0 bg-white/[0.08]" />

      <PeopleAgeFilterControls />

      <div
        class="flex items-center gap-[5px] rounded-md border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 transition-all duration-150 hover:border-white/10 hover:bg-white/[0.08]"
        :class="hasKmFilter ? 'border-blue-400/30 bg-blue-400/15' : ''"
      >
        <Icon
          icon="mdi:map-marker-distance"
          width="12"
          height="12"
          class="shrink-0 transition-colors duration-150"
          :class="hasKmFilter ? 'text-blue-400' : 'text-gray-500'"
        />
        <span
          class="text-xs font-medium transition-colors duration-150"
          :class="hasKmFilter ? 'text-white' : 'text-gray-400'"
        >
          Km binnen
        </span>
        <input
          type="text"
          v-model="kmWithinInput"
          @input="handleKmInput"
          @blur="updateKmFilter"
          placeholder="50"
          maxlength="4"
          class="m-0 w-6 border-0 border-b border-white/15 bg-transparent p-0 text-center text-xs font-medium text-white outline-none transition-all duration-150 placeholder:font-normal placeholder:text-gray-600 focus:border-blue-400"
          :class="hasKmFilter ? 'border-blue-400/50' : ''"
        />
        <button
          v-if="hasKmFilter"
          type="button"
          class="ml-0.5 flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-gray-500 transition-all hover:text-red-400"
          title="Clear"
          @click="clearKmFilter"
        >
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>
    </div>

    <!-- Compact Filter Bar for Latest Members -->
    <div
      v-if="activeTab === 'latest'"
      class="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.04] bg-white/[0.02] px-3.5 py-2"
    >
      <DropdownMenu
        :open="latestGenderDropdownOpen"
        @update:open="latestGenderDropdownOpen = $event"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            @click.stop
            class="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-xs font-medium text-gray-200 transition-all duration-150 hover:border-white/10 hover:bg-white/[0.08]"
          >
            <Icon :icon="currentLatestGenderOption.icon" width="12" height="12" :style="{ color: currentLatestGenderOption.color }" />
            <span class="text-white">{{ currentLatestGenderOption.label }}</span>
            <Icon icon="mdi:chevron-down" width="12" height="12" class="shrink-0 text-gray-500" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" :side-offset="4" class="z-50 w-48 border border-white/[0.06] p-0 shadow-lg">
          <div class="p-1">
            <button
              v-for="option in GENDER_OPTIONS_LATEST"
              :key="option.value"
              type="button"
              @click="handleLatestGenderChange(option.value)"
              class="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-xs font-medium transition-all duration-100"
              :class="
                latestMembersFilters.gender === option.value
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-transparent text-gray-400 hover:bg-white/[0.06] hover:text-white'
              "
            >
              <Icon :icon="option.icon" width="14" height="14" class="shrink-0" :style="{ color: option.color }" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="h-5 w-px shrink-0 bg-white/[0.08]" />

      <div class="flex flex-wrap items-center gap-1">
        <label
          class="group flex cursor-pointer select-none items-center gap-[5px] rounded-[14px] border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 text-[11px] font-medium text-gray-500 transition-all duration-150 hover:bg-white/[0.08] hover:text-gray-400"
          :class="latestMembersFilters.looking_for_me === 1 ? 'border-green-500/30 bg-green-500/15 text-green-400' : ''"
        >
          <input type="checkbox" class="hidden" :checked="latestMembersFilters.looking_for_me === 1" @change="latestMembersFilters.looking_for_me = latestMembersFilters.looking_for_me === 1 ? 0 : 1" />
          <Icon
            icon="mdi:heart-outline"
            width="12"
            height="12"
            class="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
            :class="latestMembersFilters.looking_for_me === 1 ? 'text-green-400 opacity-100' : ''"
          />
          <span>Zoekt mij</span>
        </label>
      </div>

      <div class="h-5 w-px shrink-0 bg-white/[0.08]" />

      <PeopleAgeFilterControls />

      <div
        class="flex items-center gap-[5px] rounded-md border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 transition-all duration-150 hover:border-white/10 hover:bg-white/[0.08]"
        :class="hasKmFilter ? 'border-blue-400/30 bg-blue-400/15' : ''"
      >
        <Icon
          icon="mdi:map-marker-distance"
          width="12"
          height="12"
          class="shrink-0 transition-colors duration-150"
          :class="hasKmFilter ? 'text-blue-400' : 'text-gray-500'"
        />
        <span
          class="text-xs font-medium transition-colors duration-150"
          :class="hasKmFilter ? 'text-white' : 'text-gray-400'"
        >
          Km binnen
        </span>
        <input
          type="text"
          v-model="kmWithinInput"
          @input="handleKmInput"
          @blur="updateKmFilter"
          placeholder="50"
          maxlength="4"
          class="m-0 w-6 border-0 border-b border-white/15 bg-transparent p-0 text-center text-xs font-medium text-white outline-none transition-all duration-150 placeholder:font-normal placeholder:text-gray-600 focus:border-blue-400"
          :class="hasKmFilter ? 'border-blue-400/50' : ''"
        />
        <button
          v-if="hasKmFilter"
          type="button"
          class="ml-0.5 flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-gray-500 transition-all hover:text-red-400"
          title="Clear"
          @click="clearKmFilter"
        >
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>
    </div>

    <!-- Featured -->
    <div
      v-if="activeTab === 'featured'"
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.04] bg-white/[0.02] px-3.5 py-2"
    >
      <PeopleAgeFilterControls />

      <div
        class="flex items-center gap-[5px] rounded-md border border-white/[0.06] bg-white/[0.04] py-[5px] px-2.5 transition-all duration-150 hover:border-white/10 hover:bg-white/[0.08]"
        :class="hasKmFilter ? 'border-blue-400/30 bg-blue-400/15' : ''"
      >
        <Icon
          icon="mdi:map-marker-distance"
          width="12"
          height="12"
          class="shrink-0 transition-colors duration-150"
          :class="hasKmFilter ? 'text-blue-400' : 'text-gray-500'"
        />
        <span
          class="text-xs font-medium transition-colors duration-150"
          :class="hasKmFilter ? 'text-white' : 'text-gray-400'"
        >
          Km binnen
        </span>
        <input
          type="text"
          v-model="kmWithinInput"
          @input="handleKmInput"
          @blur="updateKmFilter"
          placeholder="50"
          maxlength="4"
          class="m-0 w-6 border-0 border-b border-white/15 bg-transparent p-0 text-center text-xs font-medium text-white outline-none transition-all duration-150 placeholder:font-normal placeholder:text-gray-600 focus:border-blue-400"
          :class="hasKmFilter ? 'border-blue-400/50' : ''"
        />
        <button
          v-if="hasKmFilter"
          type="button"
          class="ml-0.5 flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-gray-500 transition-all hover:text-red-400"
          title="Clear"
          @click="clearKmFilter"
        >
          <Icon icon="mdi:close" width="10" height="10" />
        </button>
      </div>
    </div>

    <!-- Skeleton blocks: rounded + bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_25%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.04)_75%)] bg-[length:200%_100%] animate-hub-shimmer (loading UI is in PeopleList.vue). -->
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PeopleList
        :active-tab="activeTab"
        :viewed-filters="viewedFilters"
        :online-filters="onlineFilters"
        :latest-members-filters="latestMembersFilters"
        :client-side-filters="clientSideFilters"
        :get-profile-href="props.getProfileHref"
      />
    </div>
  </div>
</template>
