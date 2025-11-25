<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { getAIApiKey, setAIApiKey, getShowCategoryIcons, setShowCategoryIcons } from '@/lib/storage';
import Button from '@/components/ui/Button.vue';
import Switch from '@/components/ui/Switch.vue';

const apiKey = ref('');
const loading = ref(true);
const saving = ref(false);
const saved = ref(false);
const showCategoryIcons = ref(true);
const savingCategoryIcons = ref(false);

onMounted(async () => {
  try {
    const key = await getAIApiKey();
    apiKey.value = key || '';
    showCategoryIcons.value = await getShowCategoryIcons();
  } catch (error) {
    console.error('Error loading settings:', error);
  } finally {
    loading.value = false;
  }
});

async function saveApiKey() {
  if (saving.value) return;
  
  saving.value = true;
  saved.value = false;
  
  try {
    await setAIApiKey(apiKey.value);
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error saving API key:', error);
  } finally {
    saving.value = false;
  }
}

const hasApiKey = () => {
  return apiKey.value.trim().length > 0;
};

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

      <!-- AI Section -->
      <div class="p-4 border border-[#333] rounded-lg bg-[#242424] mb-4">
        <h3 class="text-base font-semibold text-white mb-3">AI Configuration</h3>
        
        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-white">OpenAI API Key</span>
            <span class="text-xs text-[#999]">
              Your API key is stored locally and never sent to any server except OpenAI.
            </span>
          </label>
          
          <div class="flex items-center gap-2">
            <input
              v-model="apiKey"
              type="password"
              placeholder="sk-..."
              class="flex-1 py-2 px-3 bg-[#2a2a2a] border border-[#333] rounded-md text-white text-sm font-sans transition-all duration-200 focus:outline-none focus:border-green-500 focus:bg-[#333]"
            />
            <Button
              @click="saveApiKey"
              :disabled="saving"
              variant="primary"
              size="sm"
            >
              {{ saving ? 'Saving...' : saved ? 'Saved!' : 'Save' }}
            </Button>
          </div>

          <!-- Status Indicator -->
          <div class="flex items-center gap-2 text-xs">
            <div
              :class="[
                'w-2 h-2 rounded-full',
                hasApiKey() ? 'bg-green-500' : 'bg-[#666]'
              ]"
            ></div>
            <span :class="hasApiKey() ? 'text-green-400' : 'text-[#999]'">
              {{ hasApiKey() ? 'API key configured' : 'No API key configured' }}
            </span>
          </div>
        </div>
      </div>

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
              :model-value="showCategoryIcons"
              @update:model-value="updateCategoryIcons"
            />
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

