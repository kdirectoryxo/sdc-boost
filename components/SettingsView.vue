<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { getShowCategoryIcons, setShowCategoryIcons } from '@/lib/storage';
import { Switch } from '@/lib/view-router/ui/switch';

const loading = ref(true);
const showCategoryIcons = ref(true);
const savingCategoryIcons = ref(false);

onMounted(async () => {
  try {
    showCategoryIcons.value = await getShowCategoryIcons();
  } catch (error) {
    console.error('Error loading settings:', error);
  } finally {
    loading.value = false;
  }
});

async function updateCategoryIcons(show: boolean) {
  if (savingCategoryIcons.value) return;
  
  savingCategoryIcons.value = true;
  try {
    await setShowCategoryIcons(show);
    // Trigger a custom event to notify ModuleControlPanel to refresh
    window.dispatchEvent(new CustomEvent('category-icons-setting-changed', { detail: { show } }));
  } catch (error) {
    console.error('Error saving category icons setting:', error);
  } finally {
    savingCategoryIcons.value = false;
  }
}
</script>

<template>
  <div class="w-full h-full flex flex-col overflow-hidden">
    <!-- Header with Back Button -->
    <div class="px-5 pt-5 pb-4 border-b border-[#333] shrink-0 flex items-center gap-3">
      <button
        @click="$emit('back')"
        class="p-2 hover:bg-[#333] rounded-md transition-colors"
        title="Back to Modules"
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
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div>
        <h2 class="text-xl font-semibold text-white mb-1">Global Settings</h2>
        <p class="text-sm text-[#999]">Configure global settings for SDC Boost</p>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto py-4 px-5">

      <!-- Display Settings -->
      <div class="p-4 border border-[#333] rounded-lg bg-[#242424] mb-4">
        <h3 class="text-base font-semibold text-white mb-3">Display Settings</h3>
        
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-white">Show Category Icons & Colors</span>
              <span class="text-xs text-[#999]">
                Display category icons and colors on module cards
              </span>
            </div>
            <Switch
              :checked="showCategoryIcons"
              :disabled="savingCategoryIcons"
              @update:checked="updateCategoryIcons"
            />
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

