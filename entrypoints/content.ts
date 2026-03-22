import { ModuleManager } from '@/lib/modules/ModuleManager';
import { AgeFilterModule } from '@/lib/modules/AgeFilterModule';
import { AgeHighlighterModule } from '@/lib/modules/AgeHighlighterModule';
import { AdBlockModule } from '@/lib/modules/AdBlockModule';
import { NavbarBoostButtonModule } from '@/lib/modules/NavbarBoostButtonModule';
import { EnhancedClickModule } from '@/lib/modules/EnhancedClickModule';
import { ProfileMessengerButtonModule } from '@/lib/modules/ProfileMessengerButtonModule';
import { ChatDialogModule } from '@/lib/modules/ChatDialogModule';
import { NewsfeedModule } from '@/lib/modules/NewsfeedModule';
import { PeopleModule } from '@/lib/modules/PeopleModule';
import { toast } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { createApp, ref, watch } from 'vue';
import VueDndKitPlugin from '@vue-dnd-kit/core';
import ChatDialogWrapper from '@/components/ChatDialogWrapper.vue';
import ModuleControlPanelDialogWrapper from '@/components/ModuleControlPanelDialogWrapper.vue';
import NewsfeedDialogWrapper from '@/components/NewsfeedDialogWrapper.vue';
import PeopleDialogWrapper from '@/components/PeopleDialogWrapper.vue';
import SdcHubApp from '@/components/SdcHubApp.vue';
import { navigationWatcher } from '@/lib/modules/utils/NavigationWatcher';
import {
  getBoostViewPathFromLocation,
  isViewRouterActiveRoute,
  migrateHashBoostRouteToQuery,
  migrateLegacyDashboardBoostPath,
  persistBoostPathFromCurrentLocationEarly,
} from '@/lib/view-router/routes';
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

    if (
      window === window.top &&
      isViewRouterActiveRoute(getBoostViewPathFromLocation())
    ) {
      viewRouterLog('standalone mode: skipping site integration modules', {
        boostPath: getBoostViewPathFromLocation(),
        href: location.href,
      });
      // Same runtime as the full content script: counters + WebSocket must run or hub badges
      // stay on null/fallback values (raw API messenger never loads).
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

    // Initialize module manager
    const moduleManager = new ModuleManager();

    // Register all modules
    // Register ChatDialog early since it's UI-critical
    const chatDialogModule = new ChatDialogModule();
    moduleManager.register(chatDialogModule);

    const ageFilterModule = new AgeFilterModule();
    moduleManager.register(ageFilterModule);

    const ageHighlighterModule = new AgeHighlighterModule();
    moduleManager.register(ageHighlighterModule);

    const adBlockModule = new AdBlockModule();
    moduleManager.register(adBlockModule);

    const navbarBoostButtonModule = new NavbarBoostButtonModule();
    moduleManager.register(navbarBoostButtonModule);

    const enhancedClickModule = new EnhancedClickModule();
    moduleManager.register(enhancedClickModule);

    const profileMessengerButtonModule = new ProfileMessengerButtonModule();
    moduleManager.register(profileMessengerButtonModule);

    const newsfeedModule = new NewsfeedModule();
    moduleManager.register(newsfeedModule);

    const peopleModule = new PeopleModule();
    moduleManager.register(peopleModule);

    // Set up Vue Chat Dialog UI
    let chatDialogApp: ReturnType<typeof createApp> | null = null;
    let overlayHost: HTMLElement | null = null;
    let overlayContainer: HTMLElement | null = null;
    let dialogController: { open: () => void; close: () => void } | null = null;
    
    // Set up Vue Module Control Panel Dialog UI
    let moduleControlPanelDialogApp: ReturnType<typeof createApp> | null = null;
    let moduleControlPanelOverlayHost: HTMLElement | null = null;
    let moduleControlPanelOverlayContainer: HTMLElement | null = null;
    let moduleControlPanelDialogController: { open: () => void; close: () => void } | null = null;
    
    // Set up Vue Newsfeed Dialog UI
    let newsfeedDialogApp: ReturnType<typeof createApp> | null = null;
    let newsfeedOverlayHost: HTMLElement | null = null;
    let newsfeedOverlayContainer: HTMLElement | null = null;
    let newsfeedDialogController: { open: () => void; close: () => void } | null = null;
    
    // Set up Vue People Dialog UI
    let peopleDialogApp: ReturnType<typeof createApp> | null = null;
    let peopleOverlayHost: HTMLElement | null = null;
    let peopleOverlayContainer: HTMLElement | null = null;
    let peopleDialogController: { open: () => void; close: () => void; openProfile: (userId: number) => void } | null = null;

    const chatDialogUI = await createShadowRootUi(ctx, {
      name: 'chat-dialog-ui',
      position: 'overlay',
      anchor: 'body',
      onMount: (container) => {
        overlayContainer = container;
        
        // Ensure container is full-screen and visible
        const shadowRoot = container.getRootNode() as ShadowRoot;
        const host = shadowRoot.host as HTMLElement;
        overlayHost = host;
        
        if (host) {
          host.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 999999 !important;
            pointer-events: none !important;
          `;
        }
        
        // Container should allow pointer events for the dialog
        container.style.cssText = `
          width: 100% !important;
          height: 100% !important;
          pointer-events: auto !important;
        `;

        // Create Vue app with wrapper component
        chatDialogApp = createApp(ChatDialogWrapper);
        chatDialogApp.use(VueDndKitPlugin);

        // Mount Vue app to container
        const instance = chatDialogApp.mount(container);
        
        // Get the exposed methods from the component instance
        if (instance && typeof instance === 'object' && 'open' in instance && 'close' in instance) {
          dialogController = {
            open: () => {
              console.log('[ChatDialog] Calling wrapper open method');
              (instance as any).open();
            },
            close: () => {
              (instance as any).close();
            },
          };
        } else {
          console.error('[ChatDialog] Failed to get exposed methods from component instance');
        }

        return chatDialogApp;
      },
      onRemove: (app) => {
        app?.unmount();
      },
    });

    // Mount the UI (hidden initially) - don't await, let it mount in background
    chatDialogUI.mount();
    
    // Expose methods globally for module to use (after UI is mounted)
    // Use requestAnimationFrame for faster initialization
    requestAnimationFrame(() => {
      (window as any).__sdcBoostChatDialog = {
        open: () => {
          console.log('[ChatDialog] Opening dialog via global method');
          console.log('[ChatDialog] overlayHost exists:', !!overlayHost);
          console.log('[ChatDialog] overlayContainer exists:', !!overlayContainer);
          console.log('[ChatDialog] dialogController exists:', !!dialogController);
          
          // Ensure overlay is visible and covers everything
          if (overlayHost) {
            overlayHost.style.cssText = `
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              z-index: 999999 !important;
              pointer-events: none !important;
              display: block !important;
              visibility: visible !important;
            `;
          }
          if (overlayContainer) {
            overlayContainer.style.pointerEvents = 'auto';
          }
          
          // Use the controller from Vue app
          if (dialogController) {
            dialogController.open();
          } else {
            console.error('[ChatDialog] Dialog controller not initialized yet');
          }
        },
        close: () => {
          if (dialogController) {
            dialogController.close();
          }
        },
      };
    });

    // Set up Module Control Panel Dialog UI
    const moduleControlPanelDialogUI = await createShadowRootUi(ctx, {
      name: 'module-control-panel-dialog-ui',
      position: 'overlay',
      anchor: 'body',
      onMount: (container) => {
        moduleControlPanelOverlayContainer = container;
        
        // Ensure container is full-screen and visible
        const shadowRoot = container.getRootNode() as ShadowRoot;
        const host = shadowRoot.host as HTMLElement;
        moduleControlPanelOverlayHost = host;
        
        if (host) {
          host.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 999999 !important;
            pointer-events: none !important;
          `;
        }
        
        // Container should allow pointer events for the dialog
        container.style.cssText = `
          width: 100% !important;
          height: 100% !important;
          pointer-events: auto !important;
        `;

        // Create Vue app with wrapper component
        moduleControlPanelDialogApp = createApp(ModuleControlPanelDialogWrapper);

        // Mount Vue app to container
        const instance = moduleControlPanelDialogApp.mount(container);
        
        // Get the exposed methods from the component instance
        if (instance && typeof instance === 'object' && 'open' in instance && 'close' in instance) {
          moduleControlPanelDialogController = {
            open: () => {
              console.log('[ModuleControlPanelDialog] Calling wrapper open method');
              (instance as any).open();
            },
            close: () => {
              (instance as any).close();
            },
          };
        } else {
          console.error('[ModuleControlPanelDialog] Failed to get exposed methods from component instance');
        }

        return moduleControlPanelDialogApp;
      },
      onRemove: (app) => {
        app?.unmount();
      },
    });

    // Mount the UI (hidden initially) - don't await, let it mount in background
    moduleControlPanelDialogUI.mount();
    
    // Expose methods globally for module to use (after UI is mounted)
    // Use requestAnimationFrame for faster initialization
    requestAnimationFrame(() => {
      (window as any).__sdcBoostModuleControlPanel = {
        open: () => {
          console.log('[ModuleControlPanelDialog] Opening dialog via global method');
          console.log('[ModuleControlPanelDialog] overlayHost exists:', !!moduleControlPanelOverlayHost);
          console.log('[ModuleControlPanelDialog] overlayContainer exists:', !!moduleControlPanelOverlayContainer);
          console.log('[ModuleControlPanelDialog] dialogController exists:', !!moduleControlPanelDialogController);
          
          // Ensure overlay is visible and covers everything
          if (moduleControlPanelOverlayHost) {
            moduleControlPanelOverlayHost.style.cssText = `
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              z-index: 999999 !important;
              pointer-events: none !important;
              display: block !important;
              visibility: visible !important;
            `;
          }
          if (moduleControlPanelOverlayContainer) {
            moduleControlPanelOverlayContainer.style.pointerEvents = 'auto';
          }
          
          // Use the controller from Vue app
          if (moduleControlPanelDialogController) {
            moduleControlPanelDialogController.open();
          } else {
            console.error('[ModuleControlPanelDialog] Dialog controller not initialized yet');
          }
        },
        close: () => {
          if (moduleControlPanelDialogController) {
            moduleControlPanelDialogController.close();
          }
        },
      };
    });

    // Set up Newsfeed Dialog UI
    const newsfeedDialogUI = await createShadowRootUi(ctx, {
      name: 'newsfeed-dialog-ui',
      position: 'overlay',
      anchor: 'body',
      onMount: (container) => {
        newsfeedOverlayContainer = container;
        
        // Ensure container is full-screen and visible
        const shadowRoot = container.getRootNode() as ShadowRoot;
        const host = shadowRoot.host as HTMLElement;
        newsfeedOverlayHost = host;
        
        if (host) {
          host.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 999999 !important;
            pointer-events: none !important;
          `;
        }
        
        // Container should allow pointer events for the dialog
        container.style.cssText = `
          width: 100% !important;
          height: 100% !important;
          pointer-events: auto !important;
        `;

        // Create Vue app with wrapper component
        newsfeedDialogApp = createApp(NewsfeedDialogWrapper);

        // Mount Vue app to container
        const instance = newsfeedDialogApp.mount(container);
        
        // Get the exposed methods from the component instance
        if (instance && typeof instance === 'object' && 'open' in instance && 'close' in instance) {
          newsfeedDialogController = {
            open: () => {
              console.log('[NewsfeedDialog] Calling wrapper open method');
              (instance as any).open();
            },
            close: () => {
              (instance as any).close();
            },
          };
        } else {
          console.error('[NewsfeedDialog] Failed to get exposed methods from component instance');
        }

        return newsfeedDialogApp;
      },
      onRemove: (app) => {
        app?.unmount();
      },
    });

    // Mount the UI (hidden initially) - don't await, let it mount in background
    newsfeedDialogUI.mount();
    
    // Expose methods globally for module to use (after UI is mounted)
    // Use requestAnimationFrame for faster initialization
    requestAnimationFrame(() => {
      (window as any).__sdcBoostNewsfeedDialog = {
        open: () => {
          console.log('[NewsfeedDialog] Opening dialog via global method');
          console.log('[NewsfeedDialog] overlayHost exists:', !!newsfeedOverlayHost);
          console.log('[NewsfeedDialog] overlayContainer exists:', !!newsfeedOverlayContainer);
          console.log('[NewsfeedDialog] dialogController exists:', !!newsfeedDialogController);
          
          // Ensure overlay is visible and covers everything
          if (newsfeedOverlayHost) {
            newsfeedOverlayHost.style.cssText = `
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              z-index: 999999 !important;
              pointer-events: none !important;
              display: block !important;
              visibility: visible !important;
            `;
          }
          if (newsfeedOverlayContainer) {
            newsfeedOverlayContainer.style.pointerEvents = 'auto';
          }
          
          // Use the controller from Vue app
          if (newsfeedDialogController) {
            newsfeedDialogController.open();
          } else {
            console.error('[NewsfeedDialog] Dialog controller not initialized yet');
          }
        },
        close: () => {
          if (newsfeedDialogController) {
            newsfeedDialogController.close();
          }
        },
      };
    });

    // Set up People Dialog UI
    const peopleDialogUI = await createShadowRootUi(ctx, {
      name: 'people-dialog-ui',
      position: 'overlay',
      anchor: 'body',
      onMount: (container) => {
        peopleOverlayContainer = container;
        
        // Ensure container is full-screen and visible
        const shadowRoot = container.getRootNode() as ShadowRoot;
        const host = shadowRoot.host as HTMLElement;
        peopleOverlayHost = host;
        
        if (host) {
          host.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 999999 !important;
            pointer-events: none !important;
          `;
        }
        
        // Container should allow pointer events for the dialog
        container.style.cssText = `
          width: 100% !important;
          height: 100% !important;
          pointer-events: auto !important;
        `;

        // Create Vue app with wrapper component
        peopleDialogApp = createApp(PeopleDialogWrapper);

        // Mount Vue app to container
        const instance = peopleDialogApp.mount(container);
        
        // Get the exposed methods from the component instance
        if (instance && typeof instance === 'object' && 'open' in instance && 'close' in instance) {
          peopleDialogController = {
            open: () => {
              console.log('[PeopleDialog] Calling wrapper open method');
              (instance as any).open();
            },
            close: () => {
              (instance as any).close();
            },
            openProfile: (userId: number) => {
              console.log('[PeopleDialog] Calling wrapper openProfile method for user:', userId);
              (instance as any).openProfile(userId);
            },
          };
        } else {
          console.error('[PeopleDialog] Failed to get exposed methods from component instance');
        }

        return peopleDialogApp;
      },
      onRemove: (app) => {
        app?.unmount();
      },
    });

    // Mount the UI (hidden initially) - don't await, let it mount in background
    peopleDialogUI.mount();

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
    
    // Expose methods globally for module to use (after UI is mounted)
    // Use requestAnimationFrame for faster initialization
    requestAnimationFrame(() => {
      (window as any).__sdcBoostPeopleDialog = {
        open: () => {
          console.log('[PeopleDialog] Opening dialog via global method');
          console.log('[PeopleDialog] overlayHost exists:', !!peopleOverlayHost);
          console.log('[PeopleDialog] overlayContainer exists:', !!peopleOverlayContainer);
          console.log('[PeopleDialog] dialogController exists:', !!peopleDialogController);
          
          // Ensure overlay is visible and covers everything
          if (peopleOverlayHost) {
            peopleOverlayHost.style.cssText = `
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              z-index: 999999 !important;
              pointer-events: none !important;
              display: block !important;
              visibility: visible !important;
            `;
          }
          if (peopleOverlayContainer) {
            peopleOverlayContainer.style.pointerEvents = 'auto';
          }
          
          // Use the controller from Vue app
          if (peopleDialogController) {
            peopleDialogController.open();
          } else {
            console.error('[PeopleDialog] Dialog controller not initialized yet');
          }
        },
        close: () => {
          if (peopleDialogController) {
            peopleDialogController.close();
          }
        },
      };
    });

    // Expose profile dialog opener globally (for PeopleCard to use)
    requestAnimationFrame(() => {
      (window as any).__sdcBoostOpenProfileDialog = (userId: number) => {
        console.log('[PeopleDialog] Opening profile for user:', userId);
        if (peopleDialogController) {
          peopleDialogController.openProfile(userId);
        } else {
          // Fallback to opening in new tab if controller not available
          window.open(`https://www.sdc.com/react/#/profile?idUser=${userId}`, '_blank');
        }
      };
    });

    // Initialize modules based on stored state
    moduleManager.initialize().catch(console.error);

    // Listen for messages from popup and options pages
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

    // Make module manager available globally for debugging
    (window as any).__sdcBoostModuleManager = moduleManager;

    // Make toast system available globally for modules
    (window as any).__sdcBoostToast = toast;

    // Make confirm dialog system available globally for modules
    (window as any).__sdcBoostConfirm = confirm;

    // Initialize counters manager immediately (doesn't require WebSocket connection)
    countersManager.initialize().catch((error) => {
      console.error('[SDC Boost] Failed to initialize counters:', error);
    });

    // Initialize WebSocket connection (reduced delay for faster initialization)
    setTimeout(() => {
      websocketManager.connect().then(() => {
        // Initialize WebSocket event handlers after connection is established
        websocketHandlers.initialize();
      }).catch((error) => {
        console.error('[SDC Boost] Failed to initialize WebSocket:', error);
      });
    }, 300);

    // Make WebSocket manager available globally
    (window as any).__sdcBoostWebSocket = websocketManager;

    // Make counters manager available globally
    (window as any).__sdcBoostCounters = countersManager;
  },
});
