import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';
import { AgeCardProcessor } from './utils/AgeCardProcessor';

/**
 * Module for filtering (hiding) member cards based on age
 */
export class AgeFilterModule extends BaseModule {
    private cardProcessor: AgeCardProcessor;

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
        this.processAllCards();
        this.cardProcessor.setupCardMutationObserver();
        this.cardProcessor.setupCardNavigationWatcher();
        console.log('[AgeFilter] Module initialized');
    }

    async cleanup(): Promise<void> {
        this.cleanupObserver();
        this.removeAllStyling();
        this.cardProcessor.cleanup();
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
    }
}
