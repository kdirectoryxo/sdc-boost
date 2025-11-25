import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';

/**
 * Module for blocking/hiding ads on the SDC website
 */
export class AdBlockModule extends BaseModule {
    private hiddenElements: Set<HTMLElement> = new Set();

    constructor() {
        const configOptions: ModuleConfigOption[] = [
            {
                key: 'blockMemberCardAds',
                label: 'Block Member Card Ads',
                description: 'Remove advertisement blocks from member card listings',
                type: 'boolean',
                default: true,
            },
        ];

        super(
            'ad-block',
            'Ad Blocker',
            'Block and hide advertisements on the SDC website.',
            'Content',
            configOptions
        );
    }

    async init(): Promise<void> {
        this.blockAds();
        this.setupMutationObserver();
        console.log('SDC Boost: Ad Block module initialized');
    }

    async cleanup(): Promise<void> {
        this.cleanupObserver();
        this.restoreAds();
        this.hiddenElements.clear();
        console.log('SDC Boost: Ad Block module cleaned up');
    }

    /**
     * Block all ads on the page
     */
    private blockAds(): void {
        const blockMemberCardAds = this.getConfigValue('blockMemberCardAds') ?? true;

        if (!blockMemberCardAds) {
            // If disabled, restore any previously hidden ads
            this.restoreAds();
            return;
        }

        // Find all ad elements - check for iframes first
        const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
        iframes.forEach(iframe => {
            if (iframe.src.includes('banner.sdc.com')) {
                // Find the container (MuiGrid-item) that contains this iframe
                const container = iframe.closest('.MuiGrid-item');
                if (container) {
                    // Hide the entire container div
                    this.hideAd(container as HTMLElement);
                } else {
                    // If no container, just hide the iframe
                    this.hideAd(iframe);
                }
            }
        });

        // Find banner-card elements
        const bannerCards = document.querySelectorAll<HTMLElement>('.banner-card');
        bannerCards.forEach(card => {
            // Find the parent MuiGrid-item container
            const container = card.closest('.MuiGrid-item');
            if (container) {
                // Hide the entire container
                this.hideAd(container as HTMLElement);
            } else {
                // If no container, just hide the card
                this.hideAd(card);
            }
        });

        // Check MuiGrid-item elements that might contain ads
        const gridItems = document.querySelectorAll<HTMLElement>('.MuiGrid-item');
        gridItems.forEach(item => {
            // Check if this item contains a banner-card or banner iframe
            const hasBannerCard = item.querySelector('.banner-card');
            const hasBannerIframe = item.querySelector('iframe[src*="banner.sdc.com"]');
            
            if (hasBannerCard || hasBannerIframe) {
                this.hideAd(item);
            }
        });
    }

    /**
     * Check if an element is an ad
     */
    private isAdElement(element: HTMLElement): boolean {
        // Check for banner-card class
        if (element.classList.contains('banner-card')) {
            return true;
        }

        // Check for banner.sdc.com iframe
        const iframe = element.querySelector('iframe[src*="banner.sdc.com"]');
        if (iframe) {
            return true;
        }

        // Check if element contains banner.sdc.com in any iframe src
        const iframes = element.querySelectorAll('iframe');
        for (const ifr of iframes) {
            if (ifr.src.includes('banner.sdc.com')) {
                return true;
            }
        }

        // Check parent for banner-card
        const parent = element.closest('.banner-card');
        if (parent) {
            return true;
        }

        return false;
    }

    /**
     * Hide an ad element with CSS
     */
    private hideAd(element: HTMLElement): void {
        if (this.hiddenElements.has(element)) {
            return; // Already hidden
        }

        // Hide with CSS so it can be restored
        const originalDisplay = element.style.display;
        element.style.display = 'none';
        element.dataset.sdcBoostOriginalDisplay = originalDisplay || '';
        element.dataset.sdcBoostAdBlocked = 'true';
        this.hiddenElements.add(element);
    }

    /**
     * Restore hidden ads (for when module is disabled or setting is toggled off)
     */
    private restoreAds(): void {
        this.hiddenElements.forEach(element => {
            // Restore display if element still exists in DOM
            if (element.dataset.sdcBoostAdBlocked === 'true') {
                element.style.display = element.dataset.sdcBoostOriginalDisplay || '';
                delete element.dataset.sdcBoostOriginalDisplay;
                delete element.dataset.sdcBoostAdBlocked;
            }
        });
    }

    /**
     * Setup MutationObserver to watch for new ads
     */
    private setupMutationObserver(): void {
        this.setupObserver(
            document.body,
            (mutations) => {
                const blockMemberCardAds = this.getConfigValue('blockMemberCardAds') ?? true;

                if (!blockMemberCardAds) {
                    return;
                }

                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node as HTMLElement;
                            
                            // Check if the added node is an ad container
                            if (element.classList.contains('MuiGrid-item')) {
                                const hasBannerCard = element.querySelector('.banner-card');
                                const hasBannerIframe = element.querySelector('iframe[src*="banner.sdc.com"]');
                                if (hasBannerCard || hasBannerIframe) {
                                    this.hideAd(element);
                                }
                            }

                            // Check for banner iframes
                            const iframes = element.querySelectorAll<HTMLIFrameElement>('iframe[src*="banner.sdc.com"]');
                            iframes.forEach(iframe => {
                                const container = iframe.closest('.MuiGrid-item');
                                if (container) {
                                    this.hideAd(container as HTMLElement);
                                } else {
                                    this.hideAd(iframe);
                                }
                            });

                            // Check for banner-card elements
                            const bannerCards = element.querySelectorAll<HTMLElement>('.banner-card');
                            bannerCards.forEach(card => {
                                const container = card.closest('.MuiGrid-item');
                                if (container) {
                                    this.hideAd(container as HTMLElement);
                                } else {
                                    this.hideAd(card);
                                }
                            });
                        }
                    });
                });
            },
            {
                childList: true,
                subtree: true,
            }
        );
    }
}

