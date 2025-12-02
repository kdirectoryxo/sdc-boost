import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';
import { countersManager } from '../counters-manager';
import { navigationWatcher } from './utils/NavigationWatcher';

/**
 * Module to add a Chat button to the navbar that opens a Vue-based dialog
 * with a modern WhatsApp-like chat interface
 */
export class ChatDialogModule extends BaseModule {
    private chatButton: HTMLElement | null = null;
    private counterBadge: HTMLElement | null = null;
    private unsubscribeCounters: (() => void) | null = null;
    private bodyObserver: MutationObserver | null = null;
    private unsubscribeNavigation: (() => void) | null = null;
    private oldChatObserver: MutationObserver | null = null;
    private hiddenNavbarElements: Set<HTMLElement> = new Set();
    private hiddenSidebarElements: Set<HTMLElement> = new Set();

    constructor() {
        const configOptions: ModuleConfigOption[] = [
            {
                key: 'hideOldChat',
                label: 'Hide Old Chat',
                description: 'Hide the original Messenger button from navbar and sidebar',
                type: 'boolean',
                default: true,
            },
        ];
        super(
            'chat-dialog',
            'Chat Dialog',
            'Modern WhatsApp-like chat interface in a dialog',
            'Chat',
            configOptions
        );
    }

    async init(): Promise<void> {
        console.log('[ChatDialog] Module init() called');
        
        // Add Chat button to navbar
        this.injectChatButton();
        
        // Watch for navbar changes
        this.setupNavbarObserver();
        
        // Setup navigation listeners
        this.setupNavigationListener();
        
        // Subscribe to counter updates
        this.setupCounterSubscription();
        
        // Setup old chat hiding if enabled
        if (this.getConfigValue('hideOldChat')) {
            this.setupOldChatHiding();
        }
    }

    async cleanup(): Promise<void> {
        this.removeChatButton();
        this.cleanupObserver();
        this.cleanupCounterSubscription();
        this.cleanupOldChatHiding();
        if (this.bodyObserver) {
            this.bodyObserver.disconnect();
            this.bodyObserver = null;
        }
        if (this.unsubscribeNavigation) {
            this.unsubscribeNavigation();
            this.unsubscribeNavigation = null;
        }
    }

    private injectChatButton(): void {
        // Check if button already exists
        if (document.querySelector('.sdc-boost-chat-button')) {
            return;
        }

        // Find the navbar right buttons container
        const navBarRightButtons = document.querySelector('.nav-bar-right-buttons');
        if (!navBarRightButtons) {
            // Try again after a short delay if navbar isn't ready
            setTimeout(() => this.injectChatButton(), 500);
            return;
        }

        // Find the Messenger button or Boost button to insert after
        const messengerButton = navBarRightButtons.querySelector('.nav-bar-option-icon-button');
        const boostButton = navBarRightButtons.querySelector('.sdc-boost-navbar-button');
        const insertAfter = boostButton || messengerButton;
        
        if (!insertAfter) {
            setTimeout(() => this.injectChatButton(), 500);
            return;
        }

        // Create the Chat button container
        const chatButtonContainer = document.createElement('div');
        chatButtonContainer.className = 'nav-bar-option-icon-button sdc-boost-chat-button';
        chatButtonContainer.style.cssText = `
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
        button.setAttribute('title', 'Chat');
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
        
        // Create the icon (chat/message icon SVG)
        const icon = document.createElement('img');
        icon.setAttribute('role', 'presentation');
        icon.className = 'chat-icon-navbar';
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
        
        // Create SVG as data URL (chat bubble icon)
        const svgContent = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        icon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
        
        // Create counter badge
        const badge = document.createElement('span');
        badge.className = 'sdc-boost-chat-badge';
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
        label.className = 'nav-bar-label-chat';
        label.textContent = 'Chat';
        label.style.cssText = `
            font-family: Roboto, sans-serif, serif, monospace !important;
            -webkit-text-size-adjust: 100%;
            text-align: center;
            font-size: 12px;
            color: #fff;
            margin-top: -8px;
        `;

        chatButtonContainer.appendChild(button);
        chatButtonContainer.appendChild(label);

        // Insert after Messenger or Boost button
        insertAfter.parentNode?.insertBefore(chatButtonContainer, insertAfter.nextSibling);

        // Add click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openDialog();
        });

        this.chatButton = chatButtonContainer;
    }

    private openDialog(): void {
        console.log('[ChatDialog] Opening dialog');
        
        // Access the Vue app instance to open dialog (set up by content script)
        const chatDialog = (window as any).__sdcBoostChatDialog;
        if (chatDialog) {
            chatDialog.open();
        } else {
            console.warn('[ChatDialog] Chat dialog UI not initialized yet');
        }
    }

    private removeChatButton(): void {
        if (this.chatButton) {
            this.chatButton.remove();
            this.chatButton = null;
        }
    }

    private setupNavbarObserver(): void {
        const handleMutations = (mutations: MutationRecord[]) => {
            // Check if our button was removed
            if (!document.querySelector('.sdc-boost-chat-button')) {
                // Re-inject if it was removed
                this.injectChatButton();
                // Re-subscribe to counters after re-injection
                this.setupCounterSubscription();
            }
            
            // Also check if the navbar container itself was replaced
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node instanceof Element && node.querySelector?.('.sdc-boost-chat-button')) {
                        // Our button's container was removed, re-inject
                        setTimeout(() => {
                            this.injectChatButton();
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
                        if (navbar && !document.querySelector('.sdc-boost-chat-button')) {
                            setTimeout(() => {
                                this.injectChatButton();
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
            console.log('[ChatDialog] Navigation detected, re-injecting button...');
            // Remove button first if it exists
            if (this.chatButton) {
                this.chatButton.remove();
                this.chatButton = null;
                this.counterBadge = null;
            }
            // Wait a bit for DOM to update, then re-inject
            setTimeout(() => {
                this.injectChatButton();
                this.setupCounterSubscription();
            }, 300);
        };

        // Subscribe to navigation events using shared watcher
        this.unsubscribeNavigation = navigationWatcher.onNavigation(handleNavigation);
        console.log('[ChatDialog] Navigation listeners set up');
    }

    /**
     * Set up subscription to counter updates
     */
    private setupCounterSubscription(): void {
        // Clean up existing subscription
        this.cleanupCounterSubscription();

        // Subscribe to counter updates - use raw API messenger counter
        // We only update the badge when the API counter refreshes, not when calculated values change
        const unsubscribeUpdate = countersManager.onUpdate((counters: any) => {
            // Always use raw API counter instead of calculated value from local chats
            const rawApiCount = countersManager.getRawApiMessengerCounter();
            if (rawApiCount !== null) {
                this.updateCounterBadge(rawApiCount);
            } else {
                // Fallback to counters.messenger if raw API counter not available yet (initial load)
                const messengerCount = counters.messenger || 0;
                this.updateCounterBadge(messengerCount);
            }
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
            const button = document.querySelector('.sdc-boost-chat-button');
            if (button) {
                this.counterBadge = button.querySelector('.sdc-boost-chat-badge') as HTMLElement;
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

    /**
     * Setup observer to hide old chat/messenger elements
     */
    private setupOldChatHiding(): void {
        // Hide existing elements immediately
        this.hideOldChatElements();

        // Set up observer to hide elements when they appear
        if (this.oldChatObserver) {
            this.oldChatObserver.disconnect();
        }

        this.oldChatObserver = new MutationObserver(() => {
            this.hideOldChatElements();
        });

        // Observe document body for new elements
        this.oldChatObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style'], // Watch for style changes that might restore elements
        });

        // Also set up a periodic check as a fallback (in case observer misses something)
        const checkInterval = setInterval(() => {
            if (!this.getConfigValue('hideOldChat')) {
                clearInterval(checkInterval);
                return;
            }
            this.hideOldChatElements();
        }, 1000);

        // Store interval ID for cleanup (we'll need to add a property for this)
        (this as any)._oldChatCheckInterval = checkInterval;
    }

    /**
     * Hide old chat/messenger elements from navbar and sidebar
     */
    private hideOldChatElements(): void {
        // Hide navbar messenger button
        const navbarMessengerButtons = document.querySelectorAll('.nav-bar-option-icon-button');
        navbarMessengerButtons.forEach((button) => {
            // Skip our own chat button and boost button
            if (button.classList.contains('sdc-boost-chat-button') || 
                button.classList.contains('sdc-boost-navbar-button')) {
                return;
            }
            
            const element = button as HTMLElement;
            const messengerIcon = button.querySelector('.messenger-icon-navbar');
            const messengerLabel = button.querySelector('.nav-bar-label-messenger');
            const messengerCounter = button.querySelector('.notification-counter-messenger');
            
            // Check if this is the messenger button
            // It should have either:
            // 1. The messenger-icon-navbar class, OR
            // 2. The nav-bar-label-messenger class, OR  
            // 3. An img with chatbubble in the src AND the notification-counter-messenger
            const iconImg = button.querySelector('img');
            const hasChatbubbleIcon = iconImg && iconImg.src.includes('chatbubble');
            
            // More specific check: must have messenger icon class OR messenger label OR (chatbubble icon AND counter)
            const isMessengerButton = messengerIcon || 
                                     messengerLabel || 
                                     (hasChatbubbleIcon && messengerCounter);
            
            if (isMessengerButton) {
                // If already tracked, check if it's been restored
                if (this.hiddenNavbarElements.has(element)) {
                    const computedDisplay = window.getComputedStyle(element).display;
                    // If element is visible (not none), hide it again
                    if (computedDisplay !== 'none') {
                        element.style.setProperty('display', 'none', 'important');
                        element.setAttribute('data-sdc-boost-hidden', 'true');
                    }
                } else {
                    // New element, hide it
                    element.style.setProperty('display', 'none', 'important');
                    element.setAttribute('data-sdc-boost-hidden', 'true');
                    this.hiddenNavbarElements.add(element);
                }
            }
        });

        // Hide sidebar messenger item
        const sidebarItems = document.querySelectorAll('.MuiListItemButton-root');
        sidebarItems.forEach((item) => {
            const menuIcon = item.querySelector('.menu-icon');
            const messengerText = Array.from(item.querySelectorAll('p')).find(
                (p) => p.textContent?.trim() === 'Messenger'
            );
            
            // Check if this is the messenger sidebar item
            if (menuIcon && messengerText) {
                const iconSrc = (menuIcon as HTMLImageElement)?.src;
                if (iconSrc && iconSrc.includes('messenger_icon') && !this.hiddenSidebarElements.has(item as HTMLElement)) {
                    (item as HTMLElement).style.display = 'none';
                    this.hiddenSidebarElements.add(item as HTMLElement);
                }
            }
        });
    }

    /**
     * Clean up old chat hiding and restore elements
     */
    private cleanupOldChatHiding(): void {
        // Clear interval if it exists
        if ((this as any)._oldChatCheckInterval) {
            clearInterval((this as any)._oldChatCheckInterval);
            (this as any)._oldChatCheckInterval = null;
        }

        // Disconnect observer
        if (this.oldChatObserver) {
            this.oldChatObserver.disconnect();
            this.oldChatObserver = null;
        }

        // Restore hidden navbar elements
        this.hiddenNavbarElements.forEach((element) => {
            element.style.removeProperty('display');
            element.removeAttribute('data-sdc-boost-hidden');
        });
        this.hiddenNavbarElements.clear();

        // Restore hidden sidebar elements
        this.hiddenSidebarElements.forEach((element) => {
            element.style.removeProperty('display');
        });
        this.hiddenSidebarElements.clear();
    }
}

