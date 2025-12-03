import type { ModuleDefinition } from './types';

/**
 * Centralized module definitions
 * This is the single source of truth for all available modules
 */
export const moduleDefinitions: ModuleDefinition[] = [
    {
        id: 'age-filter',
        name: 'Age Filter',
        description: 'Hide member cards based on age range.',
        category: 'Filtering',
        configOptions: [
            {
                key: 'minAge',
                label: 'Minimum Age',
                description: 'Show cards at or above this age (hide cards below)',
                type: 'number',
                default: 20,
                min: 18,
                max: 100,
                step: 1,
            },
            {
                key: 'maxAge',
                label: 'Maximum Age',
                description: 'Show cards at or below this age (hide cards above)',
                type: 'number',
                default: 40,
                min: 18,
                max: 100,
                step: 1,
            },
        ],
    },
    {
        id: 'age-highlighter',
        name: 'Age Highlighter',
        description: 'Highlight member cards based on age range.',
        category: 'Filtering',
        configOptions: [
            {
                key: 'minAge',
                label: 'Minimum Age',
                description: 'Highlight cards at or above this age (within range)',
                type: 'number',
                default: 20,
                min: 18,
                max: 100,
                step: 1,
            },
            {
                key: 'maxAge',
                label: 'Maximum Age',
                description: 'Highlight cards at or below this age (within range)',
                type: 'number',
                default: 30,
                min: 18,
                max: 100,
                step: 1,
            },
            {
                key: 'highlightColor',
                label: 'Highlight Color',
                description: 'Color used to highlight cards',
                type: 'color',
                default: '#22c55e',
            },
        ],
    },
    {
        id: 'ad-block',
        name: 'Ad Blocker',
        description: 'Block and hide advertisements on the SDC website.',
        category: 'Content',
        configOptions: [
            {
                key: 'blockMemberCardAds',
                label: 'Block Member Card Ads',
                description: 'Remove advertisement blocks from member card listings',
                type: 'boolean',
                default: true,
            },
        ],
    },
    {
        id: 'chat-export',
        name: 'Chat Export',
        description: 'Export all chat messages to markdown format and copy to clipboard.',
        category: 'Chat',
        configOptions: [
            {
                key: 'hideTitle',
                label: 'Hide Title',
                description: 'Hide the "Chat with:" title in exported chat',
                type: 'boolean',
                default: false,
            },
            {
                key: 'hideTotalMessages',
                label: 'Hide Total Messages',
                description: 'Hide the total messages count in exported chat',
                type: 'boolean',
                default: false,
            },
            {
                key: 'aiSaveAsNote',
                label: 'AI Save as Note',
                description: 'Use AI to generate a summary and save it as a note (requires API key in settings)',
                type: 'boolean',
                default: true,
            },
            {
                key: 'autoSaveConfirm',
                label: 'Confirm Before Saving',
                description: 'Show confirmation dialog before saving AI-generated note',
                type: 'boolean',
                default: true,
                dependsOn: {
                    key: 'aiSaveAsNote',
                    value: true,
                },
            },
        ],
    },
    {
        id: 'navbar-boost-button',
        name: 'Navbar Boost Button',
        description: 'Adds a Boost button to the navbar next to Messenger to open the boost dialog.',
        category: 'UI',
        configOptions: [],
    },
    {
        id: 'enhanced-click',
        name: 'Enhanced Click',
        description: 'Enhance click functionality on member cards and chat. Make images and names clickable with right-click support.',
        category: 'UI',
        configOptions: [
            {
                key: 'enableCardImage',
                label: 'Enable Card Image Click',
                description: 'Make card images clickable to open profile',
                type: 'boolean',
                default: true,
            },
            {
                key: 'enableCardName',
                label: 'Enable Card Name Click',
                description: 'Make card names clickable to open profile',
                type: 'boolean',
                default: true,
            },
            {
                key: 'enableChatHeaderImage',
                label: 'Enable Chat Header Image Click',
                description: 'Make chat header images clickable to open profile',
                type: 'boolean',
                default: true,
            },
            {
                key: 'enableChatHeaderName',
                label: 'Enable Chat Header Name Click',
                description: 'Make chat header names clickable to open profile',
                type: 'boolean',
                default: true,
            },
            {
                key: 'enableChatItemImage',
                label: 'Enable Chat Item Image Click',
                description: 'Make chat item images clickable to open profile',
                type: 'boolean',
                default: true,
            },
            {
                key: 'enableChatItemName',
                label: 'Enable Chat Item Name Click',
                description: 'Make chat item names clickable to open profile',
                type: 'boolean',
                default: true,
            },
        ],
    },
    {
        id: 'chat-dialog',
        name: 'Chat Dialog',
        description: 'Modern WhatsApp-like chat interface in a dialog',
        category: 'Chat',
        configOptions: [
            {
                key: 'hideOldChat',
                label: 'Hide Old Chat',
                description: 'Hide the original Messenger button from navbar and sidebar',
                type: 'boolean',
                default: true,
            },
        ],
    },
];

