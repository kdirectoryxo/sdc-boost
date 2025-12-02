/**
 * Counters Manager
 * Global state manager for SDC counters with WebSocket updates
 */

import { getCounters } from './sdc-api/counters';
import type { CountersInfo } from './sdc-api-types';
import { websocketManager } from './websocket-manager';
import { chatStorage } from './chat-storage';

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
     * Calculate messenger counter from stored chats
     * This matches how the original SDC site calculates it (sum of all unread_counter values)
     */
    private async calculateMessengerCounterFromChats(): Promise<number> {
        try {
            const allChats = await chatStorage.getAllChats();
            const totalUnread = allChats.reduce((sum, chat) => {
                return sum + (chat.unread_counter || 0);
            }, 0);
            return totalUnread;
        } catch (error) {
            console.error('[CountersManager] Failed to calculate messenger counter from chats:', error);
            return 0;
        }
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

                // Calculate messenger counter from stored chats
                // The original SDC site calculates it by summing unread_counter from all chats
                // The API counter might exclude certain chats (e.g., in folders or certain types)
                // So we use the maximum of API counter and calculated counter to match the original site
                const calculatedMessengerCount = await this.calculateMessengerCounterFromChats();
                const apiMessengerCount = this.counters.messenger || 0;
                
                // Use the maximum to ensure we show the correct count (matching original site behavior)
                // This handles cases where API returns 4 but actual unread count is 6
                this.counters.messenger = Math.max(apiMessengerCount, calculatedMessengerCount);
                
                if (calculatedMessengerCount !== apiMessengerCount) {
                    console.log(`[CountersManager] Messenger counter mismatch - API: ${apiMessengerCount}, Calculated: ${calculatedMessengerCount}, Using: ${this.counters.messenger}`);
                }

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
        // Listen for new messages - update messenger counter
        this.unsubscribeMessage = websocketManager.on('message', async (data) => {
            // When a new message arrives, recalculate from chats immediately
            // Then refresh API counters after a delay to keep them in sync
            if (this.counters) {
                const calculatedCount = await this.calculateMessengerCounterFromChats();
                const oldValue = this.counters.messenger;
                this.counters.messenger = calculatedCount;
                this.notifyUpdate();
                if (oldValue !== calculatedCount) {
                    this.notifyChange('messenger', oldValue, calculatedCount);
                }
            }
            
            // Also refresh API counters after a delay to ensure they're updated
            setTimeout(() => {
                this.refresh().catch(console.error);
            }, 1000);
        });

        // Listen for seen events - update messenger counter
        this.unsubscribeSeen = websocketManager.on('seen', async (data) => {
            // When messages are seen, recalculate from chats immediately
            if (this.counters) {
                const calculatedCount = await this.calculateMessengerCounterFromChats();
                const oldValue = this.counters.messenger;
                this.counters.messenger = calculatedCount;
                this.notifyUpdate();
                if (oldValue !== calculatedCount) {
                    this.notifyChange('messenger', oldValue, calculatedCount);
                }
            }
            
            // Also refresh API counters after a delay
            setTimeout(() => {
                this.refresh().catch(console.error);
            }, 500);
        });

        // Listen for unseen events - increment messenger counter
        this.unsubscribeUnseen = websocketManager.on('unseen', async (data) => {
            // When a message becomes unseen, recalculate from chats to get accurate count
            // This ensures we match the original site's behavior
            if (this.counters) {
                const oldValue = this.counters.messenger;
                const calculatedCount = await this.calculateMessengerCounterFromChats();
                this.counters.messenger = calculatedCount;
                this.notifyUpdate();
                if (oldValue !== calculatedCount) {
                    this.notifyChange('messenger', oldValue, calculatedCount);
                }
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

