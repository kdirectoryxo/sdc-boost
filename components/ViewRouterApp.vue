<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
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

const path = ref(getBoostViewPathFromLocation());

function syncPath() {
  path.value = getBoostViewPathFromLocation();
}

const showViewRouter = computed(() => isViewRouterActiveRoute(path.value));
const viewId = computed(() => getViewRouterViewId(path.value));

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
</script>

<template>
  <div v-if="showViewRouter" class="vr-root">
    <header class="vr-header">
      <div class="vr-header-inner">
        <div class="vr-title-block">
          <span class="vr-badge">SDC Boost</span>
          <h1 class="vr-title">
            {{ viewId === 'router-test' ? 'Router test' : 'Online now' }}
          </h1>
          <p class="vr-sub">
            {{
              viewId === 'router-test'
                ? 'Fake screen — routes use the sdc_boost_vr query param so the site router does not steal navigation.'
                : 'Latest members online — updated as you scroll'
            }}
          </p>
          <nav class="vr-nav" aria-label="Boost view routes">
            <button
              type="button"
              class="vr-nav-btn"
              :class="{ 'vr-nav-btn--active': viewId === 'home' }"
              @click="navigateBoost('/sdc')"
            >
              <Icon icon="mdi:account-group" class="vr-nav-btn-icon" />
              Online
            </button>
            <button
              type="button"
              class="vr-nav-btn"
              :class="{ 'vr-nav-btn--active': viewId === 'router-test' }"
              @click="navigateBoost(VIEW_ROUTER_TEST_PATH)"
            >
              <Icon icon="mdi:test-tube" class="vr-nav-btn-icon" />
              Router test
            </button>
          </nav>
        </div>
        <button type="button" class="vr-leave" @click="leaveBoostView" title="Return to SDC">
          <Icon icon="mdi:close" class="vr-leave-icon" />
          <span class="vr-leave-text">Back to site</span>
        </button>
      </div>
    </header>

    <main class="vr-main">
      <PeopleList v-if="viewId === 'home'" active-tab="online" />
      <div v-else class="vr-fake">
        <p class="vr-fake-path">
          Boost path: <code>{{ path }}</code> (from <code>sdc_boost_vr</code> or hash)
        </p>
        <p class="vr-fake-hint">
          If this appears after <strong>Router test</strong>, routing works. Use <strong>Online</strong> to go back.
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.vr-root {
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: radial-gradient(ellipse 120% 80% at 50% -20%, rgba(59, 130, 246, 0.12), transparent 50%),
    linear-gradient(180deg, #0a0c10 0%, #0f1218 40%, #0c0e12 100%);
  color: #e8eaef;
  box-sizing: border-box;
}

.vr-header {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(15, 18, 24, 0.85);
  backdrop-filter: blur(12px);
}

.vr-header-inner {
  max-width: 1920px;
  margin: 0 auto;
  padding: 16px 20px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.vr-title-block {
  min-width: 0;
}

.vr-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #60a5fa;
  margin-bottom: 6px;
}

.vr-title {
  margin: 0 0 4px 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #f4f6fb;
}

.vr-sub {
  margin: 0 0 14px 0;
  font-size: 13px;
  color: #8b95a8;
  line-height: 1.45;
}

.vr-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.vr-nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #b8c0d0;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.vr-nav-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e8eaef;
}

.vr-nav-btn--active {
  border-color: rgba(96, 165, 250, 0.45);
  background: rgba(59, 130, 246, 0.12);
  color: #93c5fd;
}

.vr-nav-btn-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.vr-leave {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #c8d0dc;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.vr-leave:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.vr-leave-icon {
  width: 20px;
  height: 20px;
}

.vr-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  max-width: 1920px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.vr-fake {
  padding: 24px 20px;
  max-width: 42rem;
}

.vr-fake-path {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #c8d0dc;
}

.vr-fake-path code {
  font-size: 13px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #93c5fd;
}

.vr-fake-hint {
  margin: 0;
  font-size: 14px;
  color: #8b95a8;
  line-height: 1.55;
}

@media (max-width: 520px) {
  .vr-leave-text {
    display: none;
  }

  .vr-header-inner {
    padding: 12px 14px;
  }

  .vr-title {
    font-size: 18px;
  }
}
</style>
