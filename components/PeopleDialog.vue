<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';

// Debounce helper
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
import { Icon } from '@iconify/vue';
import PeopleList, { type ViewedFilters, type OnlineFilters, type LatestMembersFilters } from './PeopleList.vue';
import Dropdown from './ui/Dropdown.vue';
import Switch from './ui/Switch.vue';
import ProfileDialog from './chat/ProfileDialog.vue';
import { getViewedFilters, setViewedFilters, getOnlineFilters, setOnlineFilters, getClientSideFilters, setClientSideFilters, getLatestMembersFilters, setLatestMembersFilters, type ClientSideFilters } from '@/lib/people-filters-storage';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'close': [];
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const activeTab = ref<'online' | 'viewed' | 'latest' | 'featured'>('viewed');
const viewedCount = ref(0);

// Profile dialog state
const profileDialogVisible = ref(false);
const profileDialogUserId = ref<number | null>(null);
const profileDialogStack = ref<number[]>([]);

// Open profile dialog
function openProfile(userId: number) {
  profileDialogUserId.value = userId;
  profileDialogVisible.value = true;
}

// Handle nested profile navigation (from ProfileDialog's open-profile event)
function handleOpenNestedProfile(userId: number) {
  if (profileDialogUserId.value !== null) {
    profileDialogStack.value.push(profileDialogUserId.value);
  }
  profileDialogUserId.value = userId;
}

// Close profile dialog
function closeProfileDialog() {
  if (profileDialogStack.value.length > 0) {
    // Go back to previous profile
    profileDialogUserId.value = profileDialogStack.value.pop()!;
  } else {
    // Close completely
    profileDialogVisible.value = false;
    profileDialogUserId.value = null;
  }
}

// Expose openProfile for external access
defineExpose({
  openProfile,
});

// Filter options
const SELECT_OPTIONS = [
  { value: 1, label: 'Views', icon: 'mdi:eye-outline', color: '#60a5fa' },
  { value: 2, label: 'Elkaar bekeken', icon: 'mdi:arrow-left-right', color: '#34d399' },
  { value: 3, label: 'Door mij bekeken', icon: 'mdi:eye-arrow-right-outline', color: '#fbbf24' },
  { value: 4, label: 'Onthouden', icon: 'mdi:bookmark-outline', color: '#a78bfa' },
];

const ORDER_OPTIONS = [
  { value: 1, label: 'Meest recente', icon: 'mdi:clock-outline', color: '#60a5fa' },
  { value: 2, label: 'Afstand', icon: 'mdi:map-marker-distance', color: '#34d399' },
];

const GENDER_OPTIONS = [
  { value: 9, label: 'Allemaal', icon: 'mdi:account-multiple-outline', color: '#9ca3af' },
  { value: 21, label: 'Stellen & Vrouwen', icon: 'mdi:account-group-outline', color: '#f472b6' },
  { value: 2, label: 'Stellen', icon: 'mdi:account-heart-outline', color: '#f472b6' },
  { value: 1, label: 'Vrouw', icon: 'mdi:gender-female', color: '#ff60df' },
  { value: 0, label: 'Man', icon: 'mdi:gender-male', color: '#3a97fe' },
  { value: 3, label: 'Transgender', icon: 'mdi:gender-non-binary', color: '#a78bfa' },
  { value: 4, label: 'Bedrijf', icon: 'mdi:briefcase-outline', color: '#fbbf24' },
];

const GENDER_OPTIONS_LATEST = [
  { value: 2, label: 'Stellen', icon: 'mdi:account-heart-outline', color: '#f472b6' },
  { value: 1, label: 'Vrouw', icon: 'mdi:gender-female', color: '#ff60df' },
  { value: 0, label: 'Man', icon: 'mdi:gender-male', color: '#3a97fe' },
  { value: 3, label: 'Transgender', icon: 'mdi:gender-non-binary', color: '#a78bfa' },
  { value: 4, label: 'Bedrijf', icon: 'mdi:briefcase-outline', color: '#fbbf24' },
];

// Filter state - will be loaded from storage
const viewedFilters = ref<ViewedFilters>({
  select: 1,
  order: 1,
  gender: 9,
});

const onlineFilters = ref<OnlineFilters>({
  genders: [2, 1, 0, 3],
  looking_for_me: 1,
  business_profile: 0,
  birthday: 0,
  speed_dating: 0,
  video: 0,
  pictures: 0,
});

const latestMembersFilters = ref<LatestMembersFilters>({
  gender: 1,
  looking_for_me: 0,
});

const clientSideFilters = ref<ClientSideFilters>({
  ageMin: null,
  ageMax: null,
  kmWithin: null,
});

// Track if filters have been loaded from storage
const filtersLoaded = ref(false);

// Gender options for online filters
const GENDER_OPTIONS_ONLINE = [
  { value: 2, label: 'Stellen', short: 'St', icon: 'mdi:account-heart-outline', color: '#f472b6' },
  { value: 1, label: 'Vrouw', short: 'V', icon: 'mdi:gender-female', color: '#ff60df' },
  { value: 0, label: 'Man', short: 'M', icon: 'mdi:gender-male', color: '#3a97fe' },
  { value: 3, label: 'Trans', short: 'T', icon: 'mdi:gender-non-binary', color: '#a78bfa' },
];

// Toggle gender checkbox
function toggleGender(genderValue: number) {
  const index = onlineFilters.value.genders.indexOf(genderValue);
  if (index > -1) {
    onlineFilters.value.genders.splice(index, 1);
  } else {
    onlineFilters.value.genders.push(genderValue);
  }
}

// Check if gender is selected
function isGenderSelected(genderValue: number): boolean {
  return onlineFilters.value.genders.includes(genderValue);
}

// Get current gender option for latest members
const currentLatestGenderOption = computed(() => {
  return GENDER_OPTIONS_LATEST.find(opt => opt.value === latestMembersFilters.value.gender) || GENDER_OPTIONS_LATEST[1];
});

function handleLatestGenderChange(value: number) {
  latestMembersFilters.value.gender = value;
  latestGenderDropdownOpen.value = false;
}

// Dropdown states
const selectDropdownOpen = ref(false);
const orderDropdownOpen = ref(false);
const genderDropdownOpen = ref(false);
const latestGenderDropdownOpen = ref(false);

// Get current option labels and icons
const currentSelectOption = computed(() => {
  return SELECT_OPTIONS.find(opt => opt.value === viewedFilters.value.select) || SELECT_OPTIONS[0];
});

const currentOrderOption = computed(() => {
  return ORDER_OPTIONS.find(opt => opt.value === viewedFilters.value.order) || ORDER_OPTIONS[0];
});

const currentGenderOption = computed(() => {
  return GENDER_OPTIONS.find(opt => opt.value === viewedFilters.value.gender) || GENDER_OPTIONS[0];
});

function handleSelectChange(value: number) {
  viewedFilters.value.select = value;
  selectDropdownOpen.value = false;
}

function handleOrderChange(value: number) {
  viewedFilters.value.order = value;
  orderDropdownOpen.value = false;
}

function handleGenderChange(value: number) {
  viewedFilters.value.gender = value;
  genderDropdownOpen.value = false;
}

// Age filter helpers
const hasAgeFilter = computed(() => {
  return clientSideFilters.value.ageMin !== null || clientSideFilters.value.ageMax !== null;
});

// Km filter helpers
const hasKmFilter = computed(() => {
  return clientSideFilters.value.kmWithin !== null;
});

// Local input values to avoid reactivity issues
const ageMinInput = ref<string>('');
const ageMaxInput = ref<string>('');
const kmWithinInput = ref<string>('');

// Debounced update function - only updates filter, doesn't modify input
const updateAgeFilter = debounce(() => {
  const minValue = ageMinInput.value.trim();
  const maxValue = ageMaxInput.value.trim();
  
  let newMin: number | null = null;
  let newMax: number | null = null;
  
  // Parse and validate min value
  if (minValue !== '') {
    const num = parseInt(minValue, 10);
    if (!isNaN(num)) {
      newMin = Math.min(Math.max(num, 18), 99);
      // Only update input if it was clamped
      if (num !== newMin) {
        ageMinInput.value = String(newMin);
      }
    }
  }
  
  // Parse and validate max value
  if (maxValue !== '') {
    const num = parseInt(maxValue, 10);
    if (!isNaN(num)) {
      newMax = Math.min(Math.max(num, 18), 99);
      // Only update input if it was clamped
      if (num !== newMax) {
        ageMaxInput.value = String(newMax);
      }
    }
  }
  
  // Update filters
  clientSideFilters.value.ageMin = newMin;
  clientSideFilters.value.ageMax = newMax;
  
  // Ensure min <= max if both are set
  if (newMin !== null && newMax !== null && newMin > newMax) {
    // Swap if min > max
    clientSideFilters.value.ageMin = newMax;
    clientSideFilters.value.ageMax = newMin;
    // Update inputs to reflect swap
    ageMinInput.value = String(newMax);
    ageMaxInput.value = String(newMin);
  }
}, 500);

function handleAgeMinInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.value.replace(/\D/g, '');
  ageMinInput.value = value;
  updateAgeFilter();
}

function handleAgeMaxInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.value.replace(/\D/g, '');
  ageMaxInput.value = value;
  updateAgeFilter();
}

function clearAgeFilter() {
  ageMinInput.value = '';
  ageMaxInput.value = '';
  clientSideFilters.value.ageMin = null;
  clientSideFilters.value.ageMax = null;
}

// Debounced update function for km filter
const updateKmFilter = debounce(() => {
  const value = kmWithinInput.value.trim();
  
  let newKm: number | null = null;
  
  // Parse and validate value
  if (value !== '') {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      newKm = Math.max(num, 1); // Minimum 1 km
      // Only update input if it was clamped
      if (num !== newKm) {
        kmWithinInput.value = String(newKm);
      }
    }
  }
  
  // Update filter
  clientSideFilters.value.kmWithin = newKm;
}, 500);

function handleKmInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.value.replace(/\D/g, '');
  kmWithinInput.value = value;
  updateKmFilter();
}

function clearKmFilter() {
  kmWithinInput.value = '';
  clientSideFilters.value.kmWithin = null;
}

// Subscribe to counter updates
let unsubscribeCounters: (() => void) | null = null;

onMounted(() => {
  // Load filters from storage
  try {
    const storedViewedFilters = getViewedFilters();
    const storedOnlineFilters = getOnlineFilters();
    const storedLatestMembersFilters = getLatestMembersFilters();
    const storedClientSideFilters = getClientSideFilters();
    
    viewedFilters.value = storedViewedFilters;
    onlineFilters.value = storedOnlineFilters;
    latestMembersFilters.value = storedLatestMembersFilters;
    clientSideFilters.value = storedClientSideFilters;
    
    // Initialize age input values
    ageMinInput.value = storedClientSideFilters.ageMin !== null ? String(storedClientSideFilters.ageMin) : '';
    ageMaxInput.value = storedClientSideFilters.ageMax !== null ? String(storedClientSideFilters.ageMax) : '';
    // Initialize km input value
    kmWithinInput.value = storedClientSideFilters.kmWithin !== null ? String(storedClientSideFilters.kmWithin) : '';
    
    nextTick(() => {
      filtersLoaded.value = true;
    });
  } catch (error) {
    console.error('[PeopleDialog] Error loading filters from storage:', error);
    nextTick(() => {
      filtersLoaded.value = true;
    });
  }
  
  // Access counters manager from window
  const countersManager = (window as any).__sdcBoostCounters;
  if (countersManager) {
    const counters = countersManager.getCounters();
    if (counters) {
      viewedCount.value = counters.viewed || 0;
    }
    
    unsubscribeCounters = countersManager.onUpdate((counters: any) => {
      viewedCount.value = counters.viewed || 0;
    });
  }
});

onUnmounted(() => {
  if (unsubscribeCounters) {
    unsubscribeCounters();
    unsubscribeCounters = null;
  }
});

function handleClose() {
  isOpen.value = false;
  emit('close');
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    handleClose();
  }
}

function handleTabChange(tab: 'online' | 'viewed' | 'latest' | 'featured') {
  activeTab.value = tab;
}

// Watch for filter changes and save to storage
watch(
  () => viewedFilters.value,
  (newFilters) => {
    if (filtersLoaded.value) {
      try {
        setViewedFilters(newFilters);
      } catch (error) {
        console.error('[PeopleDialog] Error saving viewed filters:', error);
      }
    }
  },
  { deep: true }
);

watch(
  () => onlineFilters.value,
  (newFilters) => {
    if (filtersLoaded.value) {
      try {
        if (!Array.isArray(newFilters.genders)) {
          newFilters.genders = [2, 1, 0, 3];
        }
        setOnlineFilters(newFilters);
      } catch (error) {
        console.error('[PeopleDialog] Error saving online filters:', error);
      }
    }
  },
  { deep: true }
);

watch(
  () => clientSideFilters.value,
  (newFilters) => {
    if (filtersLoaded.value) {
      try {
        setClientSideFilters(newFilters);
      } catch (error) {
        console.error('[PeopleDialog] Error saving client-side filters:', error);
      }
    }
  },
  { deep: true }
);

watch(
  () => latestMembersFilters.value,
  (newFilters) => {
    if (filtersLoaded.value) {
      try {
        setLatestMembersFilters(newFilters);
      } catch (error) {
        console.error('[PeopleDialog] Error saving latest members filters:', error);
      }
    }
  },
  { deep: true }
);
</script>

<template>
  <Transition name="dialog-fade">
    <div
      v-if="isOpen"
      class="people-overlay"
      @click="handleBackdropClick"
    >
      <div class="people-container" @click.stop>
        <!-- Header with Tabs -->
        <div class="people-header">
          <div class="people-header-left">
            <div class="people-icon">
              <Icon icon="mdi:account-group" width="16" height="16" />
            </div>
            <span class="people-title">People</span>
          </div>
          
          <!-- Tabs in header -->
          <div class="people-tabs">
            <button
              :class="['people-tab', { active: activeTab === 'viewed' }]"
              @click="handleTabChange('viewed')"
            >
              Bekeken
              <span v-if="viewedCount > 0" class="people-tab-badge">
                {{ viewedCount > 99 ? '99+' : viewedCount }}
              </span>
            </button>
            <button
              :class="['people-tab', { active: activeTab === 'online' }]"
              @click="handleTabChange('online')"
            >
              Online
            </button>
            <button
              :class="['people-tab', { active: activeTab === 'latest' }]"
              @click="handleTabChange('latest')"
            >
              Nieuwe leden
            </button>
            <button
              :class="['people-tab', { active: activeTab === 'featured' }]"
              @click="handleTabChange('featured')"
            >
              Spotlight leden
            </button>
          </div>
          
          <button class="people-close" @click="handleClose" aria-label="Close">
            <Icon icon="mdi:close" width="18" height="18" />
          </button>
        </div>

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
              <button @click.stop="toggle" class="filter-chip">
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
              <button @click.stop="toggle" class="filter-chip">
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
              <button @click.stop="toggle" class="filter-chip">
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
                  @click="handleGenderChange(option.value)"
                  :class="['filter-menu-item', { active: viewedFilters.gender === option.value }]"
                >
                  <Icon :icon="option.icon" width="14" height="14" :style="{ color: option.color }" />
                  <span>{{ option.label }}</span>
                </button>
              </div>
            </template>
          </Dropdown>

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
          <Dropdown
            :model-value="latestGenderDropdownOpen"
            @update:model-value="latestGenderDropdownOpen = $event"
            placement="bottom"
            alignment="start"
            width="w-48"
            offset="mt-1"
          >
            <template #trigger="{ toggle }">
              <button @click.stop="toggle" class="filter-chip">
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

        <!-- Content -->
        <div class="people-content">
          <PeopleList :active-tab="activeTab" :viewed-filters="viewedFilters" :online-filters="onlineFilters" :latest-members-filters="latestMembersFilters" :client-side-filters="clientSideFilters" />
        </div>
      </div>

      <!-- Profile Dialog -->
      <ProfileDialog
        :visible="profileDialogVisible"
        :user-id="profileDialogUserId"
        :stack-level="profileDialogStack.length"
        @close="closeProfileDialog"
        @open-profile="handleOpenNestedProfile"
      />
    </div>
  </Transition>
</template>

<style scoped>
.people-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
  padding: 16px;
  pointer-events: auto;
}

.people-container {
  width: 95vw;
  height: 95vh;
  background: #131517;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06), 0 24px 64px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
  position: relative;
}

@media (min-width: 768px) {
  .people-container {
    width: 90vw;
    height: 90vh;
  }
}

/* Header */
.people-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: #1a1d21;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.people-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.people-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 6px;
  color: white;
}

.people-title {
  font-size: 14px;
  font-weight: 600;
  color: white;
  letter-spacing: -0.01em;
}

/* Tabs */
.people-tabs {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.04);
  padding: 3px;
  border-radius: 8px;
  margin-left: auto;
}

.people-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.people-tab:hover {
  color: #9ca3af;
}

.people-tab.active {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

.people-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  background: #ef4444;
  color: white;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
}

/* Close Button */
.people-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-left: 8px;
}

.people-close:hover {
  background: rgba(255, 255, 255, 0.06);
  color: white;
}

/* Filters */
.people-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #16181c;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.people-filters-online {
  gap: 12px;
}

/* Filter Chips (Dropdowns) */
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

/* Filter Menu */
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

/* Filter Group (Gender Pills) */
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

/* Filter Divider */
.filter-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.08);
}

/* Filter Toggles */
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

/* Age Filter */
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

/* Content */
.people-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #131517;
}

/* Transitions */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-active .people-container,
.dialog-fade-leave-active .people-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .people-container,
.dialog-fade-leave-to .people-container {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}
</style>
