/**
 * Custom Confirm Dialog System
 * Simple confirmation dialog with Promise and callback APIs
 */

export interface ConfirmOptions {
    confirmText?: string; // Text for confirm button (default: "Yes")
    cancelText?: string; // Text for cancel button (default: "No")
    content?: string; // Optional HTML content to display
}

class Confirm {
    private overlay: HTMLElement | null = null;
    private dialog: HTMLElement | null = null;
    private isOpen: boolean = false;
    private resolveCallback: ((value: boolean) => void) | null = null;
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private originalBodyOverflow: string = '';

    constructor() {
        // Initialize on first use
    }

    /**
     * Show confirm dialog (Promise-based)
     */
    confirm(message: string, options?: ConfirmOptions): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this.resolveCallback = resolve;
            this.show(message, options);
        });
    }

    /**
     * Show confirm dialog (Callback-based)
     */
    confirmCallback(
        message: string,
        callback: (confirmed: boolean) => void,
        options?: ConfirmOptions
    ): void {
        this.resolveCallback = (confirmed: boolean) => {
            callback(confirmed);
        };
        this.show(message, options);
    }

    /**
     * Show the confirm dialog
     */
    private show(message: string, options?: ConfirmOptions): void {
        if (this.isOpen) {
            // If already open, close previous one first
            this.close(false);
        }

        const confirmText = options?.confirmText ?? 'Yes';
        const cancelText = options?.cancelText ?? 'No';
        const content = options?.content;

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'sdc-boost-confirm-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        `;

        // Create dialog
        this.dialog = document.createElement('div');
        this.dialog.id = 'sdc-boost-confirm-dialog';
        this.dialog.setAttribute('role', 'dialog');
        this.dialog.setAttribute('aria-modal', 'true');
        this.dialog.setAttribute('aria-labelledby', 'sdc-boost-confirm-title');
        this.dialog.style.cssText = `
            background-color: #1a1a1a;
            color: #e0e0e0;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            min-width: 320px;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
            border: 1px solid #333;
            transform: scale(0.95);
            transition: transform 0.2s ease;
        `;

        // Create dialog content
        const dialogContent = document.createElement('div');
        dialogContent.style.cssText = `
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        `;

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.id = 'sdc-boost-confirm-title';
        messageEl.style.cssText = `
            font-size: 16px;
            line-height: 1.5;
            font-weight: 500;
            color: #e0e0e0;
            word-wrap: break-word;
        `;
        messageEl.textContent = message;

        // Create content slot (optional)
        let contentEl: HTMLElement | null = null;
        if (content) {
            contentEl = document.createElement('div');
            contentEl.style.cssText = `
                font-size: 14px;
                line-height: 1.5;
                color: #b0b0b0;
                word-wrap: break-word;
            `;
            contentEl.innerHTML = content;
        }

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 4px;
        `;

        // Create cancel button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = cancelText;
        cancelButton.style.cssText = `
            background-color: #2a2a2a;
            color: #e0e0e0;
            border: 1px solid #333;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s ease, border-color 0.2s ease;
            flex: 0 0 auto;
        `;
        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.backgroundColor = '#333';
            cancelButton.style.borderColor = '#444';
        });
        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.backgroundColor = '#2a2a2a';
            cancelButton.style.borderColor = '#333';
        });
        cancelButton.addEventListener('click', () => {
            this.close(false);
        });

        // Create confirm button
        const confirmButton = document.createElement('button');
        confirmButton.textContent = confirmText;
        confirmButton.style.cssText = `
            background-color: #10b981;
            color: white;
            border: 1px solid #10b981;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s ease, border-color 0.2s ease;
            flex: 0 0 auto;
        `;
        confirmButton.addEventListener('mouseenter', () => {
            confirmButton.style.backgroundColor = '#059669';
            confirmButton.style.borderColor = '#059669';
        });
        confirmButton.addEventListener('mouseleave', () => {
            confirmButton.style.backgroundColor = '#10b981';
            confirmButton.style.borderColor = '#10b981';
        });
        confirmButton.addEventListener('click', () => {
            this.close(true);
        });

        // Assemble dialog
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);

        dialogContent.appendChild(messageEl);
        if (contentEl) {
            dialogContent.appendChild(contentEl);
        }
        dialogContent.appendChild(buttonContainer);

        this.dialog.appendChild(dialogContent);
        this.overlay.appendChild(this.dialog);

        // Add to body
        document.body.appendChild(this.overlay);

        // Prevent body scroll
        this.originalBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Setup keyboard handlers
        this.setupKeyboardHandlers();

        // Trigger animation
        requestAnimationFrame(() => {
            if (this.overlay) {
                this.overlay.style.opacity = '1';
            }
            if (this.dialog) {
                this.dialog.style.transform = 'scale(1)';
            }
        });

        // Focus confirm button for keyboard navigation
        requestAnimationFrame(() => {
            confirmButton.focus();
        });

        this.isOpen = true;
    }

    /**
     * Setup keyboard event handlers
     */
    private setupKeyboardHandlers(): void {
        this.keydownHandler = (e: KeyboardEvent) => {
            if (!this.isOpen) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                this.close(false);
            } else if (e.key === 'Enter' && e.target === this.dialog || 
                       (e.key === 'Enter' && (e.target as HTMLElement)?.closest('#sdc-boost-confirm-dialog'))) {
                // Enter key confirms if focus is on dialog
                const activeElement = document.activeElement;
                if (activeElement && this.dialog?.contains(activeElement)) {
                    // Only if not on a button (let button handle it)
                    if (activeElement.tagName !== 'BUTTON') {
                        e.preventDefault();
                        this.close(true);
                    }
                }
            }
        };

        document.addEventListener('keydown', this.keydownHandler);
    }

    /**
     * Close the confirm dialog
     */
    private close(confirmed: boolean): void {
        if (!this.isOpen) return;

        // Animate out
        if (this.overlay) {
            this.overlay.style.opacity = '0';
        }
        if (this.dialog) {
            this.dialog.style.transform = 'scale(0.95)';
        }

        // Remove from DOM after animation
        setTimeout(() => {
            if (this.overlay && this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
            this.overlay = null;
            this.dialog = null;
            this.isOpen = false;

            // Restore body scroll
            document.body.style.overflow = this.originalBodyOverflow;

            // Remove keyboard handlers
            if (this.keydownHandler) {
                document.removeEventListener('keydown', this.keydownHandler);
                this.keydownHandler = null;
            }

            // Resolve promise/callback
            if (this.resolveCallback) {
                this.resolveCallback(confirmed);
                this.resolveCallback = null;
            }
        }, 200);
    }

    /**
     * Cleanup - remove dialog if open
     */
    destroy(): void {
        if (this.isOpen) {
            this.close(false);
        }
    }
}

// Export singleton instance
export const confirm = new Confirm();

