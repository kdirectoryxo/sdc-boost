<script lang="ts" setup>
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { moduleStates, moduleConfigs, getShowCategoryIcons, getFilterByActive, setFilterByActive } from '@/lib/storage';
import type { ModuleDefinition, ModuleConfigOption } from '@/lib/modules/types';
import { getCategoryConfig } from '@/lib/categoryConfig';
import SettingsView from '@/components/SettingsView.vue';
import { Button } from '@/lib/view-router/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/lib/view-router/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/lib/view-router/ui/popover';
import { Switch } from '@/lib/view-router/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/lib/view-router/ui/tooltip';
import { cn } from '@/lib/utils';

interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  configOptions: ModuleConfigOption[];
  config: Record<string, any>;
  expanded?: boolean;
}

const props = defineProps<{
  availableModules: ModuleDefinition[];
  gridLayout?: boolean;
}>();

const modules = ref<ModuleInfo[]>([]);
const loading = ref(true);
const activeTab = ref<string>('All');
const showSettings = ref(false);
const showCategoryIcons = ref(true);
const filterByActive = ref(false);
const showFilterPopup = ref(false);

// Get unique categories
const categories = computed(() => {
  const cats = ['All', ...new Set(props.availableModules.map(m => m.category))];
  return cats;
});

// Filter modules by active tab and active filter
const filteredModules = computed(() => {
  let filtered = modules.value;
  
  // Apply category filter
  if (activeTab.value !== 'All') {
    filtered = filtered.filter(m => m.category === activeTab.value);
  }
  
  // Apply active filter
  if (filterByActive.value) {
    filtered = filtered.filter(m => m.enabled);
  }
  
  return filtered;
});

// Count of active filters
const activeFiltersCount = computed(() => {
  let count = 0;
  if (filterByActive.value) count++;
  return count;
});

async function loadModules() {
  try {
    // Get module states and configs from storage
    let states: Record<string, boolean> = {};
    let configs: Record<string, Record<string, any>> = {};
    
    try {
      states = await moduleStates.getValue();
      configs = await moduleConfigs.getValue();
    } catch (error) {
      console.warn('Could not load module data from storage, using defaults:', error);
    }

    modules.value = props.availableModules.map(module => {
      const moduleConfig = configs[module.id] || {};
      const moduleState = states[module.id] !== false; // Default to enabled

      // Initialize config with defaults
      const config: Record<string, any> = {};
      module.configOptions.forEach(option => {
        config[option.key] = moduleConfig[option.key] ?? option.default;
      });

      return {
        ...module,
        enabled: moduleState,
        config,
        expanded: false,
      };
    });
  } catch (error) {
    console.error('Error loading modules:', error);
  } finally {
    loading.value = false;
  }
}

async function saveModuleState(moduleId: string, enabled: boolean) {
  try {
    const module = modules.value.find(m => m.id === moduleId);
    if (!module) return;

    const states = await moduleStates.getValue();
    states[moduleId] = enabled;
    await moduleStates.setValue(states);

    // Notify content script
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      browser.tabs.sendMessage(tabs[0].id, {
        type: 'MODULE_TOGGLE',
        moduleId,
        enabled,
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Error saving module state:', error);
  }
}

async function updateModuleConfig(moduleId: string, key: string, value: any) {
  try {
    const module = modules.value.find(m => m.id === moduleId);
    if (!module) return;

    module.config[key] = value;

    const configs = await moduleConfigs.getValue();
    configs[moduleId] = module.config;
    await moduleConfigs.setValue(configs);

    // Notify content script
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      browser.tabs.sendMessage(tabs[0].id, {
        type: 'MODULE_CONFIG_UPDATE',
        moduleId,
        config: module.config,
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Error updating module config:', error);
  }
}

function toggleModuleExpanded(moduleId: string) {
  const module = modules.value.find(m => m.id === moduleId);
  if (module) {
    module.expanded = !module.expanded;
  }
}

function resetSetting(moduleId: string, optionKey: string) {
  const module = modules.value.find(m => m.id === moduleId);
  if (!module) return;

  const option = module.configOptions.find(opt => opt.key === optionKey);
  if (!option) return;

  const defaultValue = option.default;
  updateModuleConfig(moduleId, optionKey, defaultValue);
}

async function resetAllSettings(moduleId: string) {
  const module = modules.value.find(m => m.id === moduleId);
  if (!module) return;

  const defaultConfig: Record<string, any> = {};
  module.configOptions.forEach(option => {
    defaultConfig[option.key] = option.default;
  });

  // Update all config values at once
  Object.keys(defaultConfig).forEach(key => {
    module.config[key] = defaultConfig[key];
  });

  try {
    // Save to storage
    const configs = await moduleConfigs.getValue();
    configs[moduleId] = module.config;
    await moduleConfigs.setValue(configs);

    // Notify content script
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      browser.tabs.sendMessage(tabs[0].id, {
        type: 'MODULE_CONFIG_UPDATE',
        moduleId,
        config: module.config,
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Error resetting all settings:', error);
  }
}

function isDefaultValue(moduleId: string, optionKey: string): boolean {
  const module = modules.value.find(m => m.id === moduleId);
  if (!module) return false;

  const option = module.configOptions.find(opt => opt.key === optionKey);
  if (!option) return false;

  const currentValue = module.config[optionKey];
  const defaultValue = option.default;

  // Handle different types
  if (option.type === 'number') {
    return parseFloat(currentValue) === parseFloat(defaultValue);
  }
  return currentValue === defaultValue;
}

function hasAnyNonDefaultSettings(moduleId: string): boolean {
  const module = modules.value.find(m => m.id === moduleId);
  if (!module) return false;

  return module.configOptions.some(option => !isDefaultValue(moduleId, option.key));
}

function shouldShowOption(module: ModuleInfo, option: ModuleConfigOption): boolean {
  // Check if option has a dependency
  if (option.dependsOn) {
    const dependencyValue = module.config[option.dependsOn.key];
    return dependencyValue === option.dependsOn.value;
  }
  return true;
}

function isOptionDisabled(module: ModuleInfo, option: ModuleConfigOption): boolean {
  // Check if explicitly disabled
  if (option.disabled) {
    return true;
  }
  
  // Check if dependency is not met (but still show it, just disabled)
  if (option.dependsOn) {
    const dependencyValue = module.config[option.dependsOn.key];
    if (dependencyValue !== option.dependsOn.value) {
      return true;
    }
  }
  
  return false;
}

function getDisabledReason(module: ModuleInfo, option: ModuleConfigOption): string | undefined {
  // Check if dependency is not met
  if (option.dependsOn) {
    const dependencyValue = module.config[option.dependsOn.key];
    if (dependencyValue !== option.dependsOn.value) {
      const dependencyOption = module.configOptions.find(o => o.key === option.dependsOn?.key);
      return option.disabledReason || `Requires ${dependencyOption?.label || option.dependsOn.key} to be enabled`;
    }
  }
  
  return option.disabledReason;
}

async function loadCategoryIconsSetting() {
  try {
    showCategoryIcons.value = await getShowCategoryIcons();
  } catch (error) {
    console.error('Error loading category icons setting:', error);
    showCategoryIcons.value = true;
  }
}

async function loadFilterByActiveSetting() {
  try {
    filterByActive.value = await getFilterByActive();
  } catch (error) {
    console.error('Error loading filter by active setting:', error);
    filterByActive.value = false;
  }
}

async function handleFilterByActiveChange(value: boolean) {
  filterByActive.value = value;
  try {
    await setFilterByActive(value);
  } catch (error) {
    console.error('Error saving filter by active setting:', error);
  }
}

function handleCategoryIconsSettingChange(event: CustomEvent) {
  showCategoryIcons.value = event.detail.show;
}

onMounted(async () => {
  await loadCategoryIconsSetting();
  await loadFilterByActiveSetting();
  loadModules();
  
  // Listen for category icons setting changes
  window.addEventListener('category-icons-setting-changed', handleCategoryIconsSettingChange as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('category-icons-setting-changed', handleCategoryIconsSettingChange as EventListener);
});
</script>

<template>
  <TooltipProvider :delay-duration="200">
  <div class="w-full h-full flex flex-col overflow-hidden">
    <div v-if="loading" class="text-center py-10 px-5 text-[#999] flex-1 flex items-center justify-center">
      Loading modules...
    </div>

    <SettingsView v-else-if="showSettings" @back="() => { showSettings = false; }" />

    <div v-else class="flex-1 flex flex-col overflow-hidden">
      <!-- Header with Settings Icon -->
      <div class="flex justify-between items-center py-3 px-5 border-b border-[#333] shrink-0">
        <!-- Tabs -->
        <div class="flex gap-1 overflow-x-auto shrink-0 flex-1">
          <Button
            v-for="category in categories"
            :key="category"
            variant="ghost"
            size="sm"
            :class="cn(
              'whitespace-nowrap flex items-center gap-1.5 transition-colors',
              activeTab === category && !showCategoryIcons && 'bg-[#333] text-white hover:bg-[#333]',
              activeTab === category && showCategoryIcons && category !== 'All' && 'bg-[#333] hover:bg-[#333]'
            )"
            :style="showCategoryIcons && category !== 'All' && activeTab === category
              ? { 
                  color: getCategoryConfig(category).color
                }
              : {}"
            @click="activeTab = category"
          >
            <svg 
              v-if="showCategoryIcons && category !== 'All'"
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="2" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              class="shrink-0"
            >
              <path :d="getCategoryConfig(category).icon"></path>
            </svg>
            <span>{{ category }}</span>
          </Button>
        </div>
        <!-- Filter -->
        <Popover v-model:open="showFilterPopup">
          <PopoverTrigger as-child>
            <button
              type="button"
              class="ml-2 p-2 hover:bg-[#333] rounded-md transition-colors relative"
              :title="filterByActive ? 'Filter: Active only' : 'Filter'"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                :class="filterByActive ? 'text-green-500' : 'text-[#999] hover:text-white'"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              <span
                v-if="activeFiltersCount > 0"
                class="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full bg-green-500 text-white text-[10px] font-semibold leading-none"
              >
                {{ activeFiltersCount > 99 ? '99+' : activeFiltersCount }}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            :side-offset="8"
            class="w-auto min-w-[200px] border border-[#333] bg-[#1a1a1a] p-0 text-[#e0e0e0] shadow-lg"
          >
            <div class="px-4 py-3">
              <div class="flex items-center justify-between gap-4 min-w-[200px]">
                <label class="text-sm text-[#e0e0e0] cursor-pointer flex-1">
                  Show only active modules
                </label>
                <Switch
                  :checked="filterByActive"
                  @update:checked="handleFilterByActiveChange"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <!-- Settings Icon -->
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              type="button"
              @click="showSettings = true"
              class="ml-2 p-2 hover:bg-[#333] rounded-md transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-[#999] hover:text-white"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" :side-offset="4">Settings</TooltipContent>
        </Tooltip>
      </div>

      <!-- Modules List/Grid -->
      <div 
        class="flex-1 overflow-y-auto py-4 px-5"
        :class="props.gridLayout 
          ? 'grid grid-cols-2 gap-4 auto-rows-max' 
          : 'flex flex-col gap-3'"
      >
        <div
          v-for="module in filteredModules"
          :key="module.id"
          class="p-4 border border-[#333] rounded-lg bg-[#242424] transition-all duration-200"
          :class="{ 'border-green-500 bg-green-500/5': module.enabled }"
        >
          <div class="flex justify-between items-start gap-4 mb-3">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1.5">
                <span 
                  v-if="showCategoryIcons"
                  class="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-md uppercase tracking-wide"
                  :style="{ 
                    backgroundColor: getCategoryConfig(module.category).color + '15',
                    color: getCategoryConfig(module.category).color
                  }"
                >
                  <svg 
                    width="12" 
                    height="12" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    stroke-width="2" 
                    stroke-linecap="round" 
                    stroke-linejoin="round"
                  >
                    <path :d="getCategoryConfig(module.category).icon"></path>
                  </svg>
                  {{ module.category }}
                </span>
                <span 
                  v-else
                  class="inline-block text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#333] text-[#999] uppercase tracking-wide"
                >
                  {{ module.category }}
                </span>
              </div>
              <h3 class="m-0 mb-1 text-base font-semibold text-white">{{ module.name }}</h3>
              <p class="m-0 text-[13px] text-[#999] leading-snug">{{ module.description }}</p>
            </div>
            <Switch
              :checked="module.enabled"
              @update:checked="(val: boolean) => saveModuleState(module.id, val)"
            />
          </div>

          <!-- Settings -->
          <Collapsible
            v-if="module.configOptions.length > 0"
            :open="module.expanded ?? false"
            class="mt-2"
            @update:open="(val) => { module.expanded = val; }"
          >
            <CollapsibleTrigger
              class="w-full py-2.5 px-2.5 bg-[#2a2a2a] border border-[#333] rounded-md text-[#e0e0e0] cursor-pointer text-[13px] font-medium flex justify-between items-center transition-all duration-200 hover:bg-[#333] hover:border-[#444]"
            >
              <span>Settings</span>
              <span
                class="text-[10px] transition-transform duration-200"
                :class="{ 'rotate-180': module.expanded }"
              >▼</span>
            </CollapsibleTrigger>
            <CollapsibleContent class="mt-3 pt-3 border-t border-[#333] flex flex-col gap-4">
            <div
              v-for="option in module.configOptions"
              :key="option.key"
              v-show="shouldShowOption(module, option)"
              class="flex flex-col gap-2"
            >
              <label class="flex flex-col gap-1">
                <span class="text-sm font-medium text-white">{{ option.label }}</span>
                <span v-if="option.description" class="text-xs text-[#999]">{{ option.description }}</span>
                <span v-if="isOptionDisabled(module, option)" class="text-xs text-yellow-400">
                  {{ getDisabledReason(module, option) }}
                </span>
              </label>
              
              <div class="flex items-center gap-2">
                <!-- Number Input -->
                <input
                  v-if="option.type === 'number'"
                  type="number"
                  :value="module.config[option.key]"
                  :min="option.min"
                  :max="option.max"
                  :step="option.step"
                  :disabled="isOptionDisabled(module, option)"
                  class="py-2 px-3 bg-[#2a2a2a] border border-[#333] rounded-md text-white text-sm font-sans w-[120px] transition-all duration-200 focus:outline-none focus:border-green-500 focus:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed"
                  @input="updateModuleConfig(module.id, option.key, parseFloat(($event.target as HTMLInputElement).value))"
                />
                
                <!-- Color Input -->
                <input
                  v-else-if="option.type === 'color'"
                  type="color"
                  :value="module.config[option.key]"
                  :disabled="isOptionDisabled(module, option)"
                  class="w-[60px] h-10 p-0.5 bg-[#2a2a2a] border border-[#333] rounded-md cursor-pointer transition-all duration-200 focus:outline-none focus:border-green-500 focus:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed"
                  @input="updateModuleConfig(module.id, option.key, ($event.target as HTMLInputElement).value)"
                />
                
                <!-- String Input -->
                <input
                  v-else-if="option.type === 'string'"
                  type="text"
                  :value="module.config[option.key]"
                  :disabled="isOptionDisabled(module, option)"
                  class="py-2 px-3 bg-[#2a2a2a] border border-[#333] rounded-md text-white text-sm font-sans w-full transition-all duration-200 focus:outline-none focus:border-green-500 focus:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed"
                  @input="updateModuleConfig(module.id, option.key, ($event.target as HTMLInputElement).value)"
                />
                
                <!-- Boolean Input -->
                <Switch
                  v-else-if="option.type === 'boolean'"
                  :checked="module.config[option.key]"
                  :disabled="isOptionDisabled(module, option)"
                  class="scale-90"
                  @update:checked="(val: boolean) => updateModuleConfig(module.id, option.key, val)"
                />

                <!-- Reset Button for each setting -->
                <Button
                  v-if="!isDefaultValue(module.id, option.key)"
                  variant="secondary"
                  size="icon"
                  class="min-w-[32px] hover:rotate-180"
                  @click="resetSetting(module.id, option.key)"
                  :title="`Reset ${option.label} to default`"
                >
                  ↺
                </Button>
              </div>
            </div>

            <!-- Reset All Button at bottom -->
            <div v-if="hasAnyNonDefaultSettings(module.id)" class="mt-3 pt-3 border-t border-[#333]">
              <Button
                variant="secondary"
                size="sm"
                class="w-full"
                @click="resetAllSettings(module.id)"
                title="Reset all settings to defaults"
              >
                <span class="text-sm inline-block transition-transform duration-200 hover:rotate-180">↺</span>
                Reset All
              </Button>
            </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div v-if="filteredModules.length === 0" class="text-center py-10 px-5 text-[#999]">
          No modules in this category
        </div>
      </div>
    </div>

  </div>
  </TooltipProvider>
</template>


