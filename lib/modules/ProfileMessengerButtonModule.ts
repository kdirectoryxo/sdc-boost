import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';
import { navigationWatcher } from './utils/NavigationWatcher';

/**
 * Module for intercepting messenger button on profile pages to open chat dialog
 */
export class ProfileMessengerButtonModule extends BaseModule {
    private messengerButton: HTMLElement | null = null;
    private clickHandler: ((e: Event) => void) | null = null;
    private unsubscribeNavigation: (() => void) | null = null;
    private lastProfileHash: string | null = null; // Track last profile page to avoid re-checking
    private isIntercepting: boolean = false; // Prevent concurrent interception attempts
    private retryTimeout: number | null = null; // Track retry timeout to cancel if needed

    constructor() {
        const configOptions: ModuleConfigOption[] = [];

        super(
            'profile-messenger-button',
            'Profile Messenger Button',
            'Intercepts messenger button on profile pages to open chat dialog with that user.',
            'UI',
            configOptions
        );
    }

    async init(): Promise<void> {
        this.interceptMessengerButton();
        this.setupNavigationWatcher();
    }

    async cleanup(): Promise<void> {
        this.removeClickHandler();
        if (this.unsubscribeNavigation) {
            this.unsubscribeNavigation();
            this.unsubscribeNavigation = null;
        }
    }

    /**
     * Setup navigation watcher to re-inject on page changes
     */
    private setupNavigationWatcher(): void {
        this.unsubscribeNavigation = navigationWatcher.onNavigation(() => {
            const hash = window.location.hash;
            const isProfilePage = hash.includes('#/profile') || hash.includes('/profile');
            
            // Extract profile ID from hash to check if we're on the same profile page
            let currentProfileId: string | null = null;
            if (hash.includes('?')) {
                const hashQueryString = hash.split('?')[1];
                const hashParams = new URLSearchParams(hashQueryString);
                currentProfileId = hashParams.get('idUser');
            }
            
            // If we're on the same profile page (just URL params changed, like chat=open),
            // don't re-check - the button is already intercepted
            if (isProfilePage && currentProfileId && this.lastProfileHash === hash.split('?')[0]) {
                // Same profile page, just URL params changed - skip
                return;
            }
            
            // Clear retry timeout if one is pending
            if (this.retryTimeout !== null) {
                clearTimeout(this.retryTimeout);
                this.retryTimeout = null;
            }
            
            // Remove existing handler first
            this.removeClickHandler();
            this.lastProfileHash = null; // Reset tracking
            
            // Wait a bit for DOM to update after navigation, then re-inject
            setTimeout(() => {
                this.interceptMessengerButton();
            }, 500);
        });
    }

    /**
     * Intercept the messenger button on profile pages
     */
    private interceptMessengerButton(): void {
        // Prevent concurrent interception attempts
        if (this.isIntercepting) {
            return;
        }
        
        // Check if we're on a profile page
        const hash = window.location.hash;
        const isProfilePage = hash.includes('#/profile') || hash.includes('/profile');
        
        // Extract profile ID to track if we're on the same page
        let currentProfileId: string | null = null;
        const profileHash = hash.split('?')[0]; // Hash without query params
        
        if (hash.includes('?')) {
            const hashQueryString = hash.split('?')[1];
            const hashParams = new URLSearchParams(hashQueryString);
            currentProfileId = hashParams.get('idUser');
        }
        
        // If we already intercepted this profile page, skip
        if (isProfilePage && this.lastProfileHash === profileHash && this.messengerButton) {
            return;
        }
        
        if (!isProfilePage) {
            this.lastProfileHash = null;
            return;
        }
        
        this.isIntercepting = true;
        
        // Remove existing handler if any
        this.removeClickHandler();

        // Find the messenger button by looking for the messenger icon on profile pages
        // Try multiple selectors to find the icon (white icon, green icon, or any messenger icon)
        let messengerIcon = document.querySelector('img[src*="messenger_white_icon"]') as HTMLImageElement;
        
        if (!messengerIcon) {
            messengerIcon = document.querySelector('img[src*="messenger_green_icon"]') as HTMLImageElement;
        }
        
        if (!messengerIcon) {
            // Try to find any messenger icon in the profile area
            // Look for images with "messenger" in src that are near "Messenger" text
            const allMessengerImages = Array.from(document.querySelectorAll('img[src*="messenger"]')) as HTMLImageElement[];
            for (const img of allMessengerImages) {
                // Check if this image is near "Messenger" text (within same parent container)
                const parent = img.closest('.MuiGrid-root');
                if (parent) {
                    const messengerText = Array.from(parent.querySelectorAll('p, span, div')).find(
                        el => el.textContent?.trim().toLowerCase() === 'messenger'
                    );
                    if (messengerText) {
                        messengerIcon = img;
                        break;
                    }
                }
            }
        }
        
        if (!messengerIcon) {
            this.isIntercepting = false;
            // Only retry if we're actually on a profile page
            if (isProfilePage) {
                // Retry after a short delay if button not found yet (max 3 retries)
                const retryCount = (this.messengerButton as any)?.__retryCount || 0;
                if (retryCount < 3) {
                    this.retryTimeout = window.setTimeout(() => {
                        (this.messengerButton as any) = { __retryCount: retryCount + 1 };
                        this.interceptMessengerButton();
                    }, 500);
                }
            }
            return;
        }
        
        // Reset retry count on success
        if ((this.messengerButton as any)?.__retryCount) {
            delete (this.messengerButton as any).__retryCount;
        }

        // Find the clickable parent element
        // The structure is: clickable MuiGrid-root > icon box + "Messenger" text
        let targetButton: HTMLElement | null = null;

        // First, try to find a clickable parent (button, link, or div with onClick or cursor pointer)
        const clickableParent = messengerIcon.closest('button, a, [role="button"], [onclick], [class*="MuiButton"], [style*="cursor: pointer"], [style*="cursor:pointer"]') as HTMLElement;
        
        if (clickableParent) {
            targetButton = clickableParent;
        } else {
            // Find the MuiGrid-root container that contains both the icon and "Messenger" text
            // This is typically the clickable element
            const gridContainer = messengerIcon.closest('.MuiGrid-root');
            
            if (gridContainer instanceof HTMLElement) {
                // Check if this grid container contains "Messenger" text (it should)
                const hasMessengerText = Array.from(gridContainer.querySelectorAll('p, span, div')).some(
                    el => el.textContent?.trim().toLowerCase() === 'messenger'
                );
                
                if (hasMessengerText) {
                    // This is likely the clickable container
                    targetButton = gridContainer;
                } else {
                    // Check if the grid container's parent is clickable
                    const parent = gridContainer.parentElement;
                    
                    if (parent && (parent.tagName === 'BUTTON' || parent.tagName === 'A' || parent.hasAttribute('onclick'))) {
                        targetButton = parent;
                    } else {
                        // Fallback: use the grid container anyway
                        targetButton = gridContainer;
                    }
                }
            }
        }

        if (!targetButton) {
            this.isIntercepting = false;
            // Retry after a short delay if button not found yet
            const retryCount = (this.messengerButton as any)?.__retryCount || 0;
            if (retryCount < 3) {
                this.retryTimeout = window.setTimeout(() => {
                    (this.messengerButton as any) = { __retryCount: retryCount + 1 };
                    this.interceptMessengerButton();
                }, 500);
            }
            return;
        }

        this.messengerButton = targetButton;

        // If it's a link, remove or override the href to prevent navigation
        if (targetButton.tagName === 'A') {
            const originalHref = (targetButton as HTMLAnchorElement).href;
            (targetButton as HTMLAnchorElement).href = 'javascript:void(0)';
            (targetButton as any).__sdcBoostOriginalHref = originalHref;
        }

        // Create click handler
        this.clickHandler = (e: Event) => {
            // Prevent all default behavior and stop all propagation
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Extract userId from URL
            // The URL structure is: #/profile?idUser=7717742
            // So we need to parse the hash fragment, not the search params
            let userId: string | null = null;
            
            // Try hash fragment first (most common case for React Router)
            const hash = window.location.hash;
            if (hash.includes('?')) {
                const hashQueryString = hash.split('?')[1];
                const hashParams = new URLSearchParams(hashQueryString);
                userId = hashParams.get('idUser');
            }
            
            // Fallback to search params if not found in hash
            if (!userId) {
                const urlParams = new URLSearchParams(window.location.search);
                userId = urlParams.get('idUser');
            }

            if (!userId) {
                console.warn('[ProfileMessengerButton] No userId found in URL');
                return false;
            }

            // Open chat dialog with userId
            this.openChatDialog(userId);
            
            // Return false as additional safeguard
            return false;
        };

        // Add click handler (use capture phase to intercept early, before other handlers)
        targetButton.addEventListener('click', this.clickHandler, true);

        // Also try mousedown as a backup
        const mouseDownHandler = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };
        targetButton.addEventListener('mousedown', mouseDownHandler, true);
        (targetButton as any).__sdcBoostMouseDownHandler = mouseDownHandler;

        // Track that we've successfully intercepted this profile page
        this.lastProfileHash = profileHash;
        this.isIntercepting = false;
    }

    /**
     * Remove click handler
     */
    private removeClickHandler(): void {
        // Clear any pending retry timeout
        if (this.retryTimeout !== null) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
        
        if (this.messengerButton) {
            if (this.clickHandler) {
                this.messengerButton.removeEventListener('click', this.clickHandler, true);
                this.clickHandler = null;
            }
            
            // Remove mousedown handler if it exists
            const mouseDownHandler = (this.messengerButton as any).__sdcBoostMouseDownHandler;
            if (mouseDownHandler) {
                this.messengerButton.removeEventListener('mousedown', mouseDownHandler, true);
                delete (this.messengerButton as any).__sdcBoostMouseDownHandler;
            }
            
            // Restore original href if we modified it
            if (this.messengerButton.tagName === 'A') {
                const originalHref = (this.messengerButton as any).__sdcBoostOriginalHref;
                if (originalHref) {
                    (this.messengerButton as HTMLAnchorElement).href = originalHref;
                    delete (this.messengerButton as any).__sdcBoostOriginalHref;
                }
            }
            
            this.messengerButton = null;
        }
        
        this.isIntercepting = false;
    }

    /**
     * Open chat dialog with the specified userId
     */
    private openChatDialog(userId: string): void {
        // First, update URL to open chat dialog with userId as chatId
        // Use replaceState to avoid adding to history and prevent back button issues
        const url = new URL(window.location.href);
        url.searchParams.set('chat', 'open');
        url.searchParams.set('chatId', userId);
        
        // Use replaceState instead of pushState to avoid history entry
        // This prevents the original navigation from overriding our URL change
        window.history.replaceState({}, '', url.toString());
        
        // Manually dispatch popstate event since replaceState doesn't trigger it
        // This ensures ChatDialogWrapper and useChatDialogLifecycle detect the URL change
        window.dispatchEvent(new PopStateEvent('popstate'));

        // Use setTimeout to ensure URL update and popstate event are processed
        // This gives the watchers time to process the URL change before opening dialog
        setTimeout(() => {
            // Open dialog via global method (this will also update URL via ChatDialogWrapper)
            // The open() method will preserve the existing chatId in the URL
            const chatDialog = (window as any).__sdcBoostChatDialog;
            if (chatDialog) {
                chatDialog.open();
            }
        }, 0);
    }
}

