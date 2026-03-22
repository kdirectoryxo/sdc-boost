<script setup lang="ts">
import { computed } from 'vue';
import { IconMessage } from '@tabler/icons-vue';

import HubNotificationsMenu from '@/components/HubNotificationsMenu.vue';
import SdcHubBreadcrumb from '@/components/SdcHubBreadcrumb.vue';
import { useHubCounters } from '@/lib/composables/useHubCounters';
import { Button } from '@/lib/view-router/ui/button';
import { SidebarTrigger } from '@/lib/view-router/ui/sidebar';
import {
  getBoostViewRouterUrl,
  navigateBoostViewRouterPath,
  VIEW_ROUTER_CHAT_PATH,
} from '@/lib/view-router/routes';

defineProps<{
  boostPath: string;
  profileTitle?: string | null;
}>();

const { messenger, feedCounter } = useHubCounters();

const messengerBadgeLabel = computed(() => {
  const n = messenger.value;
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
});

function onChatNavClick(event: MouseEvent) {
  if (event.button !== 0) return;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateBoostViewRouterPath(VIEW_ROUTER_CHAT_PATH);
}
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
        <a
          :href="getBoostViewRouterUrl(VIEW_ROUTER_CHAT_PATH)"
          class="relative inline-flex size-9 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          :aria-label="
            messengerBadgeLabel ? `Chat (${messenger} unread)` : 'Chat'
          "
          @click="onChatNavClick"
        >
          <IconMessage class="size-5" />
          <span
            v-if="messengerBadgeLabel"
            class="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white shadow-sm"
          >
            {{ messengerBadgeLabel }}
          </span>
        </a>
        <HubNotificationsMenu :feed-counter="feedCounter" />
      </div>
    </div>
  </header>
</template>
