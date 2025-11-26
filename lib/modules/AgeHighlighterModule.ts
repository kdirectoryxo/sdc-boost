import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';
import { AgeCardProcessor } from './utils/AgeCardProcessor';

/**
 * Module for highlighting member cards based on age
 */
export class AgeHighlighterModule extends BaseModule {
    private cardProcessor: AgeCardProcessor;

    constructor() {
        const configOptions: ModuleConfigOption[] = [
            {
                key: 'minAge',
                label: 'Minimum Age',
                description: 'Highlight cards at or above this age (within range)',
                type: 'number',
                default: 20,
                min: 18,
                max: 100,
                step: 1,
            },
            {
                key: 'maxAge',
                label: 'Maximum Age',
                description: 'Highlight cards at or below this age (within range)',
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

        // Initialize card processor with callback for processing cards
        this.cardProcessor = new AgeCardProcessor('AgeHighlighter', () => this.processAllCards());
    }

    async init(): Promise<void> {
        console.log('[AgeHighlighter] Initializing module...');
        this.processAllCards();
        this.cardProcessor.setupCardMutationObserver();
        this.cardProcessor.setupCardNavigationWatcher();
        console.log('[AgeHighlighter] Module initialized');
    }

    async cleanup(): Promise<void> {
        this.cleanupObserver();
        this.removeAllStyling();
        this.cardProcessor.cleanup();
    }

    /**
     * Apply highlighting based on ages using configuration
     */
    private applyAgeHighlighting(card: HTMLElement): void {
        const ages = this.cardProcessor.extractAges(card);

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

        // Highlight if within the age range (between min and max)
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
        const cards = this.cardProcessor.getAllCards();
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
        const cards = this.cardProcessor.getAllCards();
        console.log(`[AgeHighlighter] Processing ${cards.length} cards`);
        cards.forEach((card) => {
            if (card instanceof HTMLElement) {
                this.applyAgeHighlighting(card);
            }
        });
        console.log('[AgeHighlighter] Finished processing all cards');
    }
}
