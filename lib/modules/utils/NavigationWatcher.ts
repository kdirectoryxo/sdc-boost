/**
 * Shared utility for detecting navigation changes in React apps
 * Handles hashchange, popstate, and React Router navigation
 *
 * React Router (and similar) often replaces history.pushState/replaceState after load,
 * which removes our patches. We re-apply periodically and poll location.href because
 * pushState does not fire hashchange and we may miss events while unpatchted.
 */
export class NavigationWatcher {
    private navigationHandlers: Set<() => void> = new Set();
    /** Current underlying implementation (native or another framework wrapper) */
    private underlyingPushState: typeof history.pushState;
    private underlyingReplaceState: typeof history.replaceState;
    private ourPushState!: typeof history.pushState;
    private ourReplaceState!: typeof history.replaceState;
    private hashChangeHandler: (() => void) | null = null;
    private popStateHandler: (() => void) | null = null;
    private isInitialized = false;
    private ensurePatchIntervalId: ReturnType<typeof setInterval> | null = null;
    private locationPollIntervalId: ReturnType<typeof setInterval> | null = null;
    private lastPolledHref = '';

    constructor() {
        this.underlyingPushState = history.pushState.bind(history);
        this.underlyingReplaceState = history.replaceState.bind(history);
    }

    /**
     * Initialize navigation watcher (only needs to be called once globally)
     */
    initialize(): void {
        if (this.isInitialized) {
            return;
        }

        this.installHistoryPatch();

        this.hashChangeHandler = () => {
            this.triggerNavigation();
        };
        window.addEventListener('hashchange', this.hashChangeHandler);

        this.popStateHandler = () => {
            this.triggerNavigation();
        };
        window.addEventListener('popstate', this.popStateHandler);

        this.lastPolledHref = location.href;
        this.locationPollIntervalId = window.setInterval(() => {
            const href = location.href;
            if (href !== this.lastPolledHref) {
                this.lastPolledHref = href;
                this.triggerNavigation();
            }
        }, 100);

        this.ensurePatchIntervalId = window.setInterval(() => {
            this.ensureHistoryPatch();
        }, 250);

        this.isInitialized = true;
        console.log('[NavigationWatcher] Initialized');
    }

    /**
     * Wrap history methods so we always see navigations; re-point underlying when another
     * library (e.g. React Router) replaces history.pushState after us.
     */
    private installHistoryPatch(): void {
        this.ourPushState = (...args: Parameters<typeof history.pushState>) => {
            const ret = this.underlyingPushState.apply(history, args);
            this.triggerNavigation();
            return ret;
        };
        this.ourReplaceState = (...args: Parameters<typeof history.replaceState>) => {
            const ret = this.underlyingReplaceState.apply(history, args);
            this.triggerNavigation();
            return ret;
        };

        this.underlyingPushState = history.pushState.bind(history);
        this.underlyingReplaceState = history.replaceState.bind(history);
        history.pushState = this.ourPushState;
        history.replaceState = this.ourReplaceState;
    }

    /**
     * If another script replaced pushState/replaceState, wrap the new functions again.
     */
    private ensureHistoryPatch(): void {
        if (!this.isInitialized) return;
        if (history.pushState !== this.ourPushState) {
            this.underlyingPushState = history.pushState.bind(history);
            history.pushState = this.ourPushState;
        }
        if (history.replaceState !== this.ourReplaceState) {
            this.underlyingReplaceState = history.replaceState.bind(history);
            history.replaceState = this.ourReplaceState;
        }
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

        return () => {
            this.navigationHandlers.delete(callback);
        };
    }

    /**
     * Notify subscribers (e.g. after manual URL inspection).
     */
    notifyNavigation(): void {
        this.triggerNavigation();
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

        if (this.ensurePatchIntervalId !== null) {
            window.clearInterval(this.ensurePatchIntervalId);
            this.ensurePatchIntervalId = null;
        }
        if (this.locationPollIntervalId !== null) {
            window.clearInterval(this.locationPollIntervalId);
            this.locationPollIntervalId = null;
        }

        history.pushState = this.underlyingPushState;
        history.replaceState = this.underlyingReplaceState;

        if (this.hashChangeHandler) {
            window.removeEventListener('hashchange', this.hashChangeHandler);
            this.hashChangeHandler = null;
        }

        if (this.popStateHandler) {
            window.removeEventListener('popstate', this.popStateHandler);
            this.popStateHandler = null;
        }

        this.navigationHandlers.clear();
        this.isInitialized = false;
        console.log('[NavigationWatcher] Destroyed');
    }
}

// Create singleton instance
export const navigationWatcher = new NavigationWatcher();
