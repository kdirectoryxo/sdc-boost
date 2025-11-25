import type { ModuleConfigOption } from './types';

/**
 * Abstract base class for all SDC Boost modules
 */
export abstract class BaseModule {
    protected enabled: boolean = false;
    protected observer: MutationObserver | null = null;
    protected config: Record<string, any> = {};

    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly description: string,
        public readonly category: string = 'General',
        public readonly configOptions: ModuleConfigOption[] = []
    ) {
        // Initialize config with defaults
        this.config = {};
        this.configOptions.forEach(option => {
            this.config[option.key] = option.default;
        });
    }

    /**
     * Get the current configuration
     */
    getConfig(): Record<string, any> {
        return { ...this.config };
    }

    /**
     * Get a specific config value
     */
    getConfigValue(key: string): any {
        return this.config[key];
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Record<string, any>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Set a specific config value
     */
    setConfigValue(key: string, value: any): void {
        this.config[key] = value;
    }

    /**
     * Initialize the module
     */
    abstract init(): void | Promise<void>;

    /**
     * Cleanup when module is disabled
     */
    abstract cleanup(): void | Promise<void>;

    /**
     * Enable the module
     */
    async enable(): Promise<void> {
        if (this.enabled) return;
        this.enabled = true;
        await this.init();
        console.log(`SDC Boost: Module "${this.name}" enabled`);
    }

    /**
     * Disable the module
     */
    async disable(): Promise<void> {
        if (!this.enabled) return;
        this.enabled = false;
        await this.cleanup();
        console.log(`SDC Boost: Module "${this.name}" disabled`);
    }

    /**
     * Check if module is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Setup MutationObserver for watching DOM changes
     */
    protected setupObserver(
        target: Node,
        callback: MutationCallback,
        options?: MutationObserverInit
    ): void {
        this.cleanupObserver();
        this.observer = new MutationObserver(callback);
        this.observer.observe(target, {
            childList: true,
            subtree: true,
            ...options,
        });
    }

    /**
     * Cleanup MutationObserver
     */
    protected cleanupObserver(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

