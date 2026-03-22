<script setup lang="ts">
import { IconArrowLeft, IconInnerShadowTop, IconLogout } from '@tabler/icons-vue';
import { ref } from 'vue';

import NavMain from '@/components/NavMain.vue';
import { logoutSdcSession, navigateToSdcHome } from '@/lib/sdc-api/logout';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/lib/view-router/ui/sidebar';
import { VIEW_ROUTER_DEFAULT_PATH, navigateBoostViewRouterPath } from '@/lib/view-router/routes';

defineProps<{
  boostPath: string;
}>();

const loggingOut = ref(false);

function goMain() {
  navigateBoostViewRouterPath(VIEW_ROUTER_DEFAULT_PATH);
}

function goToClassicReact() {
  window.location.assign('https://www.sdc.com/react/#/newsfeed?type=0');
}

async function onLogout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await logoutSdcSession();
  } catch (e) {
    console.error('[SDC Hub] Logout request failed:', e);
  } finally {
    navigateToSdcHome();
  }
}
</script>

<template>
  <Sidebar collapsible="offcanvas">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            type="button"
            class="data-[slot=sidebar-menu-button]:!p-1.5"
            @click="goMain"
          >
            <IconInnerShadowTop class="!size-5" />
            <span class="text-base font-semibold">SDC Hub</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :boost-path="boostPath" />
    </SidebarContent>
    <SidebarFooter class="border-t border-sidebar-border">
      <p class="px-2 pt-1 text-xs text-sidebar-foreground/60">SDC Hub · /sdc…</p>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            type="button"
            variant="outline"
            tooltip="Terug naar klassieke SDC"
            class="border-sidebar-border/80 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            @click="goToClassicReact"
          >
            <IconArrowLeft class="size-4" />
            <span>Back to Classic</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            type="button"
            variant="outline"
            tooltip="Uitloggen"
            :disabled="loggingOut"
            :aria-busy="loggingOut"
            class="border-sidebar-border/80 text-muted-foreground transition-colors hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive"
            @click="onLogout"
          >
            <IconLogout class="size-4" />
            <span>{{ loggingOut ? 'Bezig met uitloggen…' : 'Uitloggen' }}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>
</template>
