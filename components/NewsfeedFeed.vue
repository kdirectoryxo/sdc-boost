<script lang="ts" setup>
import NewsfeedList from './NewsfeedList.vue';
import type { NewsfeedFilterOptions } from '@/lib/sdc-api/newsfeed';

interface Props {
  activeTab: 'feed' | 'admin';
  filters: Partial<NewsfeedFilterOptions>;
  filtersReady: boolean;
}

defineProps<Props>();
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      class="newsfeed-content min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/[0.08] hover:[&::-webkit-scrollbar-thumb]:bg-white/[0.12]"
    >
      <NewsfeedList
        v-if="filtersReady"
        :active-tab="activeTab"
        :filters="filters"
      />
      <div v-else class="flex flex-col items-center justify-center gap-4 px-6 py-16 text-gray-500">
        <div class="size-8 animate-spin rounded-full border-[3px] border-blue-500/20 border-t-blue-500" />
        <p>Loading filters...</p>
      </div>
    </div>
  </div>
</template>
