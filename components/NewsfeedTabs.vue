<script lang="ts" setup>
import { computed } from 'vue';

interface Props {
  activeTab: 'feed' | 'admin';
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'tab-change': [tab: 'feed' | 'admin'];
}>();

const setTab = (tab: 'feed' | 'admin') => {
  emit('tab-change', tab);
};

const indicatorStyle = computed(() => ({
  transform: props.activeTab === 'feed' ? 'translateX(0)' : 'translateX(100%)',
}));
</script>

<template>
  <div class="bg-[#1a1d21] px-4 pb-0 pt-2">
    <div class="relative grid grid-cols-2 gap-0.5 rounded-md bg-white/[0.03] p-0.5">
      <div
        class="pointer-events-none absolute left-[3px] top-[3px] h-[calc(100%-6px)] w-[calc(50%-2.5px)] rounded-[5px] border border-blue-500/20 bg-gradient-to-br from-blue-500/15 to-blue-500/[0.08] transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        :style="indicatorStyle"
      />

      <button
        type="button"
        class="relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[5px] border-0 bg-transparent px-4 py-2 text-sm font-medium transition-colors"
        :class="activeTab === 'feed' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-400'"
        @click="setTab('feed')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
        <span>Feed</span>
      </button>
      <button
        type="button"
        class="relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[5px] border-0 bg-transparent px-4 py-2 text-sm font-medium transition-colors"
        :class="activeTab === 'admin' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-400'"
        @click="setTab('admin')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span>SDC Berichten</span>
      </button>
    </div>
  </div>
</template>
