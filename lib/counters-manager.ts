/**
 * Counters Manager
 * Global state manager for SDC counters with WebSocket updates
 */

import { getCounters } from './sdc-api/counters';
import type { CountersInfo } from './sdc-api-types';
import { websocketManager } from './websocket-manager';

type CounterUpdateCallback = (counters: CountersInfo) => void;
type CounterChangeCallback = (key: string, oldValue: number, newValue: number) => void;

class CountersManager {
    private counters: CountersInfo | null = null;
    private updateCallbacks: Set<CounterUpdateCallback> = new Set();
    private changeCallbacks: Set<CounterChangeCallback> = new Set();
    private refreshInterval: ReturnType<typeof setInterval> | null = null;
    private isInitialized = false;
    private unsubscribeMessage: (() => void) | null = null;
    private unsubscribeSeen: (() => void) | null = null;
    private unsubscribeUnseen: (() => void) | null = null;

    /**
     * Initialize counters manager
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        // Fetch initial counters
        await this.refresh();

        // Set up WebSocket listeners for counter updates
        this.setupWebSocketListeners();

        // Set up periodic refresh (every 5 minutes)
        this.refreshInterval = setInterval(() => {
            this.refresh().catch(console.error);
        }, 5 * 60 * 1000);

        this.isInitialized = true;
        console.log('[CountersManager] Initialized');
    }

    /**
     * Refresh counters from API
     */
    async refresh(): Promise<void> {
        try {
            const response = await getCounters();
            if (response.info.code === 200) {
                const oldCounters = this.counters;
                this.counters = response.info;

                // Notify listeners of update
                this.notifyUpdate();

                // Detect changes and notify
                if (oldCounters) {
                    this.detectChanges(oldCounters, this.counters);
                }
            }
        } catch (error) {
            console.error('[CountersManager] Failed to refresh counters:', error);
        }
    }

    /**
     * Set up WebSocket listeners for counter updates
     */
    private setupWebSocketListeners(): void {
        // Listen for new messages - decrement messenger counter when message is read
        this.unsubscribeMessage = websocketManager.on('message', (data) => {
            // When a new message arrives, it might affect counters
            // We'll refresh counters after a short delay to ensure API is updated
            setTimeout(() => {
                this.refresh().catch(console.error);
            }, 1000);
        });

        // Listen for seen events - might affect messenger counter
        this.unsubscribeSeen = websocketManager.on('seen', (data) => {
            // Refresh counters when messages are seen
            setTimeout(() => {
                this.refresh().catch(console.error);
            }, 500);
        });

        // Listen for unseen events - increment messenger counter
        this.unsubscribeUnseen = websocketManager.on('unseen', (data) => {
            // When a message becomes unseen, increment messenger counter
            if (this.counters) {
                const oldValue = this.counters.messenger;
                this.counters.messenger = oldValue + 1;
                this.notifyUpdate();
                this.notifyChange('messenger', oldValue, this.counters.messenger);
            }
        });
    }

    /**
     * Detect changes between old and new counters
     */
    private detectChanges(oldCounters: CountersInfo, newCounters: CountersInfo): void {
        const keys: (keyof CountersInfo)[] = [
            'online',
            'count_live_streams',
            'email',
            'messenger',
            'viewed',
            'chatroom',
            'feed_counter',
            'admin_feed_counter',
            'speeddating_counter',
            'video_counter',
            'party_counter',
            'business_counter',
            'travelplanner_counter',
            'lifetime_offer',
            'saved_search',
            'live_button',
            'count_live',
        ];

        keys.forEach((key) => {
            const oldValue = oldCounters[key];
            const newValue = newCounters[key];
            if (typeof oldValue === 'number' && typeof newValue === 'number' && oldValue !== newValue) {
                this.notifyChange(key, oldValue, newValue);
            }
        });
    }

    /**
     * Notify all update listeners
     */
    private notifyUpdate(): void {
        if (!this.counters) return;
        const counters = this.counters; // Store reference to avoid null check issues
        this.updateCallbacks.forEach(callback => {
            try {
                callback(counters);
            } catch (error) {
                console.error('[CountersManager] Error in update callback:', error);
            }
        });
    }

    /**
     * Notify all change listeners
     */
    private notifyChange(key: string, oldValue: number, newValue: number): void {
        this.changeCallbacks.forEach(callback => {
            try {
                callback(key, oldValue, newValue);
            } catch (error) {
                console.error('[CountersManager] Error in change callback:', error);
            }
        });
    }

    /**
     * Get current counters
     */
    getCounters(): CountersInfo | null {
        return this.counters;
    }

    /**
     * Get a specific counter value
     */
    getCounter(key: keyof CountersInfo): number | null {
        if (!this.counters) return null;
        const value = this.counters[key];
        return typeof value === 'number' ? value : null;
    }

    /**
     * Subscribe to counter updates
     * @returns Unsubscribe function
     */
    onUpdate(callback: CounterUpdateCallback): () => void {
        this.updateCallbacks.add(callback);
        
        // Immediately call with current counters if available
        if (this.counters) {
            try {
                callback(this.counters);
            } catch (error) {
                console.error('[CountersManager] Error in initial update callback:', error);
            }
        }

        // Return unsubscribe function
        return () => {
            this.updateCallbacks.delete(callback);
        };
    }

    /**
     * Subscribe to counter changes
     * @returns Unsubscribe function
     */
    onChange(callback: CounterChangeCallback): () => void {
        this.changeCallbacks.add(callback);
        
        // Return unsubscribe function
        return () => {
            this.changeCallbacks.delete(callback);
        };
    }

    /**
     * Unsubscribe from counter updates
     */
    offUpdate(callback: CounterUpdateCallback): void {
        this.updateCallbacks.delete(callback);
    }

    /**
     * Unsubscribe from counter changes
     */
    offChange(callback: CounterChangeCallback): void {
        this.changeCallbacks.delete(callback);
    }

    /**
     * Cleanup and destroy manager
     */
    destroy(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        if (this.unsubscribeMessage) {
            this.unsubscribeMessage();
            this.unsubscribeMessage = null;
        }

        if (this.unsubscribeSeen) {
            this.unsubscribeSeen();
            this.unsubscribeSeen = null;
        }

        if (this.unsubscribeUnseen) {
            this.unsubscribeUnseen();
            this.unsubscribeUnseen = null;
        }

        this.updateCallbacks.clear();
        this.changeCallbacks.clear();
        this.isInitialized = false;
        console.log('[CountersManager] Destroyed');
    }
}

// Create singleton instance
export const countersManager = new CountersManager();

