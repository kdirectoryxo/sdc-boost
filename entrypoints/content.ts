import { ModuleManager } from '@/lib/modules/ModuleManager';
import { AgeFilterModule } from '@/lib/modules/AgeFilterModule';
import { AgeHighlighterModule } from '@/lib/modules/AgeHighlighterModule';
import { AdBlockModule } from '@/lib/modules/AdBlockModule';
import { ChatExportModule } from '@/lib/modules/ChatExportModule';
import { NavbarBoostButtonModule } from '@/lib/modules/NavbarBoostButtonModule';
import { EnhancedClickModule } from '@/lib/modules/EnhancedClickModule';
import { ChatDialogModule } from '@/lib/modules/ChatDialogModule';
import { toast } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { createApp, ref, watch } from 'vue';
import ChatDialogWrapper from '@/components/ChatDialogWrapper.vue';
import ModuleControlPanelDialogWrapper from '@/components/ModuleControlPanelDialogWrapper.vue';
import { websocketManager } from '@/lib/websocket-manager';
import { countersManager } from '@/lib/counters-manager';
import { websocketHandlers } from '@/lib/websocket-handlers';
import '~/assets/tailwind.css';

export default defineContentScript({
  matches: ['*://*.sdc.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('SDC Boost: Content script loaded');

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

    const chatExportModule = new ChatExportModule();
    moduleManager.register(chatExportModule);

    const navbarBoostButtonModule = new NavbarBoostButtonModule();
    moduleManager.register(navbarBoostButtonModule);

    const enhancedClickModule = new EnhancedClickModule();
    moduleManager.register(enhancedClickModule);

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
