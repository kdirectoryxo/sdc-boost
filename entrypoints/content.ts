import { ModuleManager } from '@/lib/modules/ModuleManager';
import { AgeFilterModule } from '@/lib/modules/AgeFilterModule';
import { AgeHighlighterModule } from '@/lib/modules/AgeHighlighterModule';
import { AdBlockModule } from '@/lib/modules/AdBlockModule';
import { ChatScrollFixModule } from '@/lib/modules/ChatScrollFixModule';
import { ChatExportModule } from '@/lib/modules/ChatExportModule';
import { NavbarBoostButtonModule } from '@/lib/modules/NavbarBoostButtonModule';
import { toast } from '@/lib/toast';
import { confirm } from '@/lib/confirm';

// import '~/assets/tailwind.css';

export default defineContentScript({
  matches: ['*://*.sdc.com/react/*'],
  main() {
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
  },
});
