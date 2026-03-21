<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, useTemplateRef, watch, nextTick } from 'vue';
import { useColorMode } from '@vueuse/core';
import { Icon } from '@iconify/vue';
import { navigationWatcher } from '@/lib/modules/utils/NavigationWatcher';
import {
  getBoostViewPathFromLocation,
  isViewRouterActiveRoute,
  getViewRouterViewId,
  VIEW_ROUTER_TEST_PATH,
  navigateBoostViewRouterPath,
  BOOST_VR_SEARCH_PARAM,
} from '@/lib/view-router/routes';
import { viewRouterLog } from '@/lib/view-router/logger';
import PeopleList from '@/components/PeopleList.vue';
import { Button } from '@/components/view-router/ui/button';

const path = ref(getBoostViewPathFromLocation());

function syncPath() {
  path.value = getBoostViewPathFromLocation();
}

const showViewRouter = computed(() => isViewRouterActiveRoute(path.value));
const viewId = computed(() => getViewRouterViewId(path.value));

/** Default dark mode for shadcn-vue inside this shell only (no toggle / no persistence). @see https://www.shadcn-vue.com/docs/dark-mode/vite */
const vrRootRef = useTemplateRef<HTMLElement>('vrRoot');
const colorMode = useColorMode({
  selector: vrRootRef,
  attribute: 'class',
  initialValue: 'dark',
  storageKey: null,
  modes: {
    dark: 'dark',
    light: 'light',
  },
});

watch(
  [vrRootRef, showViewRouter],
  () => {
    if (vrRootRef.value && showViewRouter.value) {
      nextTick(() => {
        colorMode.value = 'dark';
      });
    }
  },
  { flush: 'post' }
);

let unsubscribe: (() => void) | undefined;

onMounted(() => {
  syncPath();
  viewRouterLog('ViewRouterApp mounted', {
    path: path.value,
    hash: location.hash,
    search: location.search,
    boostParam: new URL(location.href).searchParams.get(BOOST_VR_SEARCH_PARAM),
    pathname: location.pathname,
  });
  unsubscribe = navigationWatcher.onNavigation(syncPath);
});

onUnmounted(() => {
  unsubscribe?.();
});

/** Uses `?sdc_boost_vr=` + replaceState so the site’s hash router does not override Boost routes. */
function navigateBoost(pathSegment: string) {
  const p = pathSegment.startsWith('/') ? pathSegment : `/${pathSegment}`;
  navigateBoostViewRouterPath(p);
}

function leaveBoostView() {
  window.location.assign('https://www.sdc.com/react/#/');
}

/** Opens the classic SDC home feed in a new tab (stays on Boost in this tab). */
function openSdcHomeInNewTab() {
  window.open('https://www.sdc.com/react/#/', '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <div
    v-if="showViewRouter"
    ref="vrRoot"
    class="vr-root box-border flex min-h-screen w-full flex-col bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(59,130,246,0.12),transparent_50%),linear-gradient(180deg,#0a0c10_0%,#0f1218_40%,#0c0e12_100%)] text-foreground"
  >
    <header
      class="shrink-0 border-b border-white/[0.06] bg-[rgba(15,18,24,0.85)] backdrop-blur-xl"
    >
      <div
        class="mx-auto flex max-w-[1920px] items-start justify-between gap-4 px-5 py-4 max-[520px]:px-3.5 max-[520px]:py-3"
      >
        <div class="min-w-0">
          <span class="mb-1.5 inline-block text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">SDC Boost</span>
          <h1 class="mb-1 text-[22px] font-bold tracking-tight text-foreground max-[520px]:text-lg">
            {{ viewId === 'router-test' ? 'Router test' : 'Online now' }}
          </h1>
          <p class="mb-3.5 text-sm leading-[1.45] text-muted-foreground">
            {{
              viewId === 'router-test'
                ? 'Fake screen — routes use the sdc_boost_vr query param so the site router does not steal navigation.'
                : 'Latest members online — updated as you scroll'
            }}
          </p>
          <nav class="flex flex-wrap gap-2" aria-label="Boost view routes">
            <Button
              type="button"
              :variant="viewId === 'home' ? 'default' : 'outline'"
              class="gap-1.5"
              @click="navigateBoost('/sdc')"
            >
              <Icon icon="mdi:account-group" class="size-[18px] shrink-0" />
              Online
            </Button>
            <Button
              type="button"
              :variant="viewId === 'router-test' ? 'default' : 'outline'"
              class="gap-1.5"
              @click="navigateBoost(VIEW_ROUTER_TEST_PATH)"
            >
              <Icon icon="mdi:test-tube" class="size-[18px] shrink-0" />
              Router test
            </Button>
          </nav>
        </div>
        <Button type="button" variant="outline" class="gap-2 shrink-0" title="Return to SDC" @click="leaveBoostView">
          <Icon icon="mdi:close" class="size-5 shrink-0" />
          <span class="max-[520px]:hidden">Back to site</span>
        </Button>
      </div>
    </header>

    <main class="box-border mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col">
      <div
        v-if="viewId === 'home'"
        class="box-border flex shrink-0 flex-wrap items-center gap-2.5 px-5 pt-3 max-[520px]:px-3.5 max-[520px]:pt-2.5"
      >
        <Button type="button" variant="secondary" class="gap-2" @click="openSdcHomeInNewTab">
          <Icon icon="mdi:open-in-new" class="size-4 shrink-0" />
          Open SDC home in new tab
        </Button>
      </div>
      <PeopleList v-if="viewId === 'home'" active-tab="online" />
      <div v-else class="max-w-2xl px-5 py-6">
        <p class="mb-3 text-sm text-foreground/90">
          Boost path: <code class="rounded-md bg-muted px-2 py-0.5 text-xs text-primary">{{ path }}</code> (from
          <code class="rounded-md bg-muted px-2 py-0.5 text-xs text-primary">sdc_boost_vr</code> or hash)
        </p>
        <p class="m-0 text-sm leading-relaxed text-muted-foreground">
          If this appears after <strong class="text-foreground">Router test</strong>, routing works. Use
          <strong class="text-foreground">Online</strong> to go back.
        </p>
      </div>
    </main>
  </div>
</template>
