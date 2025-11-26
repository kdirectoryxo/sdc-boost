/**
 * Shared utility for age-based card processing modules
 * Handles common logic for navigation detection, card discovery, and age extraction
 */
export class AgeCardProcessor {
    private urlPollInterval: number | null = null;
    private lastKnownUrl: string = window.location.href;
    private loadingObserver: MutationObserver | null = null;
    private gridObserver: MutationObserver | null = null;
    private scrollMutationObserver: MutationObserver | null = null;
    private modulePrefix: string;
    private processCardsCallback: () => void;
    private isProcessing: boolean = false;
    private navigationDebounceTimer: number | null = null;
    private lastProcessedCardCount: number = 0;
    private navigationInProgress: boolean = false;
    private urlChanged: boolean = false;

    constructor(modulePrefix: string, processCardsCallback: () => void) {
        this.modulePrefix = modulePrefix;
        this.processCardsCallback = processCardsCallback;
    }

    /**
     * Extract ages from a member card
     */
    extractAges(card: Element): number[] {
        const ages: number[] = [];

        // Ages are displayed in spans with specific colors:
        // - Pink/magenta: rgb(255, 96, 223) for first age
        // - Blue: rgb(58, 151, 254) for second age
        // Format: "23 | 26" where 23 and 26 are the ages

        // Look for the age container div that has both age spans
        const ageSpans = card.querySelectorAll('span[style*="color"]');

        ageSpans.forEach(span => {
            const style = span.getAttribute('style') || '';
            const text = span.textContent?.trim() || '';

            // Check if this span has the age colors and contains a number
            if ((style.includes('rgb(255, 96, 223)') || style.includes('rgb(58, 151, 254)')) &&
                /^\d{1,3}$/.test(text)) {
                const age = parseInt(text, 10);
                // Reasonable age range check
                if (age >= 18 && age <= 120) {
                    ages.push(age);
                }
            }
        });

        // Fallback: if we didn't find ages by color, try to find the pattern "XX | YY"
        if (ages.length === 0) {
            const textContent = card.textContent || '';
            const agePattern = /\b(\d{2})\s*\|\s*(\d{2})\b/;
            const match = textContent.match(agePattern);
            if (match) {
                const age1 = parseInt(match[1], 10);
                const age2 = parseInt(match[2], 10);
                if (age1 >= 18 && age1 <= 120) ages.push(age1);
                if (age2 >= 18 && age2 <= 120) ages.push(age2);
            }
        }

        return ages;
    }

    /**
     * Setup MutationObserver for infinite scroll
     */
    setupCardMutationObserver(onMutations?: (shouldProcess: boolean) => void): void {
        const handleMutations = (mutations: MutationRecord[]) => {
            // Skip if we're currently processing (to avoid infinite loops)
            if (this.isProcessing) {
                return;
            }

            let shouldProcess = false;

            mutations.forEach((mutation) => {
                // Only process if actual nodes were added (not just attribute changes)
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if any added nodes are member cards or contain member cards
                    mutation.addedNodes.forEach((node) => {
                        if (node instanceof Element && node.nodeType === Node.ELEMENT_NODE) {
                            // Only trigger if it's a real DOM addition, not a display change
                            if (node.classList?.contains('member-card-container') ||
                                node.querySelector?.('.member-card-container.member-card')) {
                                shouldProcess = true;
                            }
                        }
                    });
                }
            });

            if (shouldProcess) {
                // Small delay to ensure DOM is fully updated
                setTimeout(() => {
                    if (onMutations) {
                        onMutations(true);
                    } else {
                        this.safeProcessCards();
                    }
                }, 100);
            }
        };

        // Clean up existing observer
        if (this.scrollMutationObserver) {
            this.scrollMutationObserver.disconnect();
            this.scrollMutationObserver = null;
        }

        // Start observing the infinite scroll container
        const scrollContainer = document.querySelector('.infinite-scroll-component');
        if (scrollContainer) {
            this.scrollMutationObserver = new MutationObserver(handleMutations);
            this.scrollMutationObserver.observe(scrollContainer, {
                childList: true,
                subtree: true
            });
        } else {
            // Fallback: observe the entire document body
            this.scrollMutationObserver = new MutationObserver(handleMutations);
            this.scrollMutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    /**
     * Setup navigation watcher using URL polling and loading state detection
     */
    setupCardNavigationWatcher(): void {
        console.log(`[${this.modulePrefix}] Setting up navigation watcher`);

        // Watch for URL changes via polling
        this.setupURLPolling();

        // Watch for loading state changes
        this.watchLoadingState();
    }

    /**
     * Poll for URL changes as a fallback
     */
    private setupURLPolling(): void {
        if (this.urlPollInterval !== null) {
            clearInterval(this.urlPollInterval);
        }

        this.urlPollInterval = window.setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== this.lastKnownUrl) {
                console.log(`[${this.modulePrefix}] URL change detected via polling:`, {
                    old: this.lastKnownUrl,
                    new: currentUrl
                });
                this.lastKnownUrl = currentUrl;
                this.navigationInProgress = true;
                this.urlChanged = true; // Mark that URL actually changed
                this.handleNavigation();
            }
        }, 500); // Check every 500ms
    }

    /**
     * Watch for loading state disappearing (indicates navigation complete)
     */
    private watchLoadingState(): void {
        const scrollContainer = document.querySelector('.infinite-scroll-component');
        if (!scrollContainer) {
            console.log(`[${this.modulePrefix}] Scroll container not found for loading state watcher`);
            return;
        }

        // Clean up existing observers
        if (this.loadingObserver) {
            this.loadingObserver.disconnect();
            this.loadingObserver = null;
        }
        if (this.gridObserver) {
            this.gridObserver.disconnect();
            this.gridObserver = null;
        }

        // Watch for when loading spinner appears/disappears
        this.loadingObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof Element && node.classList?.contains('circularProgress')) {
                        console.log(`[${this.modulePrefix}] Loading state appeared`);
                        this.navigationInProgress = true;
                    }
                });
                mutation.removedNodes.forEach((node) => {
                    if (node instanceof Element && node.classList?.contains('circularProgress')) {
                        console.log(`[${this.modulePrefix}] Loading state disappeared - navigation complete`);
                        // Wait a bit for cards to load, then process (debounced)
                        this.debouncedHandleNavigation(300);
                        // Reset flag after a delay
                        setTimeout(() => {
                            this.navigationInProgress = false;
                        }, 1000);
                    }
                });
            });
        });

        this.loadingObserver.observe(scrollContainer, {
            childList: true,
            subtree: true
        });

        // Also watch for when the grid container gets cleared and refilled
        this.gridObserver = new MutationObserver((mutations) => {
            // Skip if we're currently processing (to avoid infinite loops)
            if (this.isProcessing) {
                return;
            }

            mutations.forEach((mutation) => {
                // Check if cards were removed (navigation starting)
                if (mutation.removedNodes.length > 0) {
                    const hadCards = Array.from(mutation.removedNodes).some(node =>
                        node instanceof Element &&
                        !(node instanceof HTMLElement && node.style.display === 'none') &&
                        node.querySelector?.('.member-card-container.member-card')
                    );
                    if (hadCards) {
                        console.log(`[${this.modulePrefix}] Cards removed - navigation starting`);
                        // Only mark navigation in progress if URL changed or we see significant removal
                        const removedCount = Array.from(mutation.removedNodes).filter(node =>
                            node instanceof Element &&
                            node.querySelector?.('.member-card-container.member-card')
                        ).length;
                        // If many cards removed at once, it's likely navigation
                        if (removedCount > 5) {
                            this.navigationInProgress = true;
                        }
                    }
                }
                // Check if cards were added (navigation complete)
                // ONLY trigger if we know navigation was in progress (not just infinite scroll)
                if (mutation.addedNodes.length > 0 && this.navigationInProgress) {
                    const hasCards = Array.from(mutation.addedNodes).some(node =>
                        node instanceof Element &&
                        node.nodeType === Node.ELEMENT_NODE &&
                        (node.classList?.contains('member-card-container') ||
                            node.querySelector?.('.member-card-container.member-card'))
                    );
                    if (hasCards) {
                        console.log(`[${this.modulePrefix}] Cards added - navigation complete, processing...`);
                        // Debounce to prevent rapid-fire triggers
                        this.debouncedHandleNavigation(300);
                    }
                }
            });
        });

        this.gridObserver.observe(scrollContainer, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Safely process cards with processing flag to prevent re-triggering
     */
    private safeProcessCards(): void {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        try {
            this.processCardsCallback();
            this.lastProcessedCardCount = document.querySelectorAll('.member-card-container.member-card').length;
        } finally {
            // Use a small delay before clearing the flag to prevent rapid re-triggers
            setTimeout(() => {
                this.isProcessing = false;
            }, 200);
        }
    }

    /**
     * Debounced version of handleNavigation to prevent rapid-fire calls
     */
    private debouncedHandleNavigation(delay: number = 300): void {
        if (this.navigationDebounceTimer !== null) {
            clearTimeout(this.navigationDebounceTimer);
        }
        this.navigationDebounceTimer = window.setTimeout(() => {
            this.navigationDebounceTimer = null;
            this.handleNavigation();
        }, delay);
    }

    /**
     * Handle navigation - wait for cards to appear and process them
     */
    private handleNavigation(): void {
        // Prevent re-entry if already processing
        if (this.isProcessing) {
            console.log(`[${this.modulePrefix}] Already processing, skipping navigation handler`);
            return;
        }

        const currentCardCount = document.querySelectorAll('.member-card-container.member-card').length;
        const wasUrlChange = this.urlChanged;

        // Reset URL change flag
        this.urlChanged = false;

        // If card count hasn't changed significantly AND URL didn't change, 
        // this might be a false trigger (e.g., from filtering operations)
        // BUT if URL changed, always process (cards might not have loaded yet)
        if (!wasUrlChange && Math.abs(currentCardCount - this.lastProcessedCardCount) < 5 && currentCardCount > 0) {
            console.log(`[${this.modulePrefix}] Card count similar (${currentCardCount} vs ${this.lastProcessedCardCount}), likely filtering, skipping`);
            return;
        }

        console.log(`[${this.modulePrefix}] Navigation detected:`, {
            href: window.location.href,
            hash: window.location.hash,
            pathname: window.location.pathname,
            urlChanged: wasUrlChange
        });

        // Wait for cards to appear in the DOM after navigation
        // Check multiple times with increasing delays
        let attempts = 0;
        const maxAttempts = 20; // Try for up to 4 seconds (20 * 200ms)

        const checkForCards = () => {
            attempts++;
            const cards = document.querySelectorAll('.member-card-container.member-card');
            console.log(`[${this.modulePrefix}] Attempt ${attempts}/${maxAttempts}: Found ${cards.length} cards`);

            if (cards.length > 0) {
                console.log(`[${this.modulePrefix}] Cards found! Processing...`);
                // Cards found, process them immediately and re-setup observer
                this.safeProcessCards();
                this.lastProcessedCardCount = cards.length;
                // Re-setup observer in case the container changed
                this.setupCardMutationObserver();
                console.log(`[${this.modulePrefix}] Processing complete and observer re-setup`);
            } else if (attempts < maxAttempts) {
                // No cards yet, keep checking
                setTimeout(checkForCards, 200);
            } else {
                // Max attempts reached, cards might not be on this page
                console.log(`[${this.modulePrefix}] Max attempts reached. No cards found. Setting up observer anyway.`);
                // Still set up observer in case they load later
                this.setupCardMutationObserver();
            }
        };

        // Start checking after a brief initial delay
        console.log(`[${this.modulePrefix}] Starting card check in 100ms...`);
        setTimeout(checkForCards, 100);
    }

    /**
     * Get all member cards from the DOM
     */
    getAllCards(): NodeListOf<Element> {
        return document.querySelectorAll('.member-card-container.member-card');
    }

    /**
     * Cleanup all observers and intervals
     */
    cleanup(): void {
        console.log(`[${this.modulePrefix}] Cleaning up AgeCardProcessor`);

        if (this.urlPollInterval !== null) {
            clearInterval(this.urlPollInterval);
            this.urlPollInterval = null;
        }

        if (this.navigationDebounceTimer !== null) {
            clearTimeout(this.navigationDebounceTimer);
            this.navigationDebounceTimer = null;
        }

        if (this.loadingObserver) {
            this.loadingObserver.disconnect();
            this.loadingObserver = null;
        }

        if (this.gridObserver) {
            this.gridObserver.disconnect();
            this.gridObserver = null;
        }

        if (this.scrollMutationObserver) {
            this.scrollMutationObserver.disconnect();
            this.scrollMutationObserver = null;
        }

        this.isProcessing = false;
        this.lastProcessedCardCount = 0;
        this.navigationInProgress = false;
    }
}

