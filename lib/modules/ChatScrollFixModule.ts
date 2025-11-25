import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';

/**
 * Module to fix chat scroll behavior when loading older messages
 * Prevents auto-scroll to bottom when user is scrolling up to read older messages
 */
export class ChatScrollFixModule extends BaseModule {
    private chatContainer: HTMLElement | null = null;
    private scrollListener: (() => void) | null = null;
    private isUserScrolling: boolean = false;
    private wasAtBottom: boolean = true;
    private lastScrollTop: number = 0;
    private scrollTimeout: number | null = null;
    private loadingDialog: HTMLElement | null = null;
    private isRestoringScroll: boolean = false;
    private preventAutoScrollUntil: number = 0; // Timestamp until which we prevent auto-scroll
    private intersectionObserver: IntersectionObserver | null = null;
    private scrollTopProxy: any = null;

    constructor() {
        const configOptions: ModuleConfigOption[] = [];
        super(
            'chat-scroll-fix',
            'Chat Scroll Fix',
            'Prevents auto-scroll to bottom when loading older messages in chat',
            'Chat',
            configOptions
        );
    }

    async init(): Promise<void> {
        console.log('[ChatScrollFix] Module init() called');
        // Wait for chat container to be available
        this.findChatContainer();
        
        if (!this.chatContainer) {
            console.log('[ChatScrollFix] Chat container not found, retrying in 1s...');
            // Retry after a delay if not found immediately
            setTimeout(() => this.findChatContainer(), 1000);
        }

        // Also watch for navigation changes
        this.setupHashChangeListener();
    }

    async cleanup(): Promise<void> {
        if (this.scrollListener && this.chatContainer) {
            this.chatContainer.removeEventListener('scroll', this.scrollListener);
            this.scrollListener = null;
        }
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        this.cleanupObserver();
        this.chatContainer = null;
        this.loadingDialog = null;
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }
    }

    private findChatContainer(): void {
        console.log('[ChatScrollFix] Searching for chat container (#chat-content)...');
        const chatContent = document.querySelector('#chat-content') as HTMLElement;
        
        if (chatContent) {
            // Check if this is actually the scrollable element
            const computedStyle = window.getComputedStyle(chatContent);
            const isScrollable = computedStyle.overflow === 'auto' || 
                                 computedStyle.overflow === 'scroll' ||
                                 computedStyle.overflowY === 'auto' ||
                                 computedStyle.overflowY === 'scroll';
            
            console.log('[ChatScrollFix] Chat content element found!', {
                scrollHeight: chatContent.scrollHeight,
                clientHeight: chatContent.clientHeight,
                scrollTop: chatContent.scrollTop,
                overflow: computedStyle.overflow,
                overflowY: computedStyle.overflowY,
                isScrollable,
                display: computedStyle.display,
                alignItems: computedStyle.alignItems
            });
            
            // If not scrollable, find the actual scrollable parent
            if (!isScrollable) {
                console.log('[ChatScrollFix] Element is not scrollable, searching for scrollable parent...');
                let parent: HTMLElement | null = chatContent.parentElement;
                while (parent) {
                    const parentStyle = window.getComputedStyle(parent);
                    const parentIsScrollable = parentStyle.overflow === 'auto' || 
                                               parentStyle.overflow === 'scroll' ||
                                               parentStyle.overflowY === 'auto' ||
                                               parentStyle.overflowY === 'scroll' ||
                                               (parent.scrollHeight > parent.clientHeight && parent.clientHeight > 0);
                    
                    if (parentIsScrollable) {
                        console.log('[ChatScrollFix] Found scrollable parent!', {
                            tagName: parent.tagName,
                            id: parent.id,
                            className: parent.className,
                            scrollHeight: parent.scrollHeight,
                            clientHeight: parent.clientHeight,
                            scrollTop: parent.scrollTop,
                            overflow: parentStyle.overflow,
                            overflowY: parentStyle.overflowY
                        });
                        this.chatContainer = parent;
                        break;
                    }
                    parent = parent.parentElement;
                }
                
                // If still not found, use the chat-content element itself
                if (!this.chatContainer) {
                    console.log('[ChatScrollFix] No scrollable parent found, using chat-content element');
                    this.chatContainer = chatContent;
                }
            } else {
                this.chatContainer = chatContent;
            }
            
            this.setupScrollInterception();
            this.setupScrollTracking();
            this.setupIntersectionObserver();
            this.setupMutationObserver();
            console.log('[ChatScrollFix] Chat scroll fix fully initialized');
        } else {
            console.warn('[ChatScrollFix] Chat container (#chat-content) not found in DOM');
        }
    }

    private setupScrollInterception(): void {
        if (!this.chatContainer) return;

        // Intercept scrollTop property to track all changes
        const container = this.chatContainer;
        let lastKnownScrollTop = container.scrollTop;
        const self = this;
        
        // Store original scrollTop descriptor
        const originalValue = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(container), 'scrollTop');
        
        try {
            Object.defineProperty(container, 'scrollTop', {
                get: function() {
                    return originalValue?.get?.call(this) ?? (this as any)._scrollTop ?? 0;
                },
                set: function(value: number) {
                    const currentScrollTop = originalValue?.get?.call(this) ?? (this as any)._scrollTop ?? 0;
                    const scrollHeight = this.scrollHeight;
                    const clientHeight = this.clientHeight;
                    const distanceFromBottom = scrollHeight - currentScrollTop - clientHeight;
                    const isAtBottom = distanceFromBottom < 50;
                    
                    // Log all scrollTop changes
                    if (Math.abs(value - lastKnownScrollTop) > 5) {
                        console.log('[ChatScrollFix] scrollTop SETTER called:', {
                            from: lastKnownScrollTop,
                            to: value,
                            scrollHeight,
                            clientHeight,
                            distanceFromBottom: scrollHeight - value - clientHeight,
                            isAtBottom: (scrollHeight - value - clientHeight) < 50,
                            hasSavedState: !!self.savedScrollState,
                            preventAutoScrollActive: self.preventAutoScrollUntil > Date.now()
                        });
                    }
                    
                    // If trying to set scrollTop to 0 or near-bottom when user was scrolled up, prevent it
                    if (self.preventAutoScrollUntil > Date.now() && self.savedScrollState && !self.wasAtBottom) {
                        const maxScroll = scrollHeight - clientHeight;
                        if (value >= maxScroll - 100 || value === 0) {
                            const expectedScrollTop = self.savedScrollState.scrollTop + (scrollHeight - self.savedScrollState.scrollHeight);
                            console.log('[ChatScrollFix] BLOCKING scrollTop set - preventing auto-scroll:', {
                                attemptedValue: value,
                                expectedValue: expectedScrollTop,
                                currentScrollTop,
                                wasAtBottom: self.wasAtBottom
                            });
                            lastKnownScrollTop = expectedScrollTop;
                            originalValue?.set?.call(this, expectedScrollTop);
                            return;
                        }
                    }
                    
                    // Track scroll position changes
                    if (Math.abs(value - lastKnownScrollTop) > 5) {
                        lastKnownScrollTop = value;
                        
                        // Update wasAtBottom
                        const newDistanceFromBottom = scrollHeight - value - clientHeight;
                        self.wasAtBottom = newDistanceFromBottom < 50;
                        
                        // If scrolling up (value increasing from small number), save position
                        if (value > 50 && value < 500 && !self.savedScrollState && !self.wasAtBottom) {
                            console.log('[ChatScrollFix] Detected scroll up via setter - saving position');
                            self.prepareForContentLoad();
                        }
                    }
                    
                    originalValue?.set?.call(this, value);
                },
                configurable: true,
                enumerable: true
            });
            
            console.log('[ChatScrollFix] Scroll interception set up');
        } catch (e) {
            console.warn('[ChatScrollFix] Failed to set up scroll interception:', e);
        }
    }

    private setupIntersectionObserver(): void {
        if (!this.chatContainer) return;

        // Create a sentinel element at the top of the chat to detect when user scrolls near top
        const sentinel = document.createElement('div');
        sentinel.style.height = '1px';
        sentinel.style.position = 'absolute';
        sentinel.style.top = '0';
        sentinel.style.width = '1px';
        sentinel.style.pointerEvents = 'none';
        sentinel.style.visibility = 'hidden';
        
        // Find the first child and insert sentinel before it
        const firstChild = this.chatContainer.firstElementChild;
        if (firstChild && firstChild.parentNode) {
            firstChild.parentNode.insertBefore(sentinel, firstChild);
        } else {
            this.chatContainer.appendChild(sentinel);
        }

        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.wasAtBottom && !this.savedScrollState) {
                    // User is near the top, save scroll position
                    console.log('[ChatScrollFix] IntersectionObserver: User near top, saving position');
                    this.prepareForContentLoad();
                }
            });
        }, {
            root: this.chatContainer,
            rootMargin: '200px 0px 0px 0px',
            threshold: 0
        });

        this.intersectionObserver.observe(sentinel);
        console.log('[ChatScrollFix] IntersectionObserver set up');
    }

    private setupScrollTracking(): void {
        if (!this.chatContainer) {
            console.warn('[ChatScrollFix] Cannot setup scroll tracking: no chat container');
            return;
        }

        console.log('[ChatScrollFix] Setting up scroll tracking...');
        
        // Also set up an interval to periodically check scroll position
        // This helps catch cases where scroll events might not fire
        // Use a very frequent interval to catch scroll changes
        setInterval(() => {
            if (!this.chatContainer) return;
            
            const scrollTop = this.chatContainer.scrollTop;
            const scrollHeight = this.chatContainer.scrollHeight;
            const clientHeight = this.chatContainer.clientHeight;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const isAtBottom = distanceFromBottom < 50;
            const distanceFromTop = scrollTop;
            
            // Track scroll position changes
            const scrollChanged = Math.abs(scrollTop - this.lastScrollTop) > 5;
            const isScrollingUp = scrollTop > this.lastScrollTop;
            
            // Log significant scroll changes
            if (scrollChanged) {
                console.log('[ChatScrollFix] Interval detected scroll change:', {
                    scrollTop,
                    lastScrollTop: this.lastScrollTop,
                    scrollHeight,
                    clientHeight,
                    distanceFromBottom,
                    distanceFromTop,
                    isAtBottom,
                    isScrollingUp,
                    wasAtBottom: this.wasAtBottom,
                    hasSavedState: !!this.savedScrollState
                });
            }
            
            // Update wasAtBottom if it changed
            if (this.wasAtBottom !== isAtBottom) {
                console.log('[ChatScrollFix] Bottom state changed:', {
                    wasAtBottom: this.wasAtBottom,
                    isAtBottom,
                    scrollTop,
                    distanceFromBottom
                });
                this.wasAtBottom = isAtBottom;
            }
            
            // CRITICAL: If NOT at bottom, continuously save the position
            // This ensures we have the position saved even if it gets reset
            if (!isAtBottom && scrollTop > 0) {
                // Update saved state if we have one, or create new one
                if (this.savedScrollState) {
                    // Update existing saved state with current position
                    this.savedScrollState.scrollTop = scrollTop;
                    this.savedScrollState.scrollHeight = scrollHeight;
                } else {
                    // Create new saved state
                    console.log('[ChatScrollFix] Interval: NOT at bottom, saving position continuously:', {
                        scrollTop,
                        distanceFromTop,
                        distanceFromBottom,
                        isAtBottom
                    });
                    this.prepareForContentLoad();
                }
            } else if (isAtBottom) {
                // If at bottom, only clear saved state if we're not in the middle of loading
                // (loading dialog might cause false "at bottom" detection)
                if (this.savedScrollState && !this.loadingDialog) {
                    console.log('[ChatScrollFix] Interval: Now at bottom, clearing saved state');
                    this.savedScrollState = null;
                } else if (this.savedScrollState && this.loadingDialog) {
                    console.log('[ChatScrollFix] Interval: At bottom but loading dialog active - keeping saved state');
                }
            }
            
            // If we're in a state where we should prevent auto-scroll, check if something is trying to scroll to bottom
            if (this.preventAutoScrollUntil > Date.now() && !this.wasAtBottom && this.savedScrollState) {
                const maxScroll = scrollHeight - clientHeight;
                // If scroll position is being set to near bottom, restore it
                if (scrollTop >= maxScroll - 100 && scrollTop !== this.savedScrollState.scrollTop) {
                    const expectedScrollTop = this.savedScrollState.scrollTop + (scrollHeight - this.savedScrollState.scrollHeight);
                    console.log('[ChatScrollFix] Interval: Detected unwanted scroll to bottom, preventing:', {
                        currentScrollTop: scrollTop,
                        expectedScrollTop,
                        maxScroll,
                        savedScrollTop: this.savedScrollState.scrollTop
                    });
                    this.chatContainer.scrollTop = expectedScrollTop;
                }
            }
            
            this.lastScrollTop = scrollTop;
        }, 50); // Check every 50ms for more responsiveness
        this.scrollListener = () => {
            if (!this.chatContainer) return;

            const scrollTop = this.chatContainer.scrollTop;
            const scrollHeight = this.chatContainer.scrollHeight;
            const clientHeight = this.chatContainer.clientHeight;
            
            // Check if user is at bottom (within 50px threshold)
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const isAtBottom = distanceFromBottom < 50;
            const wasAtBottomBefore = this.wasAtBottom;
            this.wasAtBottom = isAtBottom;
            
            // Detect if user is scrolling up (scrollTop increasing)
            const isScrollingUp = scrollTop > this.lastScrollTop;
            const distanceFromTop = scrollTop;
            
            // If user is scrolling up and near the top (within 200px), save position proactively
            // This captures the position BEFORE the loading dialog appears
            if (isScrollingUp && distanceFromTop < 200 && !this.savedScrollState) {
                console.log('[ChatScrollFix] User scrolling up near top - saving position proactively:', {
                    scrollTop,
                    scrollHeight,
                    distanceFromTop,
                    isAtBottom
                });
                this.prepareForContentLoad();
            }
            
            // Log when scroll position changes significantly or bottom state changes
            if (wasAtBottomBefore !== isAtBottom || Math.abs(scrollTop - this.lastScrollTop) > 50) {
                console.log('[ChatScrollFix] Scroll event:', {
                    scrollTop,
                    scrollHeight,
                    clientHeight,
                    distanceFromBottom,
                    distanceFromTop,
                    isAtBottom,
                    wasAtBottomBefore,
                    isScrollingUp,
                    scrollChanged: Math.abs(scrollTop - this.lastScrollTop)
                });
            }
            
            // Track if user is actively scrolling
            this.isUserScrolling = true;
            
            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }
            
            // Reset scrolling flag after 150ms of no scrolling
            this.scrollTimeout = window.setTimeout(() => {
                this.isUserScrolling = false;
                console.log('[ChatScrollFix] User stopped scrolling, final state:', {
                    wasAtBottom: this.wasAtBottom,
                    scrollTop: this.chatContainer?.scrollTop,
                    scrollHeight: this.chatContainer?.scrollHeight
                });
            }, 150);

            this.lastScrollTop = scrollTop;
        };

        this.chatContainer.addEventListener('scroll', this.scrollListener, { passive: true });
        console.log('[ChatScrollFix] Scroll tracking enabled');
    }

    private setupMutationObserver(): void {
        if (!this.chatContainer) {
            console.warn('[ChatScrollFix] Cannot setup mutation observer: no chat container');
            return;
        }

        console.log('[ChatScrollFix] Setting up mutation observer...');
        let restoreTimeout: number | null = null;

        const handleMutations = (mutations: MutationRecord[]) => {
            if (!this.chatContainer) return;

            // Check if loading dialog appeared (indicating new content is being loaded)
            const loadingDialog = document.querySelector('.MuiDialog-root.transparent-dialog') as HTMLElement;
            const isLoading = loadingDialog && window.getComputedStyle(loadingDialog).display !== 'none';
            
            if (isLoading && !this.loadingDialog) {
                // Loading started
                console.log('[ChatScrollFix] Loading dialog appeared');
                this.loadingDialog = loadingDialog;
                // Check actual scroll position right now
                if (this.chatContainer) {
                    const scrollTop = this.chatContainer.scrollTop;
                    const scrollHeight = this.chatContainer.scrollHeight;
                    const clientHeight = this.chatContainer.clientHeight;
                    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
                    console.log('[ChatScrollFix] Current scroll position when loading starts:', {
                        scrollTop,
                        scrollHeight,
                        clientHeight,
                        distanceFromBottom,
                        isAtBottom: distanceFromBottom < 50,
                        hasSavedState: !!this.savedScrollState
                    });
                }
                // Only prepare if we haven't already saved (should have been saved when scrolling up)
                if (!this.savedScrollState) {
                    console.log('[ChatScrollFix] No saved state found, preparing now (might be too late)');
                    this.prepareForContentLoad();
                } else {
                    console.log('[ChatScrollFix] Using previously saved scroll state');
                }
            } else if (!isLoading && this.loadingDialog) {
                // Loading finished - restore scroll position after a short delay
                console.log('[ChatScrollFix] Loading dialog disappeared - will restore scroll position');
                this.loadingDialog = null;
                if (restoreTimeout) {
                    clearTimeout(restoreTimeout);
                }
                restoreTimeout = window.setTimeout(() => {
                    this.restoreScrollPosition();
                    restoreTimeout = null;
                }, 150);
            }

            // Check for direct content additions to chat container
            let hasNewContent = false;
            let addedNodesCount = 0;
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    addedNodesCount += mutation.addedNodes.length;
                    mutation.addedNodes.forEach((node) => {
                        if (node instanceof Element) {
                            // Check if it's a chat message bubble or contains one
                            if (node.classList?.contains('bubbleleft_v2') || 
                                node.classList?.contains('bubbleright_v2') ||
                                node.classList?.contains('pl-2') ||
                                node.classList?.contains('pr-2') ||
                                node.querySelector?.('.bubbleleft_v2') ||
                                node.querySelector?.('.bubbleright_v2')) {
                                hasNewContent = true;
                                console.log('[ChatScrollFix] Detected new chat content:', {
                                    className: node.className,
                                    tagName: node.tagName,
                                    hasBubble: !!(node.querySelector?.('.bubbleleft_v2') || node.querySelector?.('.bubbleright_v2'))
                                });
                            }
                        }
                    });
                }
            });

            if (addedNodesCount > 0 && !hasNewContent) {
                // Log when nodes are added but not recognized as chat content
                console.log('[ChatScrollFix] Nodes added but not recognized as chat content:', addedNodesCount);
            }

            // If new content was added and user was scrolled up, preserve position
            if (hasNewContent && !this.wasAtBottom) {
                console.log('[ChatScrollFix] New content detected while scrolled up - will preserve position', {
                    wasAtBottom: this.wasAtBottom,
                    hasSavedState: !!this.savedScrollState
                });
                // Save state if not already saved
                if (!this.savedScrollState) {
                    this.prepareForContentLoad();
                }
                
                // Restore position after DOM updates
                if (restoreTimeout) {
                    clearTimeout(restoreTimeout);
                }
                restoreTimeout = window.setTimeout(() => {
                    this.restoreScrollPosition();
                    restoreTimeout = null;
                }, 50);
            } else if (hasNewContent && this.wasAtBottom) {
                console.log('[ChatScrollFix] New content detected but user is at bottom - allowing auto-scroll');
            }
        };

        this.setupObserver(this.chatContainer, handleMutations, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
        console.log('[ChatScrollFix] Mutation observer set up on chat container');

        // Also observe the document for loading dialogs
        this.setupObserver(document.body, handleMutations, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
        console.log('[ChatScrollFix] Mutation observer set up on document body');
    }

    private savedScrollState: {
        scrollTop: number;
        scrollHeight: number;
        firstChild: Element | null;
    } | null = null;

    private prepareForContentLoad(): void {
        if (!this.chatContainer) {
            console.warn('[ChatScrollFix] Cannot prepare for content load: no chat container');
            return;
        }

        // Check actual scroll position at this moment
        const scrollTop = this.chatContainer.scrollTop;
        const scrollHeight = this.chatContainer.scrollHeight;
        const clientHeight = this.chatContainer.clientHeight;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const isActuallyAtBottom = distanceFromBottom < 50;

        // Update wasAtBottom based on actual position
        this.wasAtBottom = isActuallyAtBottom;

        // Save current scroll state
        const firstChild = this.chatContainer.firstElementChild;
        this.savedScrollState = {
            scrollTop: scrollTop,
            scrollHeight: scrollHeight,
            firstChild: firstChild
        };
        console.log('[ChatScrollFix] Saved scroll state:', {
            scrollTop: this.savedScrollState.scrollTop,
            scrollHeight: this.savedScrollState.scrollHeight,
            clientHeight,
            distanceFromBottom,
            isActuallyAtBottom,
            wasAtBottom: this.wasAtBottom,
            firstChildTag: firstChild?.tagName
        });
    }

    private restoreScrollPosition(): void {
        console.log('[ChatScrollFix] restoreScrollPosition() called', {
            hasContainer: !!this.chatContainer,
            hasSavedState: !!this.savedScrollState,
            wasAtBottom: this.wasAtBottom
        });

        if (!this.chatContainer) {
            console.warn('[ChatScrollFix] Cannot restore: no chat container');
            return;
        }

        if (!this.savedScrollState) {
            console.warn('[ChatScrollFix] Cannot restore: no saved scroll state');
            return;
        }

        // Re-check if we're actually at bottom now (in case scroll position changed)
        const currentScrollTop = this.chatContainer.scrollTop;
        const currentScrollHeight = this.chatContainer.scrollHeight;
        const currentClientHeight = this.chatContainer.clientHeight;
        const currentDistanceFromBottom = currentScrollHeight - currentScrollTop - currentClientHeight;
        const isCurrentlyAtBottom = currentDistanceFromBottom < 50;

        console.log('[ChatScrollFix] Current position check:', {
            savedWasAtBottom: this.wasAtBottom,
            currentScrollTop,
            currentScrollHeight,
            currentDistanceFromBottom,
            isCurrentlyAtBottom,
            savedScrollTop: this.savedScrollState.scrollTop
        });

        // If user was at bottom when we saved, let it scroll to bottom naturally
        if (this.wasAtBottom) {
            console.log('[ChatScrollFix] User was at bottom when saved - allowing natural scroll');
            this.savedScrollState = null;
            this.preventAutoScrollUntil = 0;
            return;
        }

        // Set a flag to prevent auto-scroll for the next 2 seconds
        this.preventAutoScrollUntil = Date.now() + 2000;
        console.log('[ChatScrollFix] Setting preventAutoScrollUntil flag for 2 seconds');

        // Calculate the new scroll position
        const newScrollHeight = this.chatContainer.scrollHeight;
        const heightDifference = newScrollHeight - this.savedScrollState.scrollHeight;
        
        console.log('[ChatScrollFix] Scroll restoration calculation:', {
            oldScrollHeight: this.savedScrollState.scrollHeight,
            newScrollHeight,
            heightDifference,
            oldScrollTop: this.savedScrollState.scrollTop
        });
        
        if (heightDifference > 0) {
            // New content was added at the top
            // Adjust scroll position to maintain visual position
            const newScrollTop = this.savedScrollState.scrollTop + heightDifference;
            
            console.log('[ChatScrollFix] Restoring scroll position to:', newScrollTop);
            this.isRestoringScroll = true;
            
            // Use multiple requestAnimationFrame calls to ensure DOM is fully updated
            // and to override any subsequent scroll-to-bottom calls
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (this.chatContainer) {
                        const beforeScroll = this.chatContainer.scrollTop;
                        this.chatContainer.scrollTop = newScrollTop;
                        const afterScroll = this.chatContainer.scrollTop;
                        console.log('[ChatScrollFix] Scroll position set:', {
                            target: newScrollTop,
                            before: beforeScroll,
                            after: afterScroll,
                            success: Math.abs(afterScroll - newScrollTop) < 10
                        });
                        
                        // Check multiple times to prevent auto-scroll
                        const checkAndRestore = (attempt: number) => {
                            if (attempt > 5) {
                                this.isRestoringScroll = false;
                                return;
                            }
                            
                            setTimeout(() => {
                                if (this.chatContainer && !this.wasAtBottom && this.preventAutoScrollUntil > Date.now()) {
                                    const currentScrollTop = this.chatContainer.scrollTop;
                                    const currentScrollHeight = this.chatContainer.scrollHeight;
                                    const currentClientHeight = this.chatContainer.clientHeight;
                                    const isAtBottom = currentScrollHeight - currentScrollTop - currentClientHeight < 50;
                                    
                                    console.log('[ChatScrollFix] Follow-up check (attempt ' + attempt + '):', {
                                        currentScrollTop,
                                        expectedScrollTop: newScrollTop,
                                        isAtBottom,
                                        wasAtBottom: this.wasAtBottom,
                                        preventAutoScrollActive: this.preventAutoScrollUntil > Date.now()
                                    });
                                    
                                    if (!isAtBottom && Math.abs(currentScrollTop - newScrollTop) > 50) {
                                        // Still not at bottom, restore position again
                                        console.log('[ChatScrollFix] Scroll was changed, restoring again (attempt ' + attempt + ')...');
                                        this.chatContainer.scrollTop = newScrollTop;
                                        checkAndRestore(attempt + 1);
                                    } else {
                                        this.isRestoringScroll = false;
                                    }
                                } else {
                                    this.isRestoringScroll = false;
                                }
                            }, 100 * attempt);
                        };
                        
                        checkAndRestore(1);
                    }
                });
            });
        } else {
            console.log('[ChatScrollFix] No height difference detected - no restoration needed');
            this.savedScrollState = null;
            this.preventAutoScrollUntil = 0;
        }

        // Don't clear savedScrollState immediately - keep it for the preventAutoScroll mechanism
        // It will be cleared after the preventAutoScroll period expires
        setTimeout(() => {
            this.savedScrollState = null;
            this.preventAutoScrollUntil = 0;
            console.log('[ChatScrollFix] Clearing saved scroll state and preventAutoScroll flag');
        }, 3000);
    }

    private setupHashChangeListener(): void {
        // Re-initialize when navigating to a different chat
        const handleHashChange = () => {
            console.log('[ChatScrollFix] Hash/popstate change detected, re-initializing...');
            setTimeout(() => {
                this.findChatContainer();
            }, 500);
        };

        window.addEventListener('hashchange', handleHashChange);
        console.log('[ChatScrollFix] Hash change listener set up');
        
        // Also listen for popstate (back/forward navigation)
        window.addEventListener('popstate', handleHashChange);
        console.log('[ChatScrollFix] Popstate listener set up');
    }
}

