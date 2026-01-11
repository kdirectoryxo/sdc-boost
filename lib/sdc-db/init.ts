/**
 * Database initialization logic
 */

import { loadDatabase, saveDatabase } from './storage';
import { TAGS_SCHEMA, CHAT_TAGS_SCHEMA, SETTINGS_SCHEMA } from './schemas';
import type { Database } from './types';
import { migrateTagsFromIndexedDB } from './migration';
import { getSetting, setSetting } from './settings';

let dbInstance: Database | null = null;

/**
 * Get or create database instance
 */
export function getDatabase(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbInstance;
}

/**
 * Set database instance (for testing/internal use)
 */
export function setDatabase(db: Database): void {
  dbInstance = db;
}

/**
 * Initialize database - load from note or create empty with default tables
 */
export async function initializeDatabase(): Promise<void> {
  console.log('[SDCDB Init] Starting database initialization...');
  
  try {
    // Try to load existing database
    console.log('[SDCDB Init] Loading database from note...');
    let db = await loadDatabase();
    const wasNewDatabase = !db;
    console.log('[SDCDB Init] Load result:', wasNewDatabase ? 'new database needed' : 'database loaded');

    // If no database exists, create empty one
    if (!db) {
      console.log('[SDCDB Init] Creating new database...');
      db = {
        version: 1,
        tables: {},
      };
    }

    // Track if we need to save (created new tables)
    let needsSave = wasNewDatabase;

    // Ensure default tables exist
    if (!db.tables.tags) {
      console.log('[SDCDB Init] Creating tags table...');
      db.tables.tags = {
        schema: TAGS_SCHEMA,
        data: [],
      };
      needsSave = true;
    }

    if (!db.tables.chat_tags) {
      console.log('[SDCDB Init] Creating chat_tags table...');
      db.tables.chat_tags = {
        schema: CHAT_TAGS_SCHEMA,
        data: [],
      };
      needsSave = true;
    }

    if (!db.tables.settings) {
      console.log('[SDCDB Init] Creating settings table...');
      db.tables.settings = {
        schema: SETTINGS_SCHEMA,
        data: [],
      };
      needsSave = true;
    }

    // Save if we created new tables or new database
    if (needsSave) {
      console.log('[SDCDB Init] Saving database to note...');
      await saveDatabase(db);
      console.log('[SDCDB Init] Database saved successfully');
    }

    // Store instance
    dbInstance = db;
    console.log('[SDCDB Init] Database initialization complete');

    // Run tag migration if needed
    await runTagMigrationIfNeeded();
  } catch (error) {
    console.error('[SDCDB Init] Initialization error:', error);
    throw error;
  }
}

/**
 * Run tag migration from IndexedDB if not already completed
 */
async function runTagMigrationIfNeeded(): Promise<void> {
  try {
    // Check if migration has already run
    const migrationCompleted = getSetting('migration_tags_completed');
    if (migrationCompleted === true) {
      console.log('[SDCDB Init] Tag migration already completed, skipping');
      return;
    }

    // Check if there are any tags in IndexedDB to migrate
    const { db } = await import('../db');
    const allMetadata = await db.chat_metadata.toArray();
    const hasTagsInIndexedDB = allMetadata.some(m => m.tags && m.tags.length > 0);

    if (!hasTagsInIndexedDB) {
      console.log('[SDCDB Init] No tags found in IndexedDB, skipping migration');
      // Mark migration as completed even if there's nothing to migrate
      await setSetting('migration_tags_completed', true);
      return;
    }

    console.log('[SDCDB Init] Running tag migration from IndexedDB...');
    const result = await migrateTagsFromIndexedDB();
    console.log('[SDCDB Init] Tag migration completed:', result);

    // Mark migration as completed
    await setSetting('migration_tags_completed', true);
  } catch (error) {
    console.error('[SDCDB Init] Tag migration failed:', error);
    // Don't throw - allow app to continue even if migration fails
  }
}
