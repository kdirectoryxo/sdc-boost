import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';
import { navigationWatcher } from './utils/NavigationWatcher';
import { countersManager } from '../counters-manager';

/**
 * Module to add a Newsfeed button to the navbar that opens a Vue-based dialog
 * with a custom newsfeed interface
 */
export class NewsfeedModule extends BaseModule {
    private newsfeedButton: HTMLElement | null = null;
    private counterBadge: HTMLElement | null = null;
    private bodyObserver: MutationObserver | null = null;
    private unsubscribeNavigation: (() => void) | null = null;
    private unsubscribeCounters: (() => void) | null = null;
    private hiddenSidebarElements: Set<HTMLElement> = new Set();

    constructor() {
        const configOptions: ModuleConfigOption[] = [];
        super(
            'newsfeed',
            'Newsfeed',
            'Adds a Newsfeed button to the navbar that opens a custom newsfeed dialog',
            'Feed',
            configOptions
        );
    }

    async init(): Promise<void> {
        console.log('[NewsfeedModule] Initializing module...');
        this.injectNewsfeedButton();
        this.setupNavbarObserver();
        this.setupNavigationListener();
        this.hideSidebarFeedItem();
        this.setupSidebarObserver();
        this.setupCounterSubscription();
    }

    async cleanup(): Promise<void> {
        this.removeNewsfeedButton();
        this.cleanupObserver();
        this.cleanupCounterSubscription();
        if (this.bodyObserver) {
            this.bodyObserver.disconnect();
            this.bodyObserver = null;
        }
        if (this.unsubscribeNavigation) {
            this.unsubscribeNavigation();
            this.unsubscribeNavigation = null;
        }
    }

    /**
     * Inject the Newsfeed button into the navbar
     */
    private injectNewsfeedButton(): void {
        // Check if button already exists
        if (document.querySelector('.sdc-boost-newsfeed-button')) {
            return;
        }

        // Find the navbar right buttons container
        const navBarRightButtons = document.querySelector('.nav-bar-right-buttons');
        if (!navBarRightButtons) {
            // Try again after a short delay if navbar isn't ready
            setTimeout(() => this.injectNewsfeedButton(), 500);
            return;
        }

        // Find the last button (boost or chat) to insert after
        const boostButton = navBarRightButtons.querySelector('.sdc-boost-navbar-button');
        const chatButton = navBarRightButtons.querySelector('.sdc-boost-chat-button');
        const insertAfter = chatButton || boostButton || navBarRightButtons.querySelector('.nav-bar-option-icon-button');
        
        if (!insertAfter) {
            setTimeout(() => this.injectNewsfeedButton(), 500);
            return;
        }

        // Create the Newsfeed button container
        const newsfeedButtonContainer = document.createElement('div');
        newsfeedButtonContainer.className = 'nav-bar-option-icon-button sdc-boost-newsfeed-button';
        newsfeedButtonContainer.style.cssText = `
            font-family: Roboto, sans-serif, serif, monospace !important;
            -webkit-text-size-adjust: 100%;
            text-align: center;
            color: rgb(255, 255, 255);
            display: inline-grid !important;
            margin-left: 4px !important;
            box-sizing: border-box;
            flex-direction: row;
        `;

        // Create the button
        const button = document.createElement('button');
        button.className = 'MuiButtonBase-root MuiIconButton-root MuiIconButton-sizeMedium css-1ewrq4d';
        button.setAttribute('tabindex', '0');
        button.setAttribute('type', 'button');
        button.setAttribute('title', 'SDC Feed');
        button.style.cssText = `
            font-family: Roboto, sans-serif, serif, monospace !important;
            -webkit-text-size-adjust: 100%;
            text-align: center;
            color: rgb(255, 255, 255);
            display: inline-grid !important;
            margin-left: 4px !important;
            box-sizing: border-box;
            flex-direction: row;
            position: relative;
        `;
        
        // Create the icon (news feed icon SVG)
        const icon = document.createElement('img');
        icon.setAttribute('role', 'presentation');
        icon.className = 'newsfeed-icon-navbar';
        icon.style.cssText = `
            -webkit-text-size-adjust: 100%;
            -webkit-tap-highlight-color: transparent;
            cursor: pointer;
            user-select: none;
            text-align: center;
            font-size: 1.5rem;
            color: rgba(0, 0, 0, 0.54);
            width: 24px;
            height: 24px;
        `;
        
        // Create SVG as data URL (news feed icon - similar to the sidebar icon)
        const svgContent = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19" cy="7" r="3" fill="white"/></svg>`;
        icon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
        
        // Create counter badge
        const badge = document.createElement('span');
        badge.className = 'sdc-boost-newsfeed-badge';
        badge.style.cssText = `
            position: absolute;
            top: 2px;
            right: 2px;
            background-color: #f44336;
            color: white;
            border-radius: 10px;
            min-width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
            padding: 0 4px;
            z-index: 10;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            line-height: 1;
        `;
        badge.textContent = '0';
        badge.style.display = 'none'; // Hidden by default
        
        // Create ripple span
        const ripple = document.createElement('span');
        ripple.className = 'MuiTouchRipple-root css-w0pj6f';
        
        button.appendChild(icon);
        button.appendChild(badge);
        button.appendChild(ripple);
        
        this.counterBadge = badge;

        // Create label
        const label = document.createElement('label');
        label.className = 'nav-bar-label-newsfeed';
        label.textContent = 'SDC Feed';
        label.style.cssText = `
            font-family: Roboto, sans-serif, serif, monospace !important;
            -webkit-text-size-adjust: 100%;
            text-align: center;
            font-size: 12px;
            color: #fff;
            margin-top: -8px;
        `;

        newsfeedButtonContainer.appendChild(button);
        newsfeedButtonContainer.appendChild(label);

        // Insert after the last button found
        insertAfter.parentNode?.insertBefore(newsfeedButtonContainer, insertAfter.nextSibling);

        // Add click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openDialog();
        });

        this.newsfeedButton = newsfeedButtonContainer;
        console.log('[NewsfeedModule] Newsfeed button injected successfully');
    }

    /**
     * Remove the Newsfeed button
     */
    private removeNewsfeedButton(): void {
        if (this.newsfeedButton) {
            this.newsfeedButton.remove();
            this.newsfeedButton = null;
        }
    }

    /**
     * Open the newsfeed dialog
     */
    private openDialog(): void {
        console.log('[NewsfeedModule] Opening newsfeed dialog');
        
        // Access the Vue app instance to open dialog (set up by content script)
        const newsfeedDialog = (window as any).__sdcBoostNewsfeedDialog;
        if (newsfeedDialog) {
            newsfeedDialog.open();
        } else {
            console.warn('[NewsfeedModule] Newsfeed dialog UI not initialized yet');
        }
    }

    /**
     * Setup MutationObserver to watch for navbar changes
     */
    private setupNavbarObserver(): void {
        const handleMutations = (mutations: MutationRecord[]) => {
            // Check if our button was removed
            if (!document.querySelector('.sdc-boost-newsfeed-button')) {
                // Re-inject if it was removed
                this.injectNewsfeedButton();
                // Re-subscribe to counters after re-injection
                this.setupCounterSubscription();
            }
            
            // Also check if the navbar container itself was replaced
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node instanceof Element && node.querySelector?.('.sdc-boost-newsfeed-button')) {
                        // Our button's container was removed, re-inject
                        setTimeout(() => {
                            this.injectNewsfeedButton();
                            this.setupCounterSubscription();
                        }, 100);
                    }
                });
            });
        };

        // Observe the navbar container
        const navBar = document.querySelector('.nav-bar-right-buttons') || document.body;
        this.setupObserver(navBar, handleMutations, {
            childList: true,
            subtree: true,
        });
        
        // Also observe document.body for when navbar container is replaced entirely
        if (this.bodyObserver) {
            this.bodyObserver.disconnect();
        }
        this.bodyObserver = new MutationObserver((mutations) => {
            // Check if navbar container was added (meaning it was replaced)
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof Element) {
                        const navbar = node.querySelector?.('.nav-bar-right-buttons') || 
                                     (node.classList?.contains('nav-bar-right-buttons') ? node : null);
                        if (navbar && !document.querySelector('.sdc-boost-newsfeed-button')) {
                            setTimeout(() => {
                                this.injectNewsfeedButton();
                                this.setupCounterSubscription();
                            }, 100);
                        }
                    }
                });
            });
        });
        this.bodyObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    /**
     * Setup navigation listeners for React route changes
     */
    private setupNavigationListener(): void {
        const handleNavigation = () => {
            console.log('[NewsfeedModule] Navigation detected, re-injecting button...');
            // Remove button first if it exists
            if (this.newsfeedButton) {
                this.newsfeedButton.remove();
                this.newsfeedButton = null;
                this.counterBadge = null;
            }
            // Wait a bit for DOM to update, then re-inject
            setTimeout(() => {
                this.injectNewsfeedButton();
                this.setupCounterSubscription();
            }, 300);
        };

        // Subscribe to navigation events using shared watcher
        this.unsubscribeNavigation = navigationWatcher.onNavigation(handleNavigation);
        console.log('[NewsfeedModule] Navigation listeners set up');
    }

    /**
     * Hide the SDC Feed sidebar item
     */
    private hideSidebarFeedItem(): void {
        const sidebarItems = document.querySelectorAll('.MuiListItemButton-root');
        sidebarItems.forEach((item) => {
            const menuIcon = item.querySelector('.menu-icon');
            const feedText = Array.from(item.querySelectorAll('p')).find(
                (p) => p.textContent?.trim() === 'SDC Feed'
            );
            
            // Check if this is the feed sidebar item
            if (menuIcon && feedText) {
                const iconSrc = (menuIcon as HTMLImageElement)?.src;
                // Check for news_feed_icon in the src
                if (iconSrc && iconSrc.includes('news_feed_icon') && !this.hiddenSidebarElements.has(item as HTMLElement)) {
                    (item as HTMLElement).style.setProperty('display', 'none', 'important');
                    (item as HTMLElement).setAttribute('data-sdc-boost-hidden', 'true');
                    this.hiddenSidebarElements.add(item as HTMLElement);
                    console.log('[NewsfeedModule] Hidden sidebar feed item');
                }
            }
        });
    }

    /**
     * Setup observer to continuously hide sidebar feed items
     */
    private setupSidebarObserver(): void {
        const sidebarObserver = new MutationObserver(() => {
            this.hideSidebarFeedItem();
        });

        // Observe sidebar container (common sidebar selectors)
        const sidebar = document.querySelector('.MuiDrawer-root') || 
                       document.querySelector('[class*="sidebar"]') ||
                       document.body;
        
        sidebarObserver.observe(sidebar, {
            childList: true,
            subtree: true,
        });

        // Also check periodically for any restored elements
        setInterval(() => {
            this.hiddenSidebarElements.forEach((element) => {
                const computedDisplay = window.getComputedStyle(element).display;
                if (computedDisplay !== 'none') {
                    element.style.setProperty('display', 'none', 'important');
                    element.setAttribute('data-sdc-boost-hidden', 'true');
                }
            });
        }, 1000);
    }

    /**
     * Set up subscription to counter updates
     */
    private setupCounterSubscription(): void {
        // Clean up existing subscription
        this.cleanupCounterSubscription();

        // Subscribe to counter updates for feed_counter
        const unsubscribeUpdate = countersManager.onUpdate((counters: any) => {
            const feedCount = counters.feed_counter || 0;
            this.updateCounterBadge(feedCount);
        });

        // Store unsubscribe function
        this.unsubscribeCounters = unsubscribeUpdate;
    }

    /**
     * Update the counter badge display
     */
    private updateCounterBadge(count: number): void {
        if (!this.counterBadge) {
            // Try to find the badge if it was recreated
            const button = document.querySelector('.sdc-boost-newsfeed-button');
            if (button) {
                this.counterBadge = button.querySelector('.sdc-boost-newsfeed-badge') as HTMLElement;
            }
        }

        if (!this.counterBadge) {
            return;
        }

        if (count > 0) {
            // Show badge with count (limit display to 99+)
            this.counterBadge.textContent = count > 99 ? '99+' : count.toString();
            this.counterBadge.style.display = 'flex';
        } else {
            // Hide badge when count is 0
            this.counterBadge.style.display = 'none';
        }
    }

    /**
     * Clean up counter subscription
     */
    private cleanupCounterSubscription(): void {
        if (this.unsubscribeCounters) {
            this.unsubscribeCounters();
            this.unsubscribeCounters = null;
        }
    }
}
