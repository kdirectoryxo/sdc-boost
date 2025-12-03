import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';
import { navigationWatcher } from './utils/NavigationWatcher';

    /**
     * Module for adding a Boost button to the navbar that opens the boost dialog
     */
export class NavbarBoostButtonModule extends BaseModule {
    private boostButton: HTMLElement | null = null;
    private bodyObserver: MutationObserver | null = null;
    private unsubscribeNavigation: (() => void) | null = null;

    constructor() {
        const configOptions: ModuleConfigOption[] = [];

        super(
            'navbar-boost-button',
            'Navbar Boost Button',
            'Adds a Boost button to the navbar next to Messenger to open the boost popup.',
            'UI',
            configOptions
        );
    }

    async init(): Promise<void> {
        this.injectBoostButton();
        this.setupNavbarObserver();
        this.setupNavigationListener();
    }

    async cleanup(): Promise<void> {
        this.removeBoostButton();
        this.cleanupObserver();
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
     * Inject the Boost button into the navbar
     */
    private injectBoostButton(): void {
        // Check if button already exists
        if (document.querySelector('.sdc-boost-navbar-button')) {
            return;
        }

        // Find the navbar right buttons container
        const navBarRightButtons = document.querySelector('.nav-bar-right-buttons');
        if (!navBarRightButtons) {
            // Try again after a short delay if navbar isn't ready
            setTimeout(() => this.injectBoostButton(), 500);
            return;
        }

        // Find the Messenger button to insert after it
        const messengerButton = navBarRightButtons.querySelector('.nav-bar-option-icon-button');
        if (!messengerButton) {
            setTimeout(() => this.injectBoostButton(), 500);
            return;
        }

        // Create the Boost button container
        const boostButtonContainer = document.createElement('div');
        boostButtonContainer.className = 'nav-bar-option-icon-button sdc-boost-navbar-button';
        // Apply styles to match existing navbar buttons
        boostButtonContainer.style.cssText = `
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
        button.setAttribute('title', 'SDC Boost');
        // Apply button styles
        button.style.cssText = `
            font-family: Roboto, sans-serif, serif, monospace !important;
            -webkit-text-size-adjust: 100%;
            text-align: center;
            color: rgb(255, 255, 255);
            display: inline-grid !important;
            margin-left: 4px !important;
            box-sizing: border-box;
            flex-direction: row;
        `;
        
        // Create the icon (using a simple SVG for boost/rocket icon)
        // Use img tag to match the structure of other navbar buttons
        const icon = document.createElement('img');
        icon.setAttribute('role', 'presentation');
        icon.className = 'boost-icon-navbar';
        // Apply img styles
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
        // Create SVG as data URL (URL encoded)
        const svgContent = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        icon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
        
        // Create ripple span
        const ripple = document.createElement('span');
        ripple.className = 'MuiTouchRipple-root css-w0pj6f';
        
        button.appendChild(icon);
        button.appendChild(ripple);

        // Create label
        const label = document.createElement('label');
        label.className = 'nav-bar-label-boost';
        label.textContent = 'Boost';
        // Apply label styles
        label.style.cssText = `
            font-family: Roboto, sans-serif, serif, monospace !important;
            -webkit-text-size-adjust: 100%;
            text-align: center;
            font-size: 12px;
            color: #fff;
            margin-top: -8px;
        `;

        boostButtonContainer.appendChild(button);
        boostButtonContainer.appendChild(label);

        // Insert after Messenger button
        messengerButton.parentNode?.insertBefore(boostButtonContainer, messengerButton.nextSibling);

        // Add click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openDialog();
        });

        this.boostButton = boostButtonContainer;
    }

    /**
     * Remove the Boost button
     */
    private removeBoostButton(): void {
        if (this.boostButton) {
            this.boostButton.remove();
            this.boostButton = null;
        }
    }

    /**
     * Open the module control panel dialog
     */
    private openDialog(): void {
        // Call the global dialog API if available
        const dialogAPI = (window as any).__sdcBoostModuleControlPanel;
        if (dialogAPI && typeof dialogAPI.open === 'function') {
            dialogAPI.open();
        } else {
            console.error('[NavbarBoostButton] Module control panel dialog API not available');
        }
    }

    /**
     * Setup MutationObserver to watch for navbar changes
     */
    private setupNavbarObserver(): void {
        const handleMutations = (mutations: MutationRecord[]) => {
            // Check if our button was removed
            if (!document.querySelector('.sdc-boost-navbar-button')) {
                // Re-inject if it was removed
                this.injectBoostButton();
            }
            
            // Also check if the navbar container itself was replaced
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node instanceof Element && node.querySelector?.('.sdc-boost-navbar-button')) {
                        // Our button's container was removed, re-inject
                        setTimeout(() => this.injectBoostButton(), 100);
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
        // Use a separate observer since BaseModule only manages one observer
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
                        if (navbar && !document.querySelector('.sdc-boost-navbar-button')) {
                            setTimeout(() => this.injectBoostButton(), 100);
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
            console.log('[NavbarBoostButton] Navigation detected, re-injecting button...');
            // Remove button first if it exists
            if (this.boostButton) {
                this.boostButton.remove();
                this.boostButton = null;
            }
            // Wait a bit for DOM to update, then re-inject
            setTimeout(() => {
                this.injectBoostButton();
            }, 300);
        };

        // Subscribe to navigation events using shared watcher
        this.unsubscribeNavigation = navigationWatcher.onNavigation(handleNavigation);
        console.log('[NavbarBoostButton] Navigation listeners set up');
    }
}

