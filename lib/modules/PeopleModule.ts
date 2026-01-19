import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';
import { navigationWatcher } from './utils/NavigationWatcher';
import { countersManager } from '../counters-manager';

/**
 * Module to add a People button to the navbar that opens a Vue-based dialog
 * with online and viewed members
 */
export class PeopleModule extends BaseModule {
    private peopleButton: HTMLElement | null = null;
    private counterBadge: HTMLElement | null = null;
    private bodyObserver: MutationObserver | null = null;
    private unsubscribeNavigation: (() => void) | null = null;
    private unsubscribeCounters: (() => void) | null = null;

    constructor() {
        const configOptions: ModuleConfigOption[] = [];
        super(
            'people',
            'People',
            'Adds a People button to the navbar that opens a dialog showing online and viewed members',
            'UI',
            configOptions
        );
    }

    async init(): Promise<void> {
        console.log('[PeopleModule] Initializing module...');
        this.injectPeopleButton();
        this.setupNavbarObserver();
        this.setupNavigationListener();
        this.setupCounterSubscription();
    }

    async cleanup(): Promise<void> {
        this.removePeopleButton();
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
     * Inject the People button into the navbar
     */
    private injectPeopleButton(): void {
        // Check if button already exists
        if (document.querySelector('.sdc-boost-people-button')) {
            return;
        }

        // Find the navbar right buttons container
        const navBarRightButtons = document.querySelector('.nav-bar-right-buttons');
        if (!navBarRightButtons) {
            // Try again after a short delay if navbar isn't ready
            setTimeout(() => this.injectPeopleButton(), 500);
            return;
        }

        // Find the last button (newsfeed, chat, or boost) to insert after
        const newsfeedButton = navBarRightButtons.querySelector('.sdc-boost-newsfeed-button');
        const chatButton = navBarRightButtons.querySelector('.sdc-boost-chat-button');
        const boostButton = navBarRightButtons.querySelector('.sdc-boost-navbar-button');
        const insertAfter = newsfeedButton || chatButton || boostButton || navBarRightButtons.querySelector('.nav-bar-option-icon-button');
        
        if (!insertAfter) {
            setTimeout(() => this.injectPeopleButton(), 500);
            return;
        }

        // Create the People button container
        const peopleButtonContainer = document.createElement('div');
        peopleButtonContainer.className = 'nav-bar-option-icon-button sdc-boost-people-button';
        peopleButtonContainer.style.cssText = `
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
        button.setAttribute('title', 'People');
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
        
        // Create the icon (people/users icon SVG)
        const icon = document.createElement('img');
        icon.setAttribute('role', 'presentation');
        icon.className = 'people-icon-navbar';
        icon.style.cssText = `
            -webkit-text-size-adjust: 100%;
            -webkit-tap-highlight-color: transparent;
            cursor: pointer;
            user-select: none;
            text-align: center;
            width: 22px;
            height: 22px;
            opacity: 0.9;
            transition: opacity 0.2s ease, transform 0.2s ease;
        `;
        
        // Create SVG as data URL (people/users icon)
        const svgContent = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9" cy="7" r="4" stroke="white" stroke-width="2" fill="none"/>
            <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="17" cy="7" r="4" stroke="white" stroke-width="2" fill="none"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        icon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
        
        // Create counter badge
        const badge = document.createElement('span');
        badge.className = 'sdc-boost-people-badge';
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
        label.className = 'nav-bar-label-people';
        label.textContent = 'People';
        label.style.cssText = `
            font-family: Roboto, sans-serif !important;
            -webkit-text-size-adjust: 100%;
            text-align: center;
            font-size: 11px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.85);
            margin-top: -6px;
            letter-spacing: 0.01em;
            cursor: pointer;
        `;

        peopleButtonContainer.appendChild(button);
        peopleButtonContainer.appendChild(label);

        // Insert after the last button found
        insertAfter.parentNode?.insertBefore(peopleButtonContainer, insertAfter.nextSibling);

        // Add hover effects
        button.addEventListener('mouseenter', () => {
            icon.style.opacity = '1';
            icon.style.transform = 'scale(1.1)';
        });
        button.addEventListener('mouseleave', () => {
            icon.style.opacity = '0.9';
            icon.style.transform = 'scale(1)';
        });

        // Add click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openDialog();
        });

        this.peopleButton = peopleButtonContainer;
        console.log('[PeopleModule] People button injected successfully');
    }

    /**
     * Remove the People button
     */
    private removePeopleButton(): void {
        if (this.peopleButton) {
            this.peopleButton.remove();
            this.peopleButton = null;
        }
    }

    /**
     * Open the people dialog
     */
    private openDialog(): void {
        console.log('[PeopleModule] Opening people dialog');
        
        // Access the Vue app instance to open dialog (set up by content script)
        const peopleDialog = (window as any).__sdcBoostPeopleDialog;
        if (peopleDialog) {
            peopleDialog.open();
        } else {
            console.warn('[PeopleModule] People dialog UI not initialized yet');
        }
    }

    /**
     * Setup MutationObserver to watch for navbar changes
     */
    private setupNavbarObserver(): void {
        const handleMutations = (mutations: MutationRecord[]) => {
            // Check if our button was removed
            if (!document.querySelector('.sdc-boost-people-button')) {
                // Re-inject if it was removed
                this.injectPeopleButton();
                // Re-subscribe to counters after re-injection
                this.setupCounterSubscription();
            }
            
            // Also check if the navbar container itself was replaced
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node instanceof Element && node.querySelector?.('.sdc-boost-people-button')) {
                        // Our button's container was removed, re-inject
                        setTimeout(() => {
                            this.injectPeopleButton();
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
                        if (navbar && !document.querySelector('.sdc-boost-people-button')) {
                            setTimeout(() => {
                                this.injectPeopleButton();
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
            console.log('[PeopleModule] Navigation detected, re-injecting button...');
            // Remove button first if it exists
            if (this.peopleButton) {
                this.peopleButton.remove();
                this.peopleButton = null;
            }
            // Wait a bit for DOM to update, then re-inject
            setTimeout(() => {
                this.injectPeopleButton();
                this.setupCounterSubscription();
            }, 300);
        };

        // Subscribe to navigation events using shared watcher
        this.unsubscribeNavigation = navigationWatcher.onNavigation(handleNavigation);
        console.log('[PeopleModule] Navigation listeners set up');
    }

    /**
     * Set up subscription to counter updates
     */
    private setupCounterSubscription(): void {
        // Clean up existing subscription
        this.cleanupCounterSubscription();

        // Subscribe to counter updates for viewed counter
        const unsubscribeUpdate = countersManager.onUpdate((counters: any) => {
            const viewedCount = counters.viewed || 0;
            this.updateCounterBadge(viewedCount);
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
            const button = document.querySelector('.sdc-boost-people-button');
            if (button) {
                this.counterBadge = button.querySelector('.sdc-boost-people-badge') as HTMLElement;
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
