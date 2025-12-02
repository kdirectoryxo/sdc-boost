import { BaseModule } from './BaseModule';
import type { ModuleConfigOption } from './types';

/**
 * Module to add a Chat button to the navbar that opens a Vue-based dialog
 * with a modern WhatsApp-like chat interface
 */
export class ChatDialogModule extends BaseModule {
    private chatButton: HTMLElement | null = null;

    constructor() {
        const configOptions: ModuleConfigOption[] = [];
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
    }

    async cleanup(): Promise<void> {
        this.removeChatButton();
        this.cleanupObserver();
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
        
        // Create ripple span
        const ripple = document.createElement('span');
        ripple.className = 'MuiTouchRipple-root css-w0pj6f';
        
        button.appendChild(icon);
        button.appendChild(ripple);

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
            }
        };

        // Observe the navbar container
        const navBar = document.querySelector('.nav-bar-right-buttons') || document.body;
        this.setupObserver(navBar, handleMutations, {
            childList: true,
            subtree: true,
        });
    }
}

