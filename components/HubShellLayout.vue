<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import AppSidebar from '@/components/AppSidebar.vue';
import ChatExplorerPanel from '@/components/chat-explorer/ChatExplorerPanel.vue';
import PeopleExplorerPanel from '@/components/people-explorer/PeopleExplorerPanel.vue';
import ProfileView from '@/components/profile-view/ProfileView.vue';
import SiteHeader from '@/components/SiteHeader.vue';
import { rememberLastPeopleTabPath } from '@/lib/view-router/breadcrumbs';
import { SidebarInset, SidebarProvider } from '@/lib/view-router/ui/sidebar';
import {
  getBoostProfileHref,
  getBoostProfilePath,
  getPeopleTabFromBoostPath,
  getPeopleTabFromBoostPathOrDefault,
  getProfileUserIdFromBoostPath,
  isChatBoostPath,
  navigateBoostViewRouterPath,
  VIEW_ROUTER_DEFAULT_PATH,
} from '@/lib/view-router/routes';

const props = defineProps<{
  boostPath: string;
}>();

const peopleTab = computed(() => getPeopleTabFromBoostPathOrDefault(props.boostPath));

const profileUserId = computed(() => getProfileUserIdFromBoostPath(props.boostPath));

const showChatPage = computed(() => isChatBoostPath(props.boostPath));

const profileBreadcrumbTitle = ref<string | null>(null);

watch(
  () => props.boostPath,
  (p) => {
    if (getProfileUserIdFromBoostPath(p) == null && getPeopleTabFromBoostPath(p) != null) {
      rememberLastPeopleTabPath(p);
    }
  },
  { immediate: true }
);

watch(profileUserId, (id) => {
  if (id == null) {
    profileBreadcrumbTitle.value = null;
  }
});

function openProfileInRouter(userId: number) {
  navigateBoostViewRouterPath(getBoostProfilePath(userId));
}

function handleProfileBack() {
  navigateBoostViewRouterPath(VIEW_ROUTER_DEFAULT_PATH);
}
</script>

<template>
  <SidebarProvider :default-open="true" class="h-full min-h-0 flex-1 overflow-hidden">
    <AppSidebar :boost-path="boostPath" />
    <SidebarInset class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SiteHeader :boost-path="boostPath" :profile-title="profileBreadcrumbTitle" />
      <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ProfileView
          v-if="profileUserId != null"
          :key="profileUserId"
          :user-id="profileUserId"
          :active="true"
          variant="page"
          @back="handleProfileBack"
          @open-profile="openProfileInRouter"
          @profile-breadcrumb="profileBreadcrumbTitle = $event"
        />
        <ChatExplorerPanel v-else-if="showChatPage" :active="true" />
        <PeopleExplorerPanel
          v-else
          :active-tab="peopleTab"
          :get-profile-href="getBoostProfileHref"
        />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
