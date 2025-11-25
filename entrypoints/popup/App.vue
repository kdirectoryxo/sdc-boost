<script lang="ts" setup>
import ModuleControlPanel from '@/components/ModuleControlPanel.vue';
import { moduleDefinitions } from '@/lib/modules/moduleDefinitions';
import logoSrc from '@/assets/sdc-boost-logo.svg';

const GITHUB_URL = 'https://github.com/kdirectoryxo/sdc-boost';

function openOptionsPage() {
  browser.runtime.openOptionsPage();
}

function openGitHub() {
  window.open(GITHUB_URL, '_blank');
}
</script>

<template>
  <div class="w-full h-full min-w-[800px] max-w-[900px] min-h-[600px] max-h-[800px] p-0 m-0 font-sans bg-[#1a1a1a] text-[#e0e0e0] box-border flex flex-col overflow-hidden">
    <header class="px-5 pt-5 pb-4 border-b border-[#333] shrink-0 flex justify-between items-start">
      <div class="flex items-center gap-3">
        <img :src="logoSrc" alt="SDC Boost" class="w-12 h-12 flex-shrink-0" />
        <div>
          <h1 class="m-0 mb-1 text-2xl font-semibold text-white">SDC Boost</h1>
          <p class="m-0 text-sm text-[#999]">Module Control Panel</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="openGitHub"
          class="p-2 hover:bg-[#333] rounded-md transition-colors"
          title="View on GitHub"
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
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
            <path d="M9 18c-4.51 2-5-2-7-2"></path>
          </svg>
        </button>
        <button
          @click="openOptionsPage"
          class="p-2 hover:bg-[#333] rounded-md transition-colors"
          title="Open Options Page"
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
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="3" y1="9" x2="21" y2="9"></line>
          </svg>
        </button>
      </div>
    </header>
    <ModuleControlPanel :available-modules="moduleDefinitions" :grid-layout="true" />
    <footer class="px-5 py-3 border-t border-[#333] shrink-0 flex items-center justify-center gap-2 text-xs text-[#999]">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-[#999]"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M14.5 9.5a2.5 2.5 0 0 0-5 0v5a2.5 2.5 0 0 0 5 0"></path>
      </svg>
      <span>{{ new Date().getFullYear() }} SDC Boost</span>
    </footer>
  </div>
</template>
