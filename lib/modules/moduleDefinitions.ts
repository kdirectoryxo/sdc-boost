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
                description: 'Hide cards at or above this age',
                type: 'number',
                default: 20,
                min: 18,
                max: 100,
                step: 1,
            },
            {
                key: 'maxAge',
                label: 'Maximum Age',
                description: 'Hide cards at or below this age',
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
                description: 'Highlight cards at or above this age',
                type: 'number',
                default: 20,
                min: 18,
                max: 100,
                step: 1,
            },
            {
                key: 'maxAge',
                label: 'Maximum Age',
                description: 'Highlight cards at or below this age',
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
        id: 'chat-scroll-fix',
        name: 'Chat Scroll Fix',
        description: 'Prevents auto-scroll to bottom when loading older messages in chat.',
        category: 'Chat',
        configOptions: [],
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
        description: 'Adds a Boost button to the navbar next to Messenger to open the boost popup.',
        category: 'UI',
        configOptions: [],
    },
];

