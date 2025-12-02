import { ModuleManager } from '@/lib/modules/ModuleManager';
import { AgeFilterModule } from '@/lib/modules/AgeFilterModule';
import { AgeHighlighterModule } from '@/lib/modules/AgeHighlighterModule';
import { AdBlockModule } from '@/lib/modules/AdBlockModule';
import { ChatScrollFixModule } from '@/lib/modules/ChatScrollFixModule';
import { ChatExportModule } from '@/lib/modules/ChatExportModule';
import { NavbarBoostButtonModule } from '@/lib/modules/NavbarBoostButtonModule';
import { EnhancedClickModule } from '@/lib/modules/EnhancedClickModule';
import { ChatDialogModule } from '@/lib/modules/ChatDialogModule';
import { toast } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { createApp, ref, watch } from 'vue';
import ChatDialogWrapper from '@/components/ChatDialogWrapper.vue';
import { websocketManager } from '@/lib/websocket-manager';
import { countersManager } from '@/lib/counters-manager';
import '~/assets/tailwind.css';

export default defineContentScript({
  matches: ['*://*.sdc.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('SDC Boost: Content script loaded');

    // Initialize module manager
    const moduleManager = new ModuleManager();

    // Register all modules
    const ageFilterModule = new AgeFilterModule();
    moduleManager.register(ageFilterModule);

    const ageHighlighterModule = new AgeHighlighterModule();
    moduleManager.register(ageHighlighterModule);

    const adBlockModule = new AdBlockModule();
    moduleManager.register(adBlockModule);

    const chatScrollFixModule = new ChatScrollFixModule();
    moduleManager.register(chatScrollFixModule);

    const chatExportModule = new ChatExportModule();
    moduleManager.register(chatExportModule);

    const navbarBoostButtonModule = new NavbarBoostButtonModule();
    moduleManager.register(navbarBoostButtonModule);

    const enhancedClickModule = new EnhancedClickModule();
    moduleManager.register(enhancedClickModule);

    const chatDialogModule = new ChatDialogModule();
    moduleManager.register(chatDialogModule);

    // Set up Vue Chat Dialog UI
    let chatDialogApp: ReturnType<typeof createApp> | null = null;
    let overlayHost: HTMLElement | null = null;
    let overlayContainer: HTMLElement | null = null;
    let dialogController: { open: () => void; close: () => void } | null = null;
    
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

    // Mount the UI (hidden initially)
    chatDialogUI.mount();
    
    // Expose methods globally for module to use (after UI is mounted)
    // Wait a tick for Vue app to initialize
    setTimeout(() => {
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
    }, 100);

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

    // Initialize WebSocket connection (wait a bit for page to be ready)
    setTimeout(() => {
      websocketManager.connect().catch((error) => {
        console.error('[SDC Boost] Failed to initialize WebSocket:', error);
      });
    }, 1000);

    // Initialize counters manager (wait for WebSocket to be ready)
    setTimeout(() => {
      countersManager.initialize().catch((error) => {
        console.error('[SDC Boost] Failed to initialize counters:', error);
      });
    }, 2000);

    // Make WebSocket manager available globally
    (window as any).__sdcBoostWebSocket = websocketManager;

    // Make counters manager available globally
    (window as any).__sdcBoostCounters = countersManager;
  },
});
