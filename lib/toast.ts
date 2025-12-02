/**
 * Custom Toast Notification System
 * Simple sonner-like notification system for displaying success/error messages
 */

export type ToastType = 'success' | 'error';

export interface ToastOptions {
    duration?: number; // Auto-dismiss duration in ms (default: 3000)
}

class Toast {
    private container: HTMLElement | null = null;
    private toasts: Map<string, HTMLElement> = new Map();
    private toastIdCounter = 0;

    constructor() {
        this.init();
    }

    private init(): void {
        // Create toast container
        this.container = document.createElement('div');
        this.container.id = 'sdc-boost-toast-container';
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        `;

        // Inject into page
        document.body.appendChild(this.container);
    }

    /**
     * Show a success toast
     */
    success(message: string, options?: ToastOptions): void {
        this.show('success', message, options);
    }

    /**
     * Show an error toast
     */
    error(message: string, options?: ToastOptions): void {
        this.show('error', message, options);
    }

    /**
     * Show a toast notification
     */
    private show(type: ToastType, message: string, options?: ToastOptions): void {
        if (!this.container) {
            this.init();
        }

        const toastId = `toast-${++this.toastIdCounter}`;
        const duration = options?.duration ?? 3000;

        // Create toast element
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');

        // Base styles
        const baseStyles = `
            background-color: #1a1a1a;
            color: #e0e0e0;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            min-width: 300px;
            max-width: 400px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            pointer-events: auto;
            border: 1px solid #333;
            opacity: 0;
            transform: translateX(100%);
            transition: opacity 0.3s ease, transform 0.3s ease;
        `;

        // Type-specific styles
        const typeStyles = type === 'success' 
            ? `border-left: 3px solid #10b981;` // Green accent
            : `border-left: 3px solid #ef4444;`; // Red accent

        toast.style.cssText = baseStyles + typeStyles;

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            flex: 1;
            font-size: 14px;
            line-height: 1.5;
            word-wrap: break-word;
        `;
        messageEl.textContent = message;

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.setAttribute('aria-label', 'Close notification');
        closeButton.style.cssText = `
            background: none;
            border: none;
            color: #999;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: color 0.2s ease, background-color 0.2s ease;
            flex-shrink: 0;
            width: 20px;
            height: 20px;
        `;
        closeButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;

        // Close button hover effect
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.color = '#e0e0e0';
            closeButton.style.backgroundColor = '#333';
        });
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.color = '#999';
            closeButton.style.backgroundColor = 'transparent';
        });

        // Close handler
        const close = () => {
            this.dismiss(toastId);
        };
        closeButton.addEventListener('click', close);

        // Assemble toast
        toast.appendChild(messageEl);
        toast.appendChild(closeButton);

        // Add to container
        this.container!.appendChild(toast);
        this.toasts.set(toastId, toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

        // Auto-dismiss
        if (duration > 0) {
            const timeoutId = setTimeout(() => {
                this.dismiss(toastId);
            }, duration);

            // Store timeout ID on toast element for potential cancellation
            (toast as any).__timeoutId = timeoutId;
        }
    }

    /**
     * Dismiss a toast
     */
    private dismiss(toastId: string): void {
        const toast = this.toasts.get(toastId);
        if (!toast) return;

        // Clear timeout if exists
        if ((toast as any).__timeoutId) {
            clearTimeout((toast as any).__timeoutId);
        }

        // Animate out
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';

        // Remove from DOM after animation
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts.delete(toastId);
        }, 300);
    }

    /**
     * Dismiss all toasts
     */
    dismissAll(): void {
        const toastIds = Array.from(this.toasts.keys());
        toastIds.forEach(id => this.dismiss(id));
    }

    /**
     * Cleanup - remove container from DOM
     */
    destroy(): void {
        this.dismissAll();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.toasts.clear();
    }
}

// Export singleton instance
export const toast = new Toast();


