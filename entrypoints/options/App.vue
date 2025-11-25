<script lang="ts" setup>
import ModuleControlPanel from '@/components/ModuleControlPanel.vue';
import { moduleDefinitions } from '@/lib/modules/moduleDefinitions';
import logoSrc from '@/assets/sdc-boost-logo.svg';

const GITHUB_URL = 'https://github.com/kdirectoryxo/sdc-boost';

function openGitHub() {
  window.open(GITHUB_URL, '_blank');
}
</script>

<template>
  <div class="w-full min-h-screen p-0 m-0 font-sans bg-[#1a1a1a] text-[#e0e0e0] box-border flex flex-col">
    <header class="px-10 pt-10 pb-6 border-b border-[#333] shrink-0 bg-[#242424]">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <img :src="logoSrc" alt="SDC Boost" class="w-16 h-16 flex-shrink-0" />
          <div>
            <h1 class="m-0 mb-2 text-3xl font-semibold text-white">SDC Boost Settings</h1>
            <p class="m-0 text-base text-[#999]">Configure your extension modules and preferences</p>
          </div>
        </div>
        <button
          @click="openGitHub"
          class="p-2 hover:bg-[#333] rounded-md transition-colors"
          title="View on GitHub"
        >
          <svg
            width="24"
            height="24"
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
      </div>
    </header>
    <div class="flex-1 p-0 overflow-hidden flex flex-col">
      <ModuleControlPanel :available-modules="moduleDefinitions" :grid-layout="true" />
    </div>
  </div>
</template>

