import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';

/**
 * Module for highlighting member cards based on age
 */
export class AgeHighlighterModule extends BaseModule {
    constructor() {
        const configOptions: ModuleConfigOption[] = [
            {
                key: 'minAge',
                label: 'Minimum Age',
                description: 'Highlight cards at or above this age',
                type: 'number',
                default: 20,
                min: 18,
                max: 100,
                step: 1,
            },
            {
                key: 'maxAge',
                label: 'Maximum Age',
                description: 'Highlight cards at or below this age',
                type: 'number',
                default: 30,
                min: 18,
                max: 100,
                step: 1,
            },
            {
                key: 'highlightColor',
                label: 'Highlight Color',
                description: 'Color used to highlight cards',
                type: 'color',
                default: '#22c55e',
            },
        ];

        super(
            'age-highlighter',
            'Age Highlighter',
            'Highlight member cards based on age range. Configure minimum/maximum age and highlight color.',
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
        window.removeEventListener('popstate', this.handleHashChange);
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
     * Apply highlighting based on ages using configuration
     */
    private applyAgeHighlighting(card: HTMLElement): void {
        const ages = this.extractAges(card);

        if (ages.length === 0) return;

        // Get the minimum age (youngest person in the couple)
        const minAge = Math.min(...ages);
        const maxAge = Math.max(...ages);

        // Get configuration values
        const configMinAge = this.getConfigValue('minAge') ?? 20;
        const configMaxAge = this.getConfigValue('maxAge') ?? 30;
        const highlightColor = this.getConfigValue('highlightColor') ?? '#22c55e';

        // Convert hex color to RGB for rgba
        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 34, g: 197, b: 94 };
        };

        const rgb = hexToRgb(highlightColor);

        // Reset any previous styling
        card.style.opacity = '';
        card.style.outline = '';
        card.style.outlineOffset = '';
        card.style.borderRadius = '';
        card.style.boxShadow = '';
        card.style.backgroundColor = '';

        // INVERTED LOGIC: Highlight if within the age range (between min and max)
        // Both ages should be within the configured range
        if (minAge >= configMinAge && maxAge <= configMaxAge) {
            card.style.opacity = '1';
            card.style.outline = `5px solid ${highlightColor}`;
            card.style.outlineOffset = '3px';
            card.style.borderRadius = '6px';
            card.style.boxShadow = `0 0 0 2px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3), 0 4px 12px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;
            card.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;
        }
    }

    /**
     * Remove all styling from cards
     */
    private removeAllStyling(): void {
        const cards = document.querySelectorAll('.member-card-container.member-card');
        cards.forEach((card) => {
            if (card instanceof HTMLElement) {
                card.style.opacity = '';
                card.style.outline = '';
                card.style.outlineOffset = '';
                card.style.borderRadius = '';
                card.style.boxShadow = '';
                card.style.backgroundColor = '';
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
                this.applyAgeHighlighting(card);
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
        // Also listen for popstate (browser back/forward)
        window.addEventListener('popstate', this.handleHashChange);
    }

    private handleHashChange = (): void => {
        // Wait for cards to appear in the DOM after navigation
        // Check multiple times with increasing delays
        let attempts = 0;
        const maxAttempts = 20; // Try for up to 4 seconds (20 * 200ms)

        const checkForCards = () => {
            attempts++;
            const cards = document.querySelectorAll('.member-card-container.member-card');

            if (cards.length > 0) {
                // Cards found, process them immediately and set up observer
                this.processAllCards();
                // Re-setup observer in case the container changed
                this.setupMutationObserver();
            } else if (attempts < maxAttempts) {
                // No cards yet, keep checking
                setTimeout(checkForCards, 200);
            } else {
                // Max attempts reached, cards might not be on this page
                // Still set up observer in case they load later
                this.setupMutationObserver();
            }
        };

        // Start checking after a brief initial delay
        setTimeout(checkForCards, 100);
    };
}
