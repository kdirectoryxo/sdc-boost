<script setup lang="ts">
import HubChatQuickMenu from '@/components/HubChatQuickMenu.vue';
import HubNotificationsMenu from '@/components/HubNotificationsMenu.vue';
import SdcHubBreadcrumb from '@/components/SdcHubBreadcrumb.vue';
import { useHubCounters } from '@/lib/composables/useHubCounters';
import { SidebarTrigger } from '@/lib/view-router/ui/sidebar';

defineProps<{
  boostPath: string;
  profileTitle?: string | null;
}>();

const { messenger, feedCounter } = useHubCounters();
</script>

<template>
  <header
    class="flex h-(--header-height) shrink-0 items-stretch border-b border-white/[0.04] bg-[#16181c] transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
    role="banner"
  >
    <div class="flex w-full min-w-0 items-center justify-between gap-3 px-4 lg:gap-4 lg:px-6">
      <div class="flex min-w-0 flex-1 items-center gap-3 lg:gap-2">
        <SidebarTrigger class="-ml-1 shrink-0" />
        <SdcHubBreadcrumb :boost-path="boostPath" :profile-title="profileTitle ?? null" />
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <HubChatQuickMenu :messenger="messenger" />
        <HubNotificationsMenu :feed-counter="feedCounter" />
      </div>
    </div>
  </header>
</template>
