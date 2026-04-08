import type { ModuleDefinition } from './types';

/**
 * Centralized module definitions
 * This is the single source of truth for all available modules
 */
export const moduleDefinitions: ModuleDefinition[] = [
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
];
