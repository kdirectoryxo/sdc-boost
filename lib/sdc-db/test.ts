/**
 * Test utilities for SDC Database
 */

import { SDCDatabase } from './database';
import { getDatabase, setDatabase } from './init';
import { saveDatabase } from './storage';
import type { Database } from './types';

/**
 * Insert test data and return what was saved
 */
export async function insertTestData(): Promise<string> {
  // Create fresh database with test data
  const testDb: Database = {
    version: 1,
    tables: {
      tags: {
        schema: {
          columns: [
            { name: 'id', type: 'int' },
            { name: 'text', type: 'text' },
            { name: 'color', type: 'text' },
          ],
        },
        data: [
          { id: 1, text: 'Test Tag 1', color: '#ff0000' },
          { id: 2, text: 'Test Tag 2', color: '#00ff00' },
          { id: 3, text: 'Test Tag 3', color: '#0000ff' },
        ],
      },
      chat_tags: {
        schema: {
          columns: [
            { name: 'id', type: 'int' },
            { name: 'chat_id', type: 'int' },
            { name: 'tag_id', type: 'int' },
          ],
        },
        data: [
          { id: 1, chat_id: 123, tag_id: 1 },
          { id: 2, chat_id: 123, tag_id: 2 },
          { id: 3, chat_id: 456, tag_id: 2 },
        ],
      },
      settings: {
        schema: {
          columns: [
            { name: 'id', type: 'int' },
            { name: 'key', type: 'text' },
            { name: 'value', type: 'json' },
          ],
        },
        data: [
          { id: 1, key: 'test_setting', value: { enabled: true, count: 42 } },
        ],
      },
    },
  };

  // Save to note
  await saveDatabase(testDb);

  // Update instance
  setDatabase(testDb);

  // Return JSON string for comparison
  return JSON.stringify(testDb, null, 2);
}

/**
 * Read test data and return database content
 */
export async function readTestData(): Promise<string> {
  try {
    const db = getDatabase();
    return JSON.stringify(db, null, 2);
  } catch (error) {
    throw new Error('Database not initialized');
  }
}
