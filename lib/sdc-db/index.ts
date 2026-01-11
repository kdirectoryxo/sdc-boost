/**
 * SDC Database System - Main exports
 */

// Types
export type { ColumnType, ColumnDefinition, TableSchema, Table, Row, Database } from './types';

// Storage
export { loadDatabase, saveDatabase, encodeDatabase, decodeDatabase } from './storage';

// Database class
export { SDCDatabase } from './database';

// Schemas
export { TAGS_SCHEMA, CHAT_TAGS_SCHEMA, SETTINGS_SCHEMA } from './schemas';

// Initialization
export { initializeDatabase, getDatabase, setDatabase } from './init';

// Store
export { useSDCDatabaseStore } from './store';

// Tags API
export {
  getAllTags,
  createTag,
  getTag,
  updateTag,
  deleteTag,
  getTagsForChat,
  linkTagToChat,
  unlinkTagFromChat,
  type Tag,
} from './tags';

// Settings API
export {
  getSetting,
  setSetting,
  deleteSetting,
  getAllSettings,
  type Setting,
} from './settings';

// Test utilities
export { insertTestData, readTestData } from './test';

// Migration
export { migrateTagsFromIndexedDB } from './migration';

// Tag change trigger
export { tagChangeTrigger, triggerTagChange } from './tag-change-trigger';
