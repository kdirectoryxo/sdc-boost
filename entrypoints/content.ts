import { ModuleManager } from '@/lib/modules/ModuleManager';
import { AdBlockModule } from '@/lib/modules/AdBlockModule';
import { createApp } from 'vue';
import VueDndKitPlugin from '@vue-dnd-kit/core';
import SdcHubApp from '@/components/SdcHubApp.vue';
import { navigationWatcher } from '@/lib/navigation-watcher';
import {
  getBoostViewPathFromLocation,
  isViewRouterActiveRoute,
  migrateHashBoostRouteToQuery,
  migrateLegacyDashboardBoostPath,
  persistBoostPathFromCurrentLocationEarly,
} from '@/lib/view-router/routes';
import { ensureHostScrollbarGutterStyle } from '@/lib/view-router/host-page-styles';
import { VIEW_ROUTER_SHELL_STYLE_ID, VIEW_ROUTER_SHELL_CSS } from '@/lib/view-router/shell-css';
import { logShellCssDebug } from '@/lib/view-router/shell-debug';
import { viewRouterLog, viewRouterWarn } from '@/lib/view-router/logger';
import { websocketManager } from '@/lib/websocket-manager';
import { countersManager } from '@/lib/counters-manager';
import { websocketHandlers } from '@/lib/websocket-handlers';
import '~/assets/tailwind.css';

export default defineContentScript({
  matches: ['*://*.sdc.com/*', '*://sdc.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('SDC Boost: Content script loaded');
    ensureHostScrollbarGutterStyle();

    if (window === window.top) {
      persistBoostPathFromCurrentLocationEarly();
      migrateHashBoostRouteToQuery();
      migrateLegacyDashboardBoostPath();
      persistBoostPathFromCurrentLocationEarly();
    }

    async function mountViewRouterUi() {
      let viewRouterApp: ReturnType<typeof createApp> | null = null;
      let viewRouterHost: HTMLElement | null = null;

      const VIEW_ROUTER_HOST_ATTR = 'data-sdc-boost-view-router';

      function ensureViewRouterShellStyle(reason: string) {
        let el = document.getElementById(VIEW_ROUTER_SHELL_STYLE_ID) as HTMLStyleElement | null;
        const created = !el;
        if (!el) {
          el = document.createElement('style');
          el.id = VIEW_ROUTER_SHELL_STYLE_ID;
          document.documentElement.appendChild(el);
        }
        el.textContent = VIEW_ROUTER_SHELL_CSS;
        viewRouterLog('shell style applied (main)', {
          reason,
          createdNewStyleTag: created,
          cssLength: VIEW_ROUTER_SHELL_CSS.length,
        });
        logShellCssDebug(`main:ensure:${reason}`);
      }

      function pinViewRouterHostToBody(host: HTMLElement) {
        host.setAttribute(VIEW_ROUTER_HOST_ATTR, '1');
        if (host.parentElement !== document.body) {
          document.body.appendChild(host);
          viewRouterLog('moved View Router host to document.body (was nested)', {
            hadParent: true,
          });
        } else {
          document.body.appendChild(host);
        }
      }

      function updateViewRouterVisibility(reason: string) {
        const boostPath = getBoostViewPathFromLocation();
        const active = isViewRouterActiveRoute(boostPath);
        viewRouterLog('update visibility', {
          reason,
          active,
          boostPath,
          hash: typeof location !== 'undefined' ? location.hash : '',
          search: typeof location !== 'undefined' ? location.search : '',
          pathname: typeof location !== 'undefined' ? location.pathname : '',
          hostReady: Boolean(viewRouterHost),
        });
        if (active) {
          document.documentElement.classList.add('sdc-boost-view-router-active');
          ensureViewRouterShellStyle(reason);
        } else {
          document.documentElement.classList.remove('sdc-boost-view-router-active');
        }
        if (viewRouterHost) {
          if (active) {
            pinViewRouterHostToBody(viewRouterHost);
          }
          viewRouterHost.style.cssText = active
            ? `
            position: fixed !important;
            inset: 0 !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100vh !important;
            min-height: 100dvh !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            z-index: 2147483647 !important;
            isolation: isolate !important;
            pointer-events: auto !important;
            display: block !important;
            visibility: visible !important;
          `
            : `
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 2147483647 !important;
            pointer-events: none !important;
            display: none !important;
            visibility: hidden !important;
          `;
        } else {
          viewRouterWarn('host not ready yet; will retry', { reason, active });
        }
        document.documentElement.style.overflow = active ? 'hidden' : '';
        document.body.style.overflow = active ? 'hidden' : '';
      }

      viewRouterLog('init View Router (top window)', {
        href: location.href,
        search: location.search,
        boostPath: getBoostViewPathFromLocation(),
      });

      const viewRouterUI = await createShadowRootUi(ctx, {
        name: 'sdc-boost-view-router',
        position: 'overlay',
        anchor: 'body',
        onMount: (container) => {
          try {
            const root = container.getRootNode();
            const host: HTMLElement | null =
              root instanceof ShadowRoot
                ? root.host instanceof HTMLElement
                  ? root.host
                  : null
                : container.parentElement;
            if (!host) {
              viewRouterWarn('could not resolve shadow host', { rootType: root?.constructor?.name });
            }
            viewRouterHost = host ?? null;
            if (viewRouterHost) {
              pinViewRouterHostToBody(viewRouterHost);
            }

            container.style.cssText = `
          width: 100% !important;
          height: 100% !important;
          pointer-events: auto !important;
          overflow: hidden !important;
        `;

            viewRouterApp = createApp(SdcHubApp);
            viewRouterApp.use(VueDndKitPlugin);
            viewRouterApp.mount(container);
            viewRouterLog('View Router Vue mounted');
            updateViewRouterVisibility('onMount');
          } catch (e) {
            viewRouterWarn('View Router onMount failed', e);
            throw e;
          }
          return viewRouterApp;
        },
        onRemove: (app) => {
          app?.unmount();
        },
      });

      viewRouterUI.mount();

      const scheduleVisibility = (reason: string) => {
        updateViewRouterVisibility(reason);
        if (!viewRouterHost) {
          queueMicrotask(() => updateViewRouterVisibility(`${reason}:retry-microtask`));
          requestAnimationFrame(() => updateViewRouterVisibility(`${reason}:retry-rAF`));
          setTimeout(() => updateViewRouterVisibility(`${reason}:retry-timeout0`), 0);
        }
      };

      navigationWatcher.onNavigation(() => scheduleVisibility('navigationWatcher'));
      window.addEventListener('hashchange', () => scheduleVisibility('hashchange'));
      window.addEventListener('popstate', () => scheduleVisibility('popstate'));

      scheduleVisibility('initial');
    }

    if (window === window.top && isViewRouterActiveRoute(getBoostViewPathFromLocation())) {
      viewRouterLog('standalone mode: skipping site integration modules', {
        boostPath: getBoostViewPathFromLocation(),
        href: location.href,
      });
      await countersManager.initialize().catch((error) => {
        console.error('[SDC Boost] Failed to initialize counters:', error);
      });
      (window as any).__sdcBoostCounters = countersManager;

      setTimeout(() => {
        websocketManager
          .connect()
          .then(() => {
            websocketHandlers.initialize();
          })
          .catch((error) => {
            console.error('[SDC Boost] Failed to initialize WebSocket:', error);
          });
      }, 300);
      (window as any).__sdcBoostWebSocket = websocketManager;

      await mountViewRouterUi();
      return;
    }

    const moduleManager = new ModuleManager();
    const adBlockModule = new AdBlockModule();
    moduleManager.register(adBlockModule);

    if (window !== window.top) {
      viewRouterLog('skip View Router (not top window)', {
        href: location.href,
        boostPath: getBoostViewPathFromLocation(),
      });
    } else {
      await countersManager.initialize().catch((error) => {
        console.error('[SDC Boost] Failed to initialize counters:', error);
      });
      await mountViewRouterUi();
    }

    moduleManager.initialize().catch(console.error);

    browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'MODULE_TOGGLE') {
        const { moduleId, enabled } = message;
        if (enabled) {
          moduleManager.enableModule(moduleId).catch(console.error);
        } else {
          moduleManager.disableModule(moduleId).catch(console.error);
        }
      } else if (message.type === 'MODULE_CONFIG_UPDATE') {
        const { moduleId, config } = message;
        moduleManager.updateModuleConfig(moduleId, config).catch(console.error);
      }
    });

    (window as any).__sdcBoostModuleManager = moduleManager;

    countersManager.initialize().catch((error) => {
      console.error('[SDC Boost] Failed to initialize counters:', error);
    });

    setTimeout(() => {
      websocketManager
        .connect()
        .then(() => {
          websocketHandlers.initialize();
        })
        .catch((error) => {
          console.error('[SDC Boost] Failed to initialize WebSocket:', error);
        });
    }, 300);

    (window as any).__sdcBoostWebSocket = websocketManager;
    (window as any).__sdcBoostCounters = countersManager;
  },
});
