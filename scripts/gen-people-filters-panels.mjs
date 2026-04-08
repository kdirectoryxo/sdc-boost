import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const panelPath = path.join(root, 'components', 'people-explorer', 'PeopleExplorerPanel.vue');
const outPath = path.join(root, 'components', 'people', 'PeopleFiltersPanels.vue');

const c = fs.readFileSync(panelPath, 'utf8');
const s = c.indexOf('<!-- Compact Filter Bar for Viewed -->');
const e = c.indexOf('<div class="people-content">');
if (s === -1 || e === -1) {
  console.error('markers not found', { s, e });
  process.exit(1);
}
const tpl = c.slice(s, e);

const header = `<script setup lang="ts">
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
${tpl}
</template>
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header, 'utf8');
console.log('Wrote', outPath, 'bytes', header.length);
