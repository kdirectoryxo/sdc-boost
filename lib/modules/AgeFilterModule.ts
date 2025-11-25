import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';

/**
 * Module for filtering (hiding) member cards based on age
 */
export class AgeFilterModule extends BaseModule {
    constructor() {
        const configOptions: ModuleConfigOption[] = [
            {
                key: 'minAge',
                label: 'Minimum Age',
                description: 'Hide cards below this age',
                type: 'number',
                default: 20,
                min: 18,
                max: 100,
                step: 1,
            },
            {
                key: 'maxAge',
                label: 'Maximum Age',
                description: 'Hide cards above this age',
                type: 'number',
                default: 100,
                min: 18,
                max: 40,
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
    }

    async init(): Promise<void> {
        this.processAllCards();
        this.setupMutationObserver();
        this.setupHashChangeListener();
    }

    async cleanup(): Promise<void> {
        this.cleanupObserver();
        this.removeAllStyling();
        window.removeEventListener('hashchange', this.handleHashChange);
    }

    /**
     * Extract ages from a member card
     */
    private extractAges(card: Element): number[] {
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
     * Apply filtering based on ages using configuration
     */
    private applyAgeFiltering(card: HTMLElement): void {
        const ages = this.extractAges(card);

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

        // Hide if below min age or above max age
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
        const cards = document.querySelectorAll('.member-card-container.member-card');
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
        const cards = document.querySelectorAll('.member-card-container.member-card');
        cards.forEach((card) => {
            if (card instanceof HTMLElement) {
                this.applyAgeFiltering(card);
            }
        });
    }

    /**
     * Setup MutationObserver for infinite scroll
     */
    private setupMutationObserver(): void {
        const handleMutations = (mutations: MutationRecord[]) => {
            let shouldProcess = false;

            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    // Check if any added nodes are member cards or contain member cards
                    mutation.addedNodes.forEach((node) => {
                        if (node instanceof Element) {
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
                setTimeout(() => this.processAllCards(), 100);
            }
        };

        // Start observing the infinite scroll container
        const scrollContainer = document.querySelector('.infinite-scroll-component');
        if (scrollContainer) {
            this.setupObserver(scrollContainer, handleMutations);
        } else {
            // Fallback: observe the entire document body
            this.setupObserver(document.body, handleMutations);
        }
    }

    /**
     * Setup hash change listener for React navigation
     */
    private setupHashChangeListener(): void {
        window.addEventListener('hashchange', this.handleHashChange);
    }

    private handleHashChange = (): void => {
        setTimeout(() => this.processAllCards(), 500);
    };
}
