<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, provide, useTemplateRef, watch, nextTick } from 'vue';
import { useColorMode } from '@vueuse/core';
import { navigationWatcher } from '@/lib/modules/utils/NavigationWatcher';
import {
  getBoostViewPathFromLocation,
  isViewRouterActiveRoute,
  BOOST_VR_SEARCH_PARAM,
} from '@/lib/view-router/routes';
import { viewRouterLog } from '@/lib/view-router/logger';
import { UI_TELEPORT_TARGET } from '@/lib/ui/teleport-target';
import SdcHubLayout from '@/components/SdcHubLayout.vue';
import ConfirmAlertHost from '@/components/ConfirmAlertHost.vue';

const path = ref(getBoostViewPathFromLocation());

function syncPath() {
  path.value = getBoostViewPathFromLocation();
}

const showSdcHub = computed(() => isViewRouterActiveRoute(path.value));

/** Default dark mode for shadcn-vue inside this shell only (no toggle / no persistence). @see https://www.shadcn-vue.com/docs/dark-mode/vite */
const vrRootRef = useTemplateRef<HTMLElement>('vrRoot');
const uiPortalRef = useTemplateRef<HTMLElement>('uiPortal');
/** Teleport tooltips here so they stay in the shadow tree (styled) and above scroll areas without clipping. */
provide(UI_TELEPORT_TARGET, uiPortalRef);
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
  [vrRootRef, showSdcHub],
  () => {
    if (vrRootRef.value && showSdcHub.value) {
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
  viewRouterLog('SdcHubApp mounted', {
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
</script>

<template>
  <div
    v-if="showSdcHub"
    ref="vrRoot"
    class="vr-root relative box-border flex h-svh max-h-svh min-h-0 w-full flex-col bg-background text-foreground"
  >
    <div class="box-border flex min-h-0 flex-1 flex-col overflow-hidden">
      <main class="box-border mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden">
        <SdcHubLayout :boost-path="path" />
      </main>
    </div>
    <div
      ref="uiPortal"
      class="pointer-events-none fixed inset-0 z-[999999] overflow-visible"
      aria-hidden="true"
    />
    <ConfirmAlertHost />
  </div>
</template>
