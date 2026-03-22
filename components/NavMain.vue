<script setup lang="ts">
import { computed } from 'vue';
import {
  IconEye,
  IconLayoutDashboard,
  IconMessage,
  IconSparkles,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-vue';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/lib/view-router/ui/sidebar';
import { useHubCounters } from '@/lib/composables/useHubCounters';
import {
  VIEW_ROUTER_CHAT_PATH,
  VIEW_ROUTER_HUB_DASHBOARD_PATH,
  VIEW_ROUTER_PEOPLE_ONLINE_PATH,
  VIEW_ROUTER_PEOPLE_VISUALLY_PATH,
  VIEW_ROUTER_PEOPLE_FIELD_PATH,
  VIEW_ROUTER_PEOPLE_SPOTLIGHT_PATH,
  navigateBoostViewRouterPath,
} from '@/lib/view-router/routes';

const { messenger } = useHubCounters();

const messengerBadgeLabel = computed(() => {
  const n = messenger.value;
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
});

const props = defineProps<{
  boostPath: string;
}>();

/** Hub home first, then chat + People — labels aligned with PeopleDialog / PeopleExplorer (Dutch). */
const items = [
  { title: 'Dashboard', path: VIEW_ROUTER_HUB_DASHBOARD_PATH, icon: IconLayoutDashboard },
  { title: 'Chat', path: VIEW_ROUTER_CHAT_PATH, icon: IconMessage },
  { title: 'Online', path: VIEW_ROUTER_PEOPLE_ONLINE_PATH, icon: IconUsers },
  { title: 'Bekeken', path: VIEW_ROUTER_PEOPLE_VISUALLY_PATH, icon: IconEye },
  { title: 'Nieuwe leden', path: VIEW_ROUTER_PEOPLE_FIELD_PATH, icon: IconUserPlus },
  { title: 'Spotlight leden', path: VIEW_ROUTER_PEOPLE_SPOTLIGHT_PATH, icon: IconSparkles },
];

function normalizePath(p: string): string {
  return p.split('?')[0].replace(/\/$/, '') || '/';
}

function isActive(target: string): boolean {
  return normalizePath(props.boostPath) === normalizePath(target);
}

function go(path: string) {
  navigateBoostViewRouterPath(path);
}
</script>

<template>
  <SidebarGroup>
    <SidebarGroupContent class="flex flex-col gap-2">
      <SidebarMenu>
        <SidebarMenuItem v-for="item in items" :key="item.path">
          <SidebarMenuButton
            type="button"
            :tooltip="item.title"
            :is-active="isActive(item.path)"
            :aria-label="
              item.path === VIEW_ROUTER_CHAT_PATH && messengerBadgeLabel
                ? `Chat (${messenger} unread)`
                : item.title
            "
            @click="go(item.path)"
          >
            <component :is="item.icon" />
            <span>{{ item.title }}</span>
          </SidebarMenuButton>
          <SidebarMenuBadge
            v-if="item.path === VIEW_ROUTER_CHAT_PATH && messengerBadgeLabel"
            class="!flex !h-[18px] !min-w-[18px] !items-center !justify-center !rounded-full !border-0 !bg-destructive !px-1 !text-[10px] !font-semibold !tabular-nums !leading-none !text-white !shadow-sm peer-hover/menu-button:!text-white peer-data-[active=true]/menu-button:!text-white group-data-[collapsible=icon]:!right-0.5 group-data-[collapsible=icon]:!top-0.5 group-data-[collapsible=icon]:!flex group-data-[collapsible=icon]:!h-[18px] group-data-[collapsible=icon]:!min-w-[18px] group-data-[collapsible=icon]:!items-center group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!text-[10px]"
          >
            {{ messengerBadgeLabel }}
          </SidebarMenuBadge>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
