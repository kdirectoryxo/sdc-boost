import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { ViewedFilters, OnlineFilters, LatestMembersFilters } from '@/components/PeopleList.vue';
import {
  getViewedFilters,
  setViewedFilters,
  getOnlineFilters,
  setOnlineFilters,
  getClientSideFilters,
  setClientSideFilters,
  getLatestMembersFilters,
  setLatestMembersFilters,
  type ClientSideFilters,
} from '@/lib/people-filters-storage';

/** Debounce helper */
function debounce<T extends (...args: unknown[]) => unknown>(func: T, wait: number): (...args: Parameters<T>) => void {
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

export const SELECT_OPTIONS = [
  { value: 1, label: 'Views', icon: 'mdi:eye-outline', color: '#60a5fa' },
  { value: 2, label: 'Elkaar bekeken', icon: 'mdi:arrow-left-right', color: '#34d399' },
  { value: 3, label: 'Door mij bekeken', icon: 'mdi:eye-arrow-right-outline', color: '#fbbf24' },
  { value: 4, label: 'Onthouden', icon: 'mdi:bookmark-outline', color: '#a78bfa' },
];

export const ORDER_OPTIONS = [
  { value: 1, label: 'Meest recente', icon: 'mdi:clock-outline', color: '#60a5fa' },
  { value: 2, label: 'Afstand', icon: 'mdi:map-marker-distance', color: '#34d399' },
];

export const GENDER_OPTIONS = [
  { value: 9, label: 'Allemaal', icon: 'mdi:account-multiple-outline', color: '#9ca3af' },
  { value: 21, label: 'Stellen & Vrouwen', icon: 'mdi:account-group-outline', color: '#f472b6' },
  { value: 2, label: 'Stellen', icon: 'mdi:account-heart-outline', color: '#f472b6' },
  { value: 1, label: 'Vrouw', icon: 'mdi:gender-female', color: '#ff60df' },
  { value: 0, label: 'Man', icon: 'mdi:gender-male', color: '#3a97fe' },
  { value: 3, label: 'Transgender', icon: 'mdi:gender-non-binary', color: '#a78bfa' },
  { value: 4, label: 'Bedrijf', icon: 'mdi:briefcase-outline', color: '#fbbf24' },
];

export const GENDER_OPTIONS_LATEST = [
  { value: 2, label: 'Stellen', icon: 'mdi:account-heart-outline', color: '#f472b6' },
  { value: 1, label: 'Vrouw', icon: 'mdi:gender-female', color: '#ff60df' },
  { value: 0, label: 'Man', icon: 'mdi:gender-male', color: '#3a97fe' },
  { value: 3, label: 'Transgender', icon: 'mdi:gender-non-binary', color: '#a78bfa' },
  { value: 4, label: 'Bedrijf', icon: 'mdi:briefcase-outline', color: '#fbbf24' },
];

export const GENDER_OPTIONS_ONLINE = [
  { value: 2, label: 'Stellen', short: 'St', icon: 'mdi:account-heart-outline', color: '#f472b6' },
  { value: 1, label: 'Vrouw', short: 'V', icon: 'mdi:gender-female', color: '#ff60df' },
  { value: 0, label: 'Man', short: 'M', icon: 'mdi:gender-male', color: '#3a97fe' },
  { value: 3, label: 'Trans', short: 'T', icon: 'mdi:gender-non-binary', color: '#a78bfa' },
];

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
  ageFilterMode: 'any',
});

const filtersLoaded = ref(false);
const viewedCount = ref(0);

const selectDropdownOpen = ref(false);
const orderDropdownOpen = ref(false);
const genderDropdownOpen = ref(false);
const latestGenderDropdownOpen = ref(false);

const ageMinInput = ref('');
const ageMaxInput = ref('');
const kmWithinInput = ref('');

const currentSelectOption = computed(() => {
  return SELECT_OPTIONS.find((opt) => opt.value === viewedFilters.value.select) || SELECT_OPTIONS[0];
});

const currentOrderOption = computed(() => {
  return ORDER_OPTIONS.find((opt) => opt.value === viewedFilters.value.order) || ORDER_OPTIONS[0];
});

const currentGenderOption = computed(() => {
  return GENDER_OPTIONS.find((opt) => opt.value === viewedFilters.value.gender) || GENDER_OPTIONS[0];
});

const currentLatestGenderOption = computed(() => {
  return GENDER_OPTIONS_LATEST.find((opt) => opt.value === latestMembersFilters.value.gender) || GENDER_OPTIONS_LATEST[1];
});

const hasAgeFilter = computed(() => {
  return clientSideFilters.value.ageMin !== null || clientSideFilters.value.ageMax !== null;
});

const hasKmFilter = computed(() => {
  return clientSideFilters.value.kmWithin !== null;
});

const updateAgeFilter = debounce(() => {
  const minValue = ageMinInput.value.trim();
  const maxValue = ageMaxInput.value.trim();

  let newMin: number | null = null;
  let newMax: number | null = null;

  if (minValue !== '') {
    const num = parseInt(minValue, 10);
    if (!isNaN(num)) {
      newMin = Math.min(Math.max(num, 18), 99);
      if (num !== newMin) {
        ageMinInput.value = String(newMin);
      }
    }
  }

  if (maxValue !== '') {
    const num = parseInt(maxValue, 10);
    if (!isNaN(num)) {
      newMax = Math.min(Math.max(num, 18), 99);
      if (num !== newMax) {
        ageMaxInput.value = String(newMax);
      }
    }
  }

  clientSideFilters.value.ageMin = newMin;
  clientSideFilters.value.ageMax = newMax;

  if (newMin !== null && newMax !== null && newMin > newMax) {
    clientSideFilters.value.ageMin = newMax;
    clientSideFilters.value.ageMax = newMin;
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

const updateKmFilter = debounce(() => {
  const value = kmWithinInput.value.trim();
  let newKm: number | null = null;
  if (value !== '') {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      newKm = Math.max(num, 1);
      if (num !== newKm) {
        kmWithinInput.value = String(newKm);
      }
    }
  }
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

function handleLatestGenderChange(value: number) {
  latestMembersFilters.value.gender = value;
  latestGenderDropdownOpen.value = false;
}

function toggleGender(genderValue: number) {
  const index = onlineFilters.value.genders.indexOf(genderValue);
  if (index > -1) {
    onlineFilters.value.genders.splice(index, 1);
  } else {
    onlineFilters.value.genders.push(genderValue);
  }
}

function isGenderSelected(genderValue: number): boolean {
  return onlineFilters.value.genders.includes(genderValue);
}

let unsubscribeCounters: (() => void) | null = null;
let storageLoadStarted = false;
let explorerMountCount = 0;

watch(
  () => viewedFilters.value,
  (newFilters) => {
    if (filtersLoaded.value) {
      try {
        setViewedFilters(newFilters);
      } catch (error) {
        console.error('[PeopleExplorer] Error saving viewed filters:', error);
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
        console.error('[PeopleExplorer] Error saving online filters:', error);
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
        console.error('[PeopleExplorer] Error saving client-side filters:', error);
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
        console.error('[PeopleExplorer] Error saving latest members filters:', error);
      }
    }
  },
  { deep: true }
);

function loadFiltersFromStorage() {
  try {
    const storedViewedFilters = getViewedFilters();
    const storedOnlineFilters = getOnlineFilters();
    const storedLatestMembersFilters = getLatestMembersFilters();
    const storedClientSideFilters = getClientSideFilters();

    viewedFilters.value = storedViewedFilters;
    onlineFilters.value = storedOnlineFilters;
    latestMembersFilters.value = storedLatestMembersFilters;
    clientSideFilters.value = storedClientSideFilters;

    ageMinInput.value = storedClientSideFilters.ageMin !== null ? String(storedClientSideFilters.ageMin) : '';
    ageMaxInput.value = storedClientSideFilters.ageMax !== null ? String(storedClientSideFilters.ageMax) : '';
    kmWithinInput.value = storedClientSideFilters.kmWithin !== null ? String(storedClientSideFilters.kmWithin) : '';

    nextTick(() => {
      filtersLoaded.value = true;
    });
  } catch (error) {
    console.error('[PeopleExplorer] Error loading filters from storage:', error);
    nextTick(() => {
      filtersLoaded.value = true;
    });
  }
}

function subscribeCounters() {
  const countersManager = (window as unknown as Record<string, unknown>)['__sdcBoostCounters'] as
    | { getCounters: () => { viewed?: number }; onUpdate: (cb: (c: { viewed?: number }) => void) => () => void }
    | undefined;
  if (countersManager) {
    const counters = countersManager.getCounters();
    if (counters) {
      viewedCount.value = counters.viewed || 0;
    }
    unsubscribeCounters = countersManager.onUpdate((counters: { viewed?: number }) => {
      viewedCount.value = counters.viewed || 0;
    });
  }
}

/**
 * Shared People list filters + storage sync (view router + legacy People dialog shell).
 * Singleton state so all surfaces stay aligned via localStorage.
 */
export function usePeopleExplorerState() {
  onMounted(() => {
    if (!storageLoadStarted) {
      storageLoadStarted = true;
      loadFiltersFromStorage();
    }
    explorerMountCount++;
    if (explorerMountCount === 1) {
      subscribeCounters();
    }
  });

  onUnmounted(() => {
    explorerMountCount--;
    if (explorerMountCount === 0 && unsubscribeCounters) {
      unsubscribeCounters();
      unsubscribeCounters = null;
    }
  });

  return {
    viewedFilters,
    onlineFilters,
    latestMembersFilters,
    clientSideFilters,
    filtersLoaded,
    viewedCount,
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
  };
}
