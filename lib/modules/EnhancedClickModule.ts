import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';

/**
 * Module for enhancing click functionality on member cards
 * Makes images and names clickable with right-click support
 */
export class EnhancedClickModule extends BaseModule {
    private processedCards: Set<HTMLElement> = new Set();
    private processedChatElements: Set<HTMLElement> = new Set();
    private eventHandlers: Map<HTMLElement, { click: (e: Event) => void; contextmenu: (e: Event) => void }> = new Map();

    constructor() {
        const configOptions: ModuleConfigOption[] = [
            {
                key: 'enableCardImage',
                label: 'Enable Card Image Click',
                description: 'Make card images clickable to open profile',
                type: 'boolean',
                default: true,
            },
            {
                key: 'enableCardName',
                label: 'Enable Card Name Click',
                description: 'Make card names clickable to open profile',
                type: 'boolean',
                default: true,
            },
            {
                key: 'enableChatHeaderImage',
                label: 'Enable Chat Header Image Click',
                description: 'Make chat header images clickable to open profile',
                type: 'boolean',
                default: true,
            },
            {
                key: 'enableChatHeaderName',
                label: 'Enable Chat Header Name Click',
                description: 'Make chat header names clickable to open profile',
                type: 'boolean',
                default: true,
            },
            {
                key: 'enableChatItemImage',
                label: 'Enable Chat Item Image Click',
                description: 'Make chat item images clickable to open profile',
                type: 'boolean',
                default: true,
            },
            {
                key: 'enableChatItemName',
                label: 'Enable Chat Item Name Click',
                description: 'Make chat item names clickable to open profile',
                type: 'boolean',
                default: true,
            },
        ];

        super(
            'enhanced-click',
            'Enhanced Click',
            'Enhance click functionality on member cards and chat. Make images and names clickable with right-click support.',
            'UI',
            configOptions
        );
    }

    async init(): Promise<void> {
        console.log('[EnhancedClick] Initializing module...');
        this.processAllCards();
        this.processChatHeader();
        this.processChatItems();
        this.setupUnifiedObserver();
        console.log('[EnhancedClick] Module initialized');
    }

    async cleanup(): Promise<void> {
        this.cleanupObserver();
        this.removeAllEnhancements();
        this.processedCards.clear();
        this.processedChatElements.clear();
    }

    /**
     * Setup unified MutationObserver to watch for cards and chat changes
     */
    private setupUnifiedObserver(): void {
        const callback = (mutations: MutationRecord[]) => {
            let shouldProcessCards = false;
            let shouldProcessHeader = false;
            let shouldProcessItems = false;

            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0 || mutation.attributeName === 'id') {
                    mutation.addedNodes.forEach((node) => {
                        if (node instanceof Element) {
                            // Check if new cards were added
                            if (node.classList?.contains('member-card-container') ||
                                node.querySelector?.('.member-card-container.member-card')) {
                                shouldProcessCards = true;
                            }
                            // Check if chat header changed
                            if (node.id === 'header-container' || node.querySelector?.('#header-container')) {
                                shouldProcessHeader = true;
                            }
                            // Check if new chat items were added
                            if (node.classList?.contains('card-messenger') ||
                                node.querySelector?.('.card-messenger')) {
                                shouldProcessItems = true;
                            }
                        }
                    });
                }
            });

            if (shouldProcessCards) {
                setTimeout(() => {
                    this.processAllCards();
                }, 100);
            }

            if (shouldProcessHeader) {
                setTimeout(() => {
                    this.processChatHeader();
                }, 100);
            }

            if (shouldProcessItems) {
                setTimeout(() => {
                    this.processChatItems();
                }, 100);
            }
        };

        // Observe document body for all changes
        this.setupObserver(document.body, callback, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['id'],
        });
    }

    /**
     * Process all existing cards
     */
    private processAllCards(): void {
        const cards = document.querySelectorAll('.member-card-container.member-card');
        console.log(`[EnhancedClick] Processing ${cards.length} cards`);

        cards.forEach((card) => {
            if (card instanceof HTMLElement && !this.processedCards.has(card)) {
                this.enhanceCard(card);
                this.processedCards.add(card);
            }
        });

        console.log(`[EnhancedClick] Finished processing cards`);
    }

    /**
     * Enhance a single card with click functionality
     */
    private enhanceCard(card: HTMLElement): void {
        // Extract user ID from card
        const userId = this.extractUserId(card);
        if (!userId) {
            return;
        }

        const profileUrl = `https://www.sdc.com/react/#/profile?idUser=${userId}`;

        // Enhance image if enabled
        if (this.getConfigValue('enableCardImage') !== false) {
            this.enhanceImage(card, profileUrl);
        }

        // Enhance name if enabled
        if (this.getConfigValue('enableCardName') !== false) {
            this.enhanceName(card, profileUrl);
        }
    }

    /**
     * Extract user ID from card element
     */
    private extractUserId(card: HTMLElement): string | null {
        // Try to get from card ID attribute (e.g., id="user-7115666")
        const cardId = card.id;
        if (cardId && cardId.startsWith('user-')) {
            return cardId.replace('user-', '');
        }

        // Try to find in parent card-width element
        const cardWidth = card.closest('.card-width');
        if (cardWidth) {
            const parentId = cardWidth.id;
            if (parentId && parentId.startsWith('user-')) {
                return parentId.replace('user-', '');
            }
        }

        return null;
    }

    /**
     * Extract user ID from image src URL
     * Format: https://pictures.sdc.com/photos/7635751/thumbnail/...
     */
    private extractUserIdFromImage(img: HTMLImageElement): string | null {
        if (!img.src) {
            return null;
        }

        const match = img.src.match(/\/photos\/(\d+)\//);
        if (match && match[1]) {
            return match[1];
        }

        return null;
    }

    /**
     * Enhance card image with click functionality
     */
    private enhanceImage(card: HTMLElement, profileUrl: string): void {
        // Find the image container (usually a div with class picture-container or similar)
        // Look for the container that holds the image
        const imageContainer = card.querySelector('[class*="picture"], img[alt="profile-picture"]') as HTMLElement;
        if (!imageContainer) {
            return;
        }

        // Check if already enhanced
        if (imageContainer.hasAttribute('data-enhanced-click')) {
            return;
        }

        // Mark as enhanced
        imageContainer.setAttribute('data-enhanced-click', 'true');

        // Create event handlers
        const clickHandler = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = profileUrl;
        };

        const contextMenuHandler = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(profileUrl, '_blank', 'noopener,noreferrer');
        };

        // Store handlers for cleanup
        this.eventHandlers.set(imageContainer, { click: clickHandler, contextmenu: contextMenuHandler });

        // Add click handler
        imageContainer.style.cursor = 'pointer';
        imageContainer.addEventListener('click', clickHandler);
        imageContainer.addEventListener('contextmenu', contextMenuHandler);

        // Add title for better UX
        imageContainer.title = 'Click to view profile (Right-click to open in new tab)';
    }

    /**
     * Enhance card name with click functionality
     */
    private enhanceName(card: HTMLElement, profileUrl: string): void {
        // Find the name element (usually a p tag with the username)
        // Look for the first p.MuiTypography-body1 that contains text
        const nameElements = card.querySelectorAll('p.MuiTypography-body1');
        let nameElement: HTMLElement | null = null;

        for (const el of Array.from(nameElements)) {
            if (el.textContent?.trim() && !el.querySelector('img')) {
                nameElement = el as HTMLElement;
                break;
            }
        }

        if (!nameElement) {
            return;
        }

        // Check if already enhanced
        if (nameElement.hasAttribute('data-enhanced-click')) {
            return;
        }

        // Mark as enhanced
        nameElement.setAttribute('data-enhanced-click', 'true');

        // Create event handlers
        const clickHandler = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = profileUrl;
        };

        const contextMenuHandler = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(profileUrl, '_blank', 'noopener,noreferrer');
        };

        // Store handlers for cleanup
        this.eventHandlers.set(nameElement, { click: clickHandler, contextmenu: contextMenuHandler });

        // Add click handler
        nameElement.style.cursor = 'pointer';
        nameElement.addEventListener('click', clickHandler);
        nameElement.addEventListener('contextmenu', contextMenuHandler);

        // Add title for better UX
        nameElement.title = 'Click to view profile (Right-click to open in new tab)';
    }

    /**
     * Process chat header elements
     */
    private processChatHeader(): void {
        const headerContainer = document.querySelector('#header-container');
        if (!headerContainer) {
            return;
        }

        // Find header image
        const headerImage = headerContainer.querySelector('img.cursor-pointer.disableSave') as HTMLImageElement;
        if (headerImage && !this.processedChatElements.has(headerImage)) {
            const userId = this.extractUserIdFromImage(headerImage);
            if (userId) {
                const profileUrl = `https://www.sdc.com/react/#/profile?idUser=${userId}`;

                if (this.getConfigValue('enableChatHeaderImage') !== false) {
                    this.enhanceElement(headerImage, profileUrl);
                    this.processedChatElements.add(headerImage);
                }
            }
        }

        // Find header name
        const headerName = headerContainer.querySelector('label.account-name') as HTMLElement;
        if (headerName && !this.processedChatElements.has(headerName)) {
            // Get user ID from header image if available
            const headerImageForId = headerContainer.querySelector('img.cursor-pointer.disableSave') as HTMLImageElement;
            const userId = headerImageForId ? this.extractUserIdFromImage(headerImageForId) : null;

            if (userId) {
                const profileUrl = `https://www.sdc.com/react/#/profile?idUser=${userId}`;

                if (this.getConfigValue('enableChatHeaderName') !== false) {
                    this.enhanceElement(headerName, profileUrl);
                    this.processedChatElements.add(headerName);
                }
            }
        }
    }

    /**
     * Process chat item elements
     */
    private processChatItems(): void {
        const chatItems = document.querySelectorAll('.card-messenger');
        console.log(`[EnhancedClick] Processing ${chatItems.length} chat items`);

        chatItems.forEach((item) => {
            if (!(item instanceof HTMLElement)) {
                return;
            }

            // Find image in chat item
            const itemImage = item.querySelector('img.cursor-pointer.disableSave') as HTMLImageElement;
            if (itemImage && !this.processedChatElements.has(itemImage)) {
                const userId = this.extractUserIdFromImage(itemImage);
                if (userId) {
                    const profileUrl = `https://www.sdc.com/react/#/profile?idUser=${userId}`;

                    if (this.getConfigValue('enableChatItemImage') !== false) {
                        this.enhanceElement(itemImage, profileUrl);
                        this.processedChatElements.add(itemImage);
                    }
                }
            }

            // Find name in chat item
            const itemName = item.querySelector('label.account-name') as HTMLElement;
            if (itemName && !this.processedChatElements.has(itemName)) {
                // Get user ID from image in the same item
                const itemImageForId = item.querySelector('img.cursor-pointer.disableSave') as HTMLImageElement;
                const userId = itemImageForId ? this.extractUserIdFromImage(itemImageForId) : null;

                if (userId) {
                    const profileUrl = `https://www.sdc.com/react/#/profile?idUser=${userId}`;

                    if (this.getConfigValue('enableChatItemName') !== false) {
                        this.enhanceElement(itemName, profileUrl);
                        this.processedChatElements.add(itemName);
                    }
                }
            }
        });

        console.log(`[EnhancedClick] Finished processing chat items`);
    }

    /**
     * Generic method to enhance any element with click functionality
     */
    private enhanceElement(element: HTMLElement, profileUrl: string): void {
        // Check if already enhanced
        if (element.hasAttribute('data-enhanced-click')) {
            return;
        }

        // Mark as enhanced
        element.setAttribute('data-enhanced-click', 'true');

        // Create event handlers
        const clickHandler = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = profileUrl;
        };

        const contextMenuHandler = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(profileUrl, '_blank', 'noopener,noreferrer');
        };

        // Store handlers for cleanup
        this.eventHandlers.set(element, { click: clickHandler, contextmenu: contextMenuHandler });

        // Add click handler
        element.style.cursor = 'pointer';
        element.addEventListener('click', clickHandler);
        element.addEventListener('contextmenu', contextMenuHandler);

        // Add title for better UX (preserve existing title if it exists)
        const existingTitle = element.getAttribute('title');
        if (!existingTitle || !existingTitle.includes('Click to view profile')) {
            element.title = existingTitle
                ? `${existingTitle} (Click to view profile, Right-click for new tab)`
                : 'Click to view profile (Right-click to open in new tab)';
        }
    }

    /**
     * Remove all enhancements from cards
     */
    private removeAllEnhancements(): void {
        // Remove event listeners and restore elements
        this.eventHandlers.forEach((handlers, element) => {
            if (element && element.parentElement) {
                element.removeEventListener('click', handlers.click);
                element.removeEventListener('contextmenu', handlers.contextmenu);
                element.removeAttribute('data-enhanced-click');
                element.style.cursor = '';
                // Restore original title if we modified it
                const title = element.getAttribute('title');
                if (title && title.includes('Click to view profile')) {
                    const originalTitle = title.replace(/\s*\(Click to view profile[^)]*\)/g, '').trim();
                    element.title = originalTitle || '';
                }
            }
        });

        this.eventHandlers.clear();

        // Reset processed cards
        this.processedCards.clear();
        this.processedChatElements.clear();
    }
}

