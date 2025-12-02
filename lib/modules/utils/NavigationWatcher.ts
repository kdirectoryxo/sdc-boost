/**
 * Shared utility for detecting navigation changes in React apps
 * Handles hashchange, popstate, and React Router navigation
 */
export class NavigationWatcher {
    private navigationHandlers: Set<() => void> = new Set();
    private originalPushState: typeof history.pushState;
    private originalReplaceState: typeof history.replaceState;
    private hashChangeHandler: (() => void) | null = null;
    private popStateHandler: (() => void) | null = null;
    private isInitialized = false;

    constructor() {
        this.originalPushState = history.pushState;
        this.originalReplaceState = history.replaceState;
    }

    /**
     * Initialize navigation watcher (only needs to be called once globally)
     */
    initialize(): void {
        if (this.isInitialized) {
            return;
        }

        // Override pushState to detect React Router navigation
        history.pushState = (...args: Parameters<typeof history.pushState>) => {
            this.originalPushState.apply(history, args);
            this.triggerNavigation();
        };

        // Override replaceState to detect React Router navigation
        history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
            this.originalReplaceState.apply(history, args);
            this.triggerNavigation();
        };

        // Listen for hash changes (hash routing)
        this.hashChangeHandler = () => {
            this.triggerNavigation();
        };
        window.addEventListener('hashchange', this.hashChangeHandler);

        // Listen for popstate (browser back/forward)
        this.popStateHandler = () => {
            this.triggerNavigation();
        };
        window.addEventListener('popstate', this.popStateHandler);

        this.isInitialized = true;
        console.log('[NavigationWatcher] Initialized');
    }

    /**
     * Subscribe to navigation events
     * @param callback Function to call when navigation is detected
     * @returns Unsubscribe function
     */
    onNavigation(callback: () => void): () => void {
        if (!this.isInitialized) {
            this.initialize();
        }

        this.navigationHandlers.add(callback);

        // Return unsubscribe function
        return () => {
            this.navigationHandlers.delete(callback);
        };
    }

    /**
     * Trigger all navigation handlers
     */
    private triggerNavigation(): void {
        this.navigationHandlers.forEach((handler) => {
            try {
                handler();
            } catch (error) {
                console.error('[NavigationWatcher] Error in navigation handler:', error);
            }
        });
    }

    /**
     * Cleanup and restore original history methods
     */
    destroy(): void {
        if (!this.isInitialized) {
            return;
        }

        // Restore original history methods
        history.pushState = this.originalPushState;
        history.replaceState = this.originalReplaceState;

        // Remove event listeners
        if (this.hashChangeHandler) {
            window.removeEventListener('hashchange', this.hashChangeHandler);
            this.hashChangeHandler = null;
        }

        if (this.popStateHandler) {
            window.removeEventListener('popstate', this.popStateHandler);
            this.popStateHandler = null;
        }

        // Clear all handlers
        this.navigationHandlers.clear();
        this.isInitialized = false;
        console.log('[NavigationWatcher] Destroyed');
    }
}

// Create singleton instance
export const navigationWatcher = new NavigationWatcher();




