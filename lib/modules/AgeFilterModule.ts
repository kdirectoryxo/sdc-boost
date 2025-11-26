import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';
import { AgeCardProcessor } from './utils/AgeCardProcessor';

/**
 * Module for filtering (hiding) member cards based on age
 */
export class AgeFilterModule extends BaseModule {
    private cardProcessor: AgeCardProcessor;
    private styleElement: HTMLStyleElement | null = null;

    constructor() {
        const configOptions: ModuleConfigOption[] = [
            {
                key: 'minAge',
                label: 'Minimum Age',
                description: 'Show cards at or above this age (hide cards below)',
                type: 'number',
                default: 20,
                min: 18,
                max: 100,
                step: 1,
            },
            {
                key: 'maxAge',
                label: 'Maximum Age',
                description: 'Show cards at or below this age (hide cards above)',
                type: 'number',
                default: 40,
                min: 18,
                max: 100,
                step: 1,
            },
        ];

        super(
            'age-filter',
            'Age Filter',
            'Hide member cards based on age range. Configure minimum and maximum age.',
            'Filtering',
            configOptions
        );

        // Initialize card processor with callback for processing cards
        this.cardProcessor = new AgeCardProcessor('AgeFilter', () => this.processAllCards());
    }

    async init(): Promise<void> {
        console.log('[AgeFilter] Initializing module...');
        this.injectScrollabilityFix();
        this.processAllCards();
        this.cardProcessor.setupCardMutationObserver();
        this.cardProcessor.setupCardNavigationWatcher();
        console.log('[AgeFilter] Module initialized');
    }

    async cleanup(): Promise<void> {
        this.cleanupObserver();
        this.removeAllStyling();
        this.removeScrollabilityFix();
        this.cardProcessor.cleanup();
    }

    /**
     * Inject CSS to ensure infinite scroll container remains scrollable
     * even when cards are filtered/hidden
     */
    private injectScrollabilityFix(): void {
        if (this.styleElement) {
            return; // Already injected
        }

        this.styleElement = document.createElement('style');
        this.styleElement.id = 'sdc-boost-age-filter-scroll-fix';
        this.styleElement.textContent = `
            /* Ensure infinite scroll container remains scrollable when cards are filtered */
            .infinite-scroll-component__outerdiv {
                min-height: 100vh !important;
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    /**
     * Remove the scrollability fix CSS
     */
    private removeScrollabilityFix(): void {
        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        }
    }

    /**
     * Apply filtering based on ages using configuration
     */
    private applyAgeFiltering(card: HTMLElement): void {
        const ages = this.cardProcessor.extractAges(card);

        if (ages.length === 0) return;

        // Get the minimum age (youngest person in the couple)
        const minAge = Math.min(...ages);
        const maxAge = Math.max(...ages);

        // Get configuration values
        const configMinAge = this.getConfigValue('minAge') ?? 18;
        const configMaxAge = this.getConfigValue('maxAge') ?? 100;

        // Find the parent card-width element to hide/show
        const cardWidthParent = card.closest('.card-width') as HTMLElement;

        // Reset any previous styling
        if (cardWidthParent) {
            cardWidthParent.style.display = '';
        } else {
            card.style.display = '';
        }

        // Hide if outside the age range (below min age OR above max age)
        if (minAge < configMinAge || maxAge > configMaxAge) {
            if (cardWidthParent) {
                cardWidthParent.style.display = 'none';
            } else {
                card.style.display = 'none';
            }
        }
    }

    /**
     * Remove all styling from cards
     */
    private removeAllStyling(): void {
        const cards = this.cardProcessor.getAllCards();
        cards.forEach((card) => {
            if (card instanceof HTMLElement) {
                const cardWidthParent = card.closest('.card-width') as HTMLElement;
                card.style.display = '';
                if (cardWidthParent) {
                    cardWidthParent.style.display = '';
                }
            }
        });
    }

    /**
     * Process all existing cards
     */
    private processAllCards(): void {
        const cards = this.cardProcessor.getAllCards();
        console.log(`[AgeFilter] Processing ${cards.length} cards`);
        cards.forEach((card) => {
            if (card instanceof HTMLElement) {
                this.applyAgeFiltering(card);
            }
        });
        console.log('[AgeFilter] Finished processing all cards');

        // After filtering, check if we need to load more content
        this.checkAndTriggerInfiniteScroll();
    }

    /**
     * Check if there are enough visible cards after filtering,
     * and trigger infinite scroll if needed
     */
    private checkAndTriggerInfiniteScroll(): void {
        // Wait a bit for DOM to update after filtering
        setTimeout(() => {
            // Find the scrollable container (could be .infinite-scroll-component or its parent)
            const scrollContainer = document.querySelector('.infinite-scroll-component') as HTMLElement;
            const outerDiv = document.querySelector('.infinite-scroll-component__outerdiv') as HTMLElement;

            // Use the actual scrollable element (usually the inner one)
            const actualScrollContainer = scrollContainer || outerDiv;
            if (!actualScrollContainer) {
                return;
            }

            // Count visible cards (not hidden)
            const allCards = document.querySelectorAll('.card-width');
            const visibleCards = Array.from(allCards).filter(card => {
                const style = window.getComputedStyle(card);
                return style.display !== 'none';
            });

            // Check if container is scrollable and if we're near the bottom
            const scrollHeight = actualScrollContainer.scrollHeight;
            const clientHeight = actualScrollContainer.clientHeight;
            const scrollTop = actualScrollContainer.scrollTop;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const isScrollable = scrollHeight > clientHeight;
            const isNearBottom = distanceFromBottom < 200; // Within 200px of bottom

            console.log(`[AgeFilter] Scroll check:`, {
                visibleCards: visibleCards.length,
                totalCards: allCards.length,
                scrollHeight,
                clientHeight,
                scrollTop,
                distanceFromBottom,
                isScrollable,
                isNearBottom
            });

            // If we have few visible cards OR we're near the bottom, trigger loading
            // by scrolling to bottom (which will trigger infinite scroll)
            if (visibleCards.length < 15 || (isScrollable && isNearBottom)) {
                console.log(`[AgeFilter] Triggering infinite scroll - visible cards: ${visibleCards.length}`);

                // Scroll to bottom to trigger infinite scroll
                actualScrollContainer.scrollTop = actualScrollContainer.scrollHeight;

                // Wait a bit and dispatch scroll events to ensure infinite scroll detects it
                setTimeout(() => {
                    actualScrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
                    // Also try triggering on window in case the library listens there
                    window.dispatchEvent(new Event('scroll', { bubbles: true }));
                }, 50);
            }
        }, 150);
    }
}
