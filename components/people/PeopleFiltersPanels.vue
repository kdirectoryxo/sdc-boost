<script setup lang="ts">
import { Icon } from '@iconify/vue';
import type { PeopleTabId } from '@/lib/people/people-tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/lib/view-router/ui/dropdown-menu';
import { usePeopleFilters } from '@/lib/composables/usePeopleFilters';
import '~/assets/people-filters.css';

defineProps<{
  activeTab: PeopleTabId;
}>();

const {
  SELECT_OPTIONS,
  ORDER_OPTIONS,
  GENDER_OPTIONS,
  GENDER_OPTIONS_LATEST,
  GENDER_OPTIONS_ONLINE,
  viewedFilters,
  onlineFilters,
  latestMembersFilters,
  clientSideFilters,
  toggleGender,
  isGenderSelected,
  currentLatestGenderOption,
  selectDropdownOpen,
  orderDropdownOpen,
  genderDropdownOpen,
  latestGenderDropdownOpen,
  currentSelectOption,
  currentOrderOption,
  currentGenderOption,
  handleLatestGenderChange,
  handleSelectChange,
  handleOrderChange,
  handleGenderChange,
  hasAgeFilter,
  hasKmFilter,
  ageMinInput,
  ageMaxInput,
  kmWithinInput,
  handleAgeMinInput,
  handleAgeMaxInput,
  clearAgeFilter,
  updateAgeFilter,
  handleKmInput,
  clearKmFilter,
  updateKmFilter,
} = usePeopleFilters();
</script>

<template>
<!-- Compact Filter Bar for Viewed -->
        <div v-if="activeTab === 'viewed'" class="people-filters">
          <DropdownMenu
            :open="selectDropdownOpen"
            @update:open="selectDropdownOpen = $event"
          >
            <DropdownMenuTrigger as-child>
              <button type="button" @click.stop class="filter-chip">
                <Icon :icon="currentSelectOption.icon" width="12" height="12" :style="{ color: currentSelectOption.color }" />
                <span class="filter-chip-value">{{ currentSelectOption.label }}</span>
                <Icon icon="mdi:chevron-down" width="12" height="12" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" :side-offset="4" class="w-48 p-0 border border-white/[0.06] shadow-lg z-50">
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
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu
            :open="orderDropdownOpen"
            @update:open="orderDropdownOpen = $event"
          >
            <DropdownMenuTrigger as-child>
              <button type="button" @click.stop class="filter-chip">
                <Icon :icon="currentOrderOption.icon" width="12" height="12" :style="{ color: currentOrderOption.color }" />
                <span class="filter-chip-value">{{ currentOrderOption.label }}</span>
                <Icon icon="mdi:chevron-down" width="12" height="12" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" :side-offset="4" class="w-44 p-0 border border-white/[0.06] shadow-lg z-50">
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
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu
            :open="genderDropdownOpen"
            @update:open="genderDropdownOpen = $event"
          >
            <DropdownMenuTrigger as-child>
              <button type="button" @click.stop class="filter-chip">
                <Icon :icon="currentGenderOption.icon" width="12" height="12" :style="{ color: currentGenderOption.color }" />
                <span class="filter-chip-value">{{ currentGenderOption.label }}</span>
                <Icon icon="mdi:chevron-down" width="12" height="12" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" :side-offset="4" class="w-48 p-0 border border-white/[0.06] shadow-lg z-50">
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
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Age Filter -->
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
            <button v-if="hasAgeFilter" class="filter-age-clear" @click="clearAgeFilter" title="Clear">
              <Icon icon="mdi:close" width="10" height="10" />
            </button>
          </div>

          <!-- Km Filter -->
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
            <button v-if="hasKmFilter" class="filter-age-clear" @click="clearKmFilter" title="Clear">
              <Icon icon="mdi:close" width="10" height="10" />
            </button>
          </div>
        </div>

        <!-- Compact Filter Bar for Online -->
        <div v-if="activeTab === 'online'" class="people-filters people-filters-online">
          <!-- Gender Pills -->
          <div class="filter-group">
            <button
              v-for="option in GENDER_OPTIONS_ONLINE"
              :key="option.value"
              @click="toggleGender(option.value)"
              :class="['filter-pill', { active: isGenderSelected(option.value) }]"
              :style="isGenderSelected(option.value) ? { borderColor: option.color, backgroundColor: `${option.color}20` } : {}"
            >
              <Icon :icon="option.icon" width="12" height="12" :style="{ color: isGenderSelected(option.value) ? option.color : '#6b7280' }" />
              <span>{{ option.label }}</span>
            </button>
          </div>
          
          <div class="filter-divider"></div>
          
          <!-- Toggle Options -->
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

          <!-- Age Filter -->
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
            <button v-if="hasAgeFilter" class="filter-age-clear" @click="clearAgeFilter" title="Clear">
              <Icon icon="mdi:close" width="10" height="10" />
            </button>
          </div>

          <!-- Km Filter -->
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
            <button v-if="hasKmFilter" class="filter-age-clear" @click="clearKmFilter" title="Clear">
              <Icon icon="mdi:close" width="10" height="10" />
            </button>
          </div>
        </div>

        <!-- Compact Filter Bar for Latest Members -->
        <div v-if="activeTab === 'latest'" class="people-filters people-filters-online">
          <!-- Gender Dropdown -->
          <DropdownMenu
            :open="latestGenderDropdownOpen"
            @update:open="latestGenderDropdownOpen = $event"
          >
            <DropdownMenuTrigger as-child>
              <button type="button" @click.stop class="filter-chip">
                <Icon :icon="currentLatestGenderOption.icon" width="12" height="12" :style="{ color: currentLatestGenderOption.color }" />
                <span class="filter-chip-value">{{ currentLatestGenderOption.label }}</span>
                <Icon icon="mdi:chevron-down" width="12" height="12" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" :side-offset="4" class="w-48 p-0 border border-white/[0.06] shadow-lg z-50">
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
            </DropdownMenuContent>
          </DropdownMenu>

          <div class="filter-divider"></div>

          <!-- Toggle Options -->
          <div class="filter-toggles">
            <label class="filter-toggle" :class="{ active: latestMembersFilters.looking_for_me === 1 }">
              <input type="checkbox" :checked="latestMembersFilters.looking_for_me === 1" @change="latestMembersFilters.looking_for_me = latestMembersFilters.looking_for_me === 1 ? 0 : 1" />
              <Icon icon="mdi:heart-outline" width="12" height="12" />
              <span>Zoekt mij</span>
            </label>
          </div>

          <div class="filter-divider"></div>

          <!-- Age Filter -->
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
            <button v-if="hasAgeFilter" class="filter-age-clear" @click="clearAgeFilter" title="Clear">
              <Icon icon="mdi:close" width="10" height="10" />
            </button>
          </div>

          <!-- Km Filter -->
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
            <button v-if="hasKmFilter" class="filter-age-clear" @click="clearKmFilter" title="Clear">
              <Icon icon="mdi:close" width="10" height="10" />
            </button>
          </div>
        </div>

        <!-- Compact Filter Bar for Featured Members (only age filter) -->
        <div v-if="activeTab === 'featured'" class="people-filters">
          <!-- Age Filter -->
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
            <button v-if="hasAgeFilter" class="filter-age-clear" @click="clearAgeFilter" title="Clear">
              <Icon icon="mdi:close" width="10" height="10" />
            </button>
          </div>

          <!-- Km Filter -->
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
            <button v-if="hasKmFilter" class="filter-age-clear" @click="clearKmFilter" title="Clear">
              <Icon icon="mdi:close" width="10" height="10" />
            </button>
          </div>
        </div>

        
</template>
