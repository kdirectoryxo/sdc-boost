/**
 * Predefined table schemas for SDC Database
 */

import type { TableSchema } from './types';

export const TAGS_SCHEMA: TableSchema = {
  columns: [
    { name: 'id', type: 'int' },
    { name: 'text', type: 'text' },
    { name: 'color', type: 'text' },
  ],
};

export const CHAT_TAGS_SCHEMA: TableSchema = {
  columns: [
    { name: 'id', type: 'int' },
    { name: 'chat_id', type: 'int' },
    { name: 'tag_id', type: 'int' },
  ],
};

export const SETTINGS_SCHEMA: TableSchema = {
  columns: [
    { name: 'id', type: 'int' },
    { name: 'key', type: 'text' },
    { name: 'value', type: 'json' },
  ],
};
