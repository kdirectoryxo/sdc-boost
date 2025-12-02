import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';
import { generateNoteSummary } from '@/lib/ai';
import { getAIApiKey, setModuleConfig } from '@/lib/storage';
import { getCurrentMuid, getTargetDBId, getCurrentNote, noteContainsSummary, getNoteBeforeSummary } from '@/lib/sdc-api';
import { navigationWatcher } from './utils/NavigationWatcher';

// Get toast and confirm from global window object
const getToast = () => (window as any).__sdcBoostToast;
const getConfirm = () => (window as any).__sdcBoostConfirm;

/**
 * Module to export chat messages to markdown format
 * Adds a button to the chat page that scrolls to top, loads all messages,
 * and copies them to clipboard in a format AI agents can understand
 */
export class ChatExportModule extends BaseModule {
    private exportButton: HTMLElement | null = null;
    private chatContainer: HTMLElement | null = null;
    private headerContainer: HTMLElement | null = null;
    private isExporting: boolean = false;
    private unsubscribeNavigation: (() => void) | null = null;

    constructor() {
        const configOptions: ModuleConfigOption[] = [];
        super(
            'chat-export',
            'Chat Export',
            'Export all chat messages to markdown format and copy to clipboard',
            'Chat',
            configOptions
        );
    }

    async init(): Promise<void> {
        console.log('[ChatExport] Module init() called');
        this.findChatElements();

        // Watch for navigation changes and DOM changes
        this.setupHashChangeListener();
        this.setupDOMObserver();
    }

    async cleanup(): Promise<void> {
        if (this.exportButton) {
            this.exportButton.remove();
            this.exportButton = null;
        }
        this.cleanupObserver();
        if (this.unsubscribeNavigation) {
            this.unsubscribeNavigation();
            this.unsubscribeNavigation = null;
        }
        this.chatContainer = null;
        this.headerContainer = null;
    }

    private findChatElements(): void {
        console.log('[ChatExport] Searching for chat elements...');

        // Find chat container
        const chatContent = document.querySelector('#chat-content') as HTMLElement;
        const headerContainer = document.querySelector('#header-container') as HTMLElement;

        // Check if chat is open (both elements must exist)
        if (chatContent && headerContainer) {
            // Chat is open
            if (!this.chatContainer || !this.headerContainer) {
                // Chat was just opened, add button
                this.chatContainer = chatContent;
                this.headerContainer = headerContainer;
                console.log('[ChatExport] Chat opened, adding export button');
                this.addExportButton();
            } else {
                // Chat is still open, just update references
                this.chatContainer = chatContent;
                this.headerContainer = headerContainer;
            }
        } else {
            // Chat is not open, remove button if it exists
            if (this.exportButton) {
                console.log('[ChatExport] Chat closed, removing export button');
                this.exportButton.remove();
                this.exportButton = null;
            }
            this.chatContainer = null;
            this.headerContainer = null;
        }
    }

    private addExportButton(): void {
        if (!this.headerContainer || this.exportButton) {
            return;
        }

        // Create export button as a div (like other icon buttons)
        const button = document.createElement('div');
        button.style.cssText = 'cursor: pointer;';
        button.setAttribute('title', 'Export Chat');

        // Create SVG icon matching Material-UI style with white circle background
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'MuiSvgIcon-root MuiSvgIcon-fontSizeMedium');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.style.cssText = `
            user-select: none;
            width: 1em;
            height: 1em;
            display: inline-block;
            fill: currentcolor;
            flex-shrink: 0;
            font-size: 1.5rem;
            margin-right: 2px;
            color: black;
            background-color: white;
            cursor: pointer;
            transition: fill 200ms cubic-bezier(0.4, 0, 0.2, 1);
            padding: 2px;
            border-radius: 50%;
        `;

        // Create the download icon path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z');
        svg.appendChild(path);

        button.appendChild(svg);
        button.addEventListener('click', () => this.handleExportClick());

        // Find the header actions area (where other buttons are)
        const headerActions = this.headerContainer.querySelector('.d-flex.align-items-center.pl-2.pr-2.pb-1');
        if (headerActions) {
            // Find the last div (more button) and insert before it
            const lastDiv = headerActions.querySelector('div:last-child');
            if (lastDiv && lastDiv.parentElement) {
                lastDiv.parentElement.insertBefore(button, lastDiv);
            } else {
                headerActions.appendChild(button);
            }
            this.exportButton = button;
            console.log('[ChatExport] Export button added to header');
        } else {
            // Fallback: try to find any div with action buttons
            const fallbackContainer = this.headerContainer.querySelector('.d-flex.align-items-center');
            if (fallbackContainer) {
                const lastDiv = fallbackContainer.querySelector('div:last-child');
                if (lastDiv && lastDiv.parentElement) {
                    lastDiv.parentElement.insertBefore(button, lastDiv);
                } else {
                    fallbackContainer.appendChild(button);
                }
                this.exportButton = button;
                console.log('[ChatExport] Export button added to fallback container');
            } else {
                // Last resort: add to header container directly
                this.headerContainer.appendChild(button);
                this.exportButton = button;
                console.log('[ChatExport] Export button added to header container');
            }
        }
    }

    private async handleExportClick(): Promise<void> {
        if (this.isExporting) {
            console.log('[ChatExport] Export already in progress');
            return;
        }

        if (!this.chatContainer) {
            console.error('[ChatExport] Chat container not found');
            return;
        }

        this.isExporting = true;
        if (this.exportButton) {
            this.exportButton.style.opacity = '0.6';
            this.exportButton.style.cursor = 'not-allowed';
            this.exportButton.setAttribute('title', 'Exporting...');

            // Update SVG to show loading spinner
            const svg = this.exportButton.querySelector('svg');
            if (svg) {
                svg.innerHTML = `
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                        <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite"/>
                        <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite"/>
                    </circle>
                `;
            }
        }

        try {
            // Get account name from header
            const accountNameElement = document.querySelector('.account-name');
            const accountName = accountNameElement?.textContent?.trim() || 'Unknown';

            // Scroll to top and load all messages
            await this.loadAllMessages();

            // Extract all messages
            const messages = this.extractMessages();

            // Format as markdown
            const markdown = this.formatAsMarkdown(messages, accountName);

            // Copy to clipboard
            await this.copyToClipboard(markdown);

            // Handle AI save as note if enabled
            let aiSaveAsNote = this.getConfigValue('aiSaveAsNote') === true;
            if (aiSaveAsNote) {
                try {
                    const apiKey = await getAIApiKey();
                    if (!apiKey || !apiKey.trim()) {
                        console.warn('[ChatExport] AI save as note enabled but no API key configured. Disabling feature.');
                        // Automatically disable the feature if no API key
                        this.updateConfig({ aiSaveAsNote: false });
                        await setModuleConfig(this.id, this.getConfig());
                        aiSaveAsNote = false;

                        // Show error toast
                        const toast = getToast();
                        if (toast) {
                            toast.error('AI API key not configured. Please set it in Settings.');
                        }

                        // Show error to user
                        if (this.exportButton) {
                            this.exportButton.setAttribute('title', 'AI note: API key not configured. Please set it in Settings.');
                            setTimeout(() => {
                                if (this.exportButton) {
                                    this.exportButton.setAttribute('title', 'Export Chat');
                                }
                            }, 5000);
                        }
                    } else {
                        // Show AI loading indicator
                        if (this.exportButton) {
                            this.exportButton.setAttribute('title', 'Generating AI summary...');
                            const svg = this.exportButton.querySelector('svg');
                            if (svg) {
                                svg.innerHTML = `
                                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                                        <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite"/>
                                        <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite"/>
                                    </circle>
                                `;
                            }
                        }

                        // Generate AI summary (with loading indicator visible)
                        const aiSummaryRaw = await generateNoteSummary(markdown, accountName);

                        // Decode HTML entities immediately (e.g., &#39; -> ')
                        const aiSummary = this.decodeHtmlEntities(aiSummaryRaw);

                        // Restore button icon after AI generation
                        if (this.exportButton) {
                            const svg = this.exportButton.querySelector('svg');
                            if (svg) {
                                svg.innerHTML = '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path>';
                            }
                        }

                        // Check if confirmation is required
                        const autoSaveConfirm = this.getConfigValue('autoSaveConfirm') !== false;
                        let shouldSave = true;

                        if (autoSaveConfirm) {
                            const confirmDialog = getConfirm();
                            if (confirmDialog) {
                                // Escape HTML for safe display (but preserve apostrophes as regular characters)
                                const escapedSummary = this.escapeHtmlForDisplay(aiSummary);

                                shouldSave = await confirmDialog.confirm(
                                    `AI-generated summary for ${accountName}:`,
                                    {
                                        confirmText: 'Save',
                                        cancelText: 'Cancel',
                                        content: `<div style="margin-top: 12px; padding: 12px; background-color: #242424; border-radius: 6px; border-left: 3px solid #10b981;">
                                            <p style="margin: 0; white-space: pre-wrap; line-height: 1.6;">${escapedSummary}</p>
                                        </div>`
                                    }
                                );
                            } else {
                                // Fallback to native confirm if custom dialog not available
                                shouldSave = confirm(`AI-generated summary for ${accountName}:\n\n${aiSummary}\n\nDo you want to save this as a note?`);
                            }
                        }

                        if (shouldSave) {
                            // Show saving indicator
                            if (this.exportButton) {
                                this.exportButton.setAttribute('title', 'Saving note...');
                                const svg = this.exportButton.querySelector('svg');
                                if (svg) {
                                    svg.innerHTML = `
                                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                                            <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite"/>
                                            <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite"/>
                                        </circle>
                                    `;
                                }
                            }

                            try {
                                await this.saveAsNote(aiSummary, accountName);
                                console.log('[ChatExport] AI-generated note saved');

                                // Show success toast
                                const toast = getToast();
                                if (toast) {
                                    toast.success(`Note saved for ${accountName}`);
                                }

                                // Show success indicator on button
                                if (this.exportButton) {
                                    this.exportButton.setAttribute('title', 'Note saved!');
                                    const svg = this.exportButton.querySelector('svg');
                                    if (svg) {
                                        svg.innerHTML = '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>';
                                        setTimeout(() => {
                                            if (this.exportButton && svg) {
                                                svg.innerHTML = '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path>';
                                                this.exportButton.setAttribute('title', 'Export Chat');
                                            }
                                        }, 2000);
                                    }
                                }
                            } catch (saveError) {
                                console.error('[ChatExport] Failed to save note:', saveError);

                                // Show error toast
                                const toast = getToast();
                                if (toast) {
                                    const errorMessage = saveError instanceof Error
                                        ? saveError.message
                                        : 'Failed to save note';
                                    toast.error(`Failed to save note: ${errorMessage}`);
                                }

                                // Show error indicator on button
                                if (this.exportButton) {
                                    this.exportButton.setAttribute('title', 'Failed to save note');
                                    const svg = this.exportButton.querySelector('svg');
                                    if (svg) {
                                        svg.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>';
                                        setTimeout(() => {
                                            if (this.exportButton && svg) {
                                                svg.innerHTML = '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path>';
                                                this.exportButton.setAttribute('title', 'Export Chat');
                                            }
                                        }, 3000);
                                    }
                                }
                            }
                        } else {
                            console.log('[ChatExport] User cancelled AI note save');
                            // Restore button to normal state
                            if (this.exportButton) {
                                this.exportButton.setAttribute('title', 'Export Chat');
                                const svg = this.exportButton.querySelector('svg');
                                if (svg) {
                                    svg.innerHTML = '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path>';
                                }
                            }
                        }
                    }
                } catch (aiError) {
                    console.error('[ChatExport] Failed to generate/save AI note:', aiError);

                    // Show error toast
                    const toast = getToast();
                    if (toast) {
                        const errorMessage = aiError instanceof Error
                            ? aiError.message
                            : 'Unknown error occurred';
                        toast.error(`AI note failed: ${errorMessage}`);
                    }

                    // Show error but don't fail the whole export
                    if (this.exportButton) {
                        this.exportButton.setAttribute('title', `AI note error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`);
                        const svg = this.exportButton.querySelector('svg');
                        if (svg) {
                            svg.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>';
                            setTimeout(() => {
                                if (this.exportButton && svg) {
                                    svg.innerHTML = '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path>';
                                    this.exportButton.setAttribute('title', 'Export Chat');
                                }
                            }, 3000);
                        }
                    }
                }
            }

            // Show success feedback (only if AI wasn't enabled, as it has its own feedback)
            if (!aiSaveAsNote && this.exportButton) {
                this.exportButton.setAttribute('title', 'Copied to clipboard!');
                const svg = this.exportButton.querySelector('svg');
                if (svg) {
                    const originalPath = svg.querySelector('path')?.getAttribute('d') || 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z';
                    svg.innerHTML = '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>';
                    setTimeout(() => {
                        if (this.exportButton && svg) {
                            svg.innerHTML = `<path d="${originalPath}"></path>`;
                            this.exportButton.setAttribute('title', 'Export Chat');
                        }
                    }, 2000);
                }
            } else if (!aiSaveAsNote) {
                // If button was removed or something, at least restore it
                if (this.exportButton) {
                    const svg = this.exportButton.querySelector('svg');
                    if (svg && !svg.querySelector('path[d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"]')) {
                        svg.innerHTML = '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path>';
                        this.exportButton.setAttribute('title', 'Export Chat');
                    }
                }
            }
        } catch (error) {
            console.error('[ChatExport] Export failed:', error);
            if (this.exportButton) {
                this.exportButton.setAttribute('title', 'Export failed');
                const svg = this.exportButton.querySelector('svg');
                if (svg) {
                    svg.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>';
                    setTimeout(() => {
                        if (this.exportButton && svg) {
                            svg.innerHTML = '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path>';
                            this.exportButton.setAttribute('title', 'Export Chat');
                        }
                    }, 2000);
                }
            }
        } finally {
            this.isExporting = false;
            if (this.exportButton) {
                this.exportButton.style.opacity = '1';
                this.exportButton.style.cursor = 'pointer';
            }
        }
    }

    private async loadAllMessages(): Promise<void> {
        if (!this.chatContainer) return;

        console.log('[ChatExport] Starting to load all messages...');
        let previousMessageCount = 0;
        let currentMessageCount = this.countMessages();
        let scrollAttempts = 0;
        const maxScrollAttempts = 100; // Prevent infinite loops

        // Scroll to top
        this.chatContainer.scrollTop = 0;
        await this.waitForScroll();

        // Keep scrolling up until no more messages load
        while (scrollAttempts < maxScrollAttempts) {
            previousMessageCount = currentMessageCount;

            // Scroll to top
            this.chatContainer.scrollTop = 0;
            await this.waitForScroll();

            // Wait a bit for new messages to load
            await this.sleep(500);

            // Check if new messages were loaded
            currentMessageCount = this.countMessages();

            if (currentMessageCount === previousMessageCount) {
                // No new messages loaded, we're done
                console.log('[ChatExport] No more messages to load');
                break;
            }

            console.log(`[ChatExport] Loaded more messages: ${previousMessageCount} -> ${currentMessageCount}`);
            scrollAttempts++;
        }

        if (scrollAttempts >= maxScrollAttempts) {
            console.warn('[ChatExport] Reached max scroll attempts, stopping');
        }

        // Final scroll to top to ensure we have all messages
        this.chatContainer.scrollTop = 0;
        await this.waitForScroll();
        await this.sleep(500);
    }

    private countMessages(): number {
        if (!this.chatContainer) return 0;
        const bubbles = this.chatContainer.querySelectorAll('.bubbleleft_v2, .bubbleright_v2');
        return bubbles.length;
    }

    private waitForScroll(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.chatContainer) {
                resolve();
                return;
            }

            let lastScrollTop = this.chatContainer.scrollTop;
            const checkInterval = setInterval(() => {
                const currentScrollTop = this.chatContainer?.scrollTop || 0;
                if (currentScrollTop === lastScrollTop && currentScrollTop === 0) {
                    clearInterval(checkInterval);
                    resolve();
                }
                lastScrollTop = currentScrollTop;
            }, 50);

            // Timeout after 2 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 2000);
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private decodeHtmlEntities(text: string): string {
        // Create a temporary textarea element to decode HTML entities
        // (as a safety measure, even though AI should return plain text)
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    private escapeHtmlForDisplay(text: string): string {
        // Simple HTML escaping for safe display (prevent XSS)
        return text
            .replace(/&/g, '&amp;')  // Must be first
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    private extractMessages(): Array<{
        sender: 'me' | 'other';
        text: string;
        timestamp: string;
        hasImage: boolean;
        imageUrl?: string;
    }> {
        if (!this.chatContainer) return [];

        const messages: Array<{
            sender: 'me' | 'other';
            text: string;
            timestamp: string;
            hasImage: boolean;
            imageUrl?: string;
        }> = [];

        // Get all message containers (pl-2 for left, pr-2 for right)
        const messageContainers = this.chatContainer.querySelectorAll('.pl-2, .pr-2');

        messageContainers.forEach((container) => {
            const isRight = container.classList.contains('pr-2');
            const sender: 'me' | 'other' = isRight ? 'me' : 'other';

            // Find the bubble
            const bubble = container.querySelector('.bubbleleft_v2, .bubbleright_v2');
            if (!bubble) return;

            // Extract text content - try multiple methods
            let text = '';

            // Method 1: Look for element with word-break style
            const textElement = bubble.querySelector('[style*="word-break: break-word"]');
            if (textElement) {
                text = textElement.textContent?.trim() || '';
            }

            // Method 2: If no text found, try to get text from the bubble directly
            if (!text) {
                // Clone the bubble to remove images and other elements
                const clone = bubble.cloneNode(true) as HTMLElement;
                // Remove images
                clone.querySelectorAll('img').forEach(img => img.remove());
                // Remove timestamp
                clone.querySelectorAll('small').forEach(small => small.remove());
                // Get remaining text
                text = clone.textContent?.trim() || '';
            }

            // Extract timestamp
            const timestampElement = bubble.querySelector('small');
            const timestamp = timestampElement?.textContent?.trim() || '';

            // Check for images (excluding hidden images)
            const imageElements = bubble.querySelectorAll('img:not(.hidden)');
            let hasImage = false;
            let imageUrl: string | undefined = undefined;

            for (const img of Array.from(imageElements)) {
                const imgElement = img as HTMLImageElement;
                const src = imgElement.getAttribute('src');
                // Skip empty or data URLs that are placeholders
                if (src && src !== '' && !src.startsWith('data:image/svg+xml')) {
                    // Check if it's a real image (not an icon)
                    const isIcon = imgElement.width && imgElement.width <= 30 && imgElement.height && imgElement.height <= 30;
                    if (!isIcon) {
                        hasImage = true;
                        imageUrl = src;
                        break; // Take the first real image
                    }
                }
            }

            // Only add if there's text or an image
            if (text || hasImage) {
                messages.push({
                    sender,
                    text,
                    timestamp,
                    hasImage,
                    imageUrl,
                });
            }
        });

        console.log(`[ChatExport] Extracted ${messages.length} messages`);
        return messages;
    }

    private formatAsMarkdown(
        messages: Array<{
            sender: 'me' | 'other';
            text: string;
            timestamp: string;
            hasImage: boolean;
            imageUrl?: string;
        }>,
        accountName: string
    ): string {
        // Get user's own name (try to find it from the page)
        let myName = 'You';
        try {
            // Try to find the user's profile name or account info
            const userProfileElements = document.querySelectorAll('.account-name');
            // The first one might be the other person, but we can try to find "me" messages
            // For now, we'll use "You" as it's clearer
        } catch (e) {
            // Keep default
        }

        let markdown = '';

        // Add title if not hidden
        const hideTitle = this.getConfigValue('hideTitle') === true;
        if (!hideTitle) {
            markdown += `Chat with: ${accountName}\n`;
        }

        // Add total messages if not hidden
        const hideTotalMessages = this.getConfigValue('hideTotalMessages') === true;
        if (!hideTotalMessages) {
            markdown += `Total messages: ${messages.length}\n`;
        }

        if (!hideTitle || !hideTotalMessages) {
            markdown += `\n---\n\n`;
        }

        // Simple format: name: message
        messages.forEach((message) => {
            const senderLabel = message.sender === 'me' ? myName : accountName;

            if (message.hasImage && message.imageUrl) {
                markdown += `${senderLabel}: [Image: ${message.imageUrl}]\n`;
            }

            if (message.text) {
                markdown += `${senderLabel}: ${message.text}\n`;
            }

            markdown += `\n`;
        });

        return markdown;
    }

    private async copyToClipboard(text: string): Promise<void> {
        try {
            // Use the Clipboard API if available
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                console.log('[ChatExport] Text copied to clipboard');
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
                console.log('[ChatExport] Text copied to clipboard (fallback method)');
            }
        } catch (error) {
            console.error('[ChatExport] Failed to copy to clipboard:', error);
            throw error;
        }
    }


    private async saveAsNote(noteContent: string, accountName: string): Promise<void> {
        const targetDBId = getTargetDBId();
        if (!targetDBId) {
            throw new Error('Could not determine TargetDB_ID');
        }

        const muid = getCurrentMuid();
        const apiUrl = muid
            ? `https://api.sdc.com/v1/note_add?muid=${muid}`
            : 'https://api.sdc.com/v1/note_add';

        // Format the summary with separators
        const formattedSummary = `--------\r\nSamenvatting:\r\n${noteContent}\r\n--------`;

        // Get current note to check if it contains a summary section
        let finalNoteContent = formattedSummary;
        try {
            const currentNote = await getCurrentNote(targetDBId, muid);
            if (currentNote && noteContainsSummary(currentNote)) {
                // Note already has a summary, replace it
                const noteBeforeSummary = getNoteBeforeSummary(currentNote);
                if (noteBeforeSummary) {
                    finalNoteContent = `${noteBeforeSummary}\r\n\r\n${formattedSummary}`;
                } else {
                    finalNoteContent = formattedSummary;
                }
                console.log('[ChatExport] Replacing existing summary in note');
            } else if (currentNote) {
                // Note exists but no summary, append it
                finalNoteContent = `${currentNote}\r\n\r\n${formattedSummary}`;
                console.log('[ChatExport] Appending summary to existing note');
            } else {
                // No note exists, create new one with summary
                finalNoteContent = formattedSummary;
                console.log('[ChatExport] Creating new note with summary');
            }
        } catch (error) {
            console.warn('[ChatExport] Could not fetch current note, creating new one:', error);
            // If we can't get current note, just use the new content with summary format
            finalNoteContent = formattedSummary;
        }

        // Create form data
        const formData = new FormData();
        formData.append('TargetDB_ID', targetDBId);
        formData.append('Notes', finalNoteContent);
        formData.append('client_token', '0');

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
                credentials: 'include', // Include cookies for authentication
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('[ChatExport] Note saved successfully:', result);
        } catch (error) {
            console.error('[ChatExport] Failed to save note:', error);
            throw error;
        }
    }

    private setupHashChangeListener(): void {
        // Re-initialize when navigating to a different chat
        const handleNavigation = () => {
            console.log('[ChatExport] Navigation detected, re-initializing...');
            // Remove button first
            if (this.exportButton) {
                this.exportButton.remove();
                this.exportButton = null;
            }
            // Wait a bit for DOM to update, then check again
            setTimeout(() => {
                this.findChatElements();
            }, 500);
        };

        // Subscribe to navigation events using shared watcher
        this.unsubscribeNavigation = navigationWatcher.onNavigation(handleNavigation);
        console.log('[ChatExport] Navigation listener set up');
    }

    private setupDOMObserver(): void {
        // Watch for when chat elements appear/disappear
        const observer = new MutationObserver((mutations) => {
            // Check if chat elements appeared or disappeared
            const chatContent = document.querySelector('#chat-content');
            const headerContainer = document.querySelector('#header-container');

            const chatIsOpen = !!(chatContent && headerContainer);
            const hadButton = !!this.exportButton;

            // If state changed, update
            if (chatIsOpen && !hadButton) {
                // Chat just opened
                this.findChatElements();
            } else if (!chatIsOpen && hadButton) {
                // Chat just closed
                this.findChatElements();
            }
        });

        // Observe the document body for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        console.log('[ChatExport] DOM observer set up');
    }
}

