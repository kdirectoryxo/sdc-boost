import { BaseModule } from './BaseModule';
import { getModuleState, setModuleState, getModuleConfig, setModuleConfig } from '../storage';

/**
 * Manages all modules and their enabled/disabled states
 */
export class ModuleManager {
    private modules: Map<string, BaseModule> = new Map();
    private initialized: boolean = false;

    /**
     * Register a module
     */
    register(module: BaseModule): void {
        this.modules.set(module.id, module);
    }

    /**
     * Get a module by ID
     */
    getModule(id: string): BaseModule | undefined {
        return this.modules.get(id);
    }

    /**
     * Get all registered modules
     */
    getAllModules(): BaseModule[] {
        return Array.from(this.modules.values());
    }

    /**
     * Initialize all modules based on their stored state and configuration
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Initialize modules in parallel for faster startup
        const initPromises = Array.from(this.modules.values()).map(async (module) => {
            // Load configuration
            const config = await getModuleConfig(module.id);
            if (config && Object.keys(config).length > 0) {
                module.updateConfig(config);
            }

            // Enable if stored state says so
            const isEnabled = await getModuleState(module.id);
            if (isEnabled) {
                await module.enable();
            }
        });

        // Wait for all modules to initialize in parallel
        await Promise.all(initPromises);

        this.initialized = true;
        console.log('SDC Boost: Module manager initialized');
    }

    /**
     * Update module configuration
     */
    async updateModuleConfig(moduleId: string, config: Record<string, any>): Promise<void> {
        const module = this.modules.get(moduleId);
        if (!module) {
            throw new Error(`Module "${moduleId}" not found`);
        }

        module.updateConfig(config);
        await setModuleConfig(moduleId, config);

        // If module is enabled, reinitialize to apply new config
        if (module.isEnabled()) {
            await module.disable();
            await module.enable();
        }
    }

    /**
     * Enable a module
     */
    async enableModule(id: string): Promise<void> {
        const module = this.modules.get(id);
        if (!module) {
            throw new Error(`Module "${id}" not found`);
        }

        await module.enable();
        await setModuleState(id, true);
    }

    /**
     * Disable a module
     */
    async disableModule(id: string): Promise<void> {
        const module = this.modules.get(id);
        if (!module) {
            throw new Error(`Module "${id}" not found`);
        }

        await module.disable();
        await setModuleState(id, false);
    }

    /**
     * Toggle a module's state
     */
    async toggleModule(id: string): Promise<boolean> {
        const module = this.modules.get(id);
        if (!module) {
            throw new Error(`Module "${id}" not found`);
        }

        if (module.isEnabled()) {
            await this.disableModule(id);
            return false;
        } else {
            await this.enableModule(id);
            return true;
        }
    }

    /**
     * Get enabled state of a module
     */
    async getModuleEnabledState(id: string): Promise<boolean> {
        return await getModuleState(id);
    }
}

