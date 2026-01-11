/**
 * High-level Settings API for SDC Database
 */

import { SDCDatabase } from './database';
import { getDatabase, setDatabase } from './init';
import { saveDatabase } from './storage';

export interface Setting {
  id: number;
  key: string;
  value: any;
}

/**
 * Get a setting by key
 */
export function getSetting(key: string): any {
  const db = new SDCDatabase(getDatabase());
  const settings = db.select('settings', (row) => row.key === key) as Setting[];
  
  if (settings.length === 0) {
    return null;
  }

  return settings[0].value;
}

/**
 * Set a setting (creates if doesn't exist, updates if exists)
 */
export async function setSetting(key: string, value: any): Promise<void> {
  const db = new SDCDatabase(getDatabase());
  const settings = db.select('settings', (row) => row.key === key) as Setting[];

  if (settings.length > 0) {
    // Update existing
    db.update('settings', settings[0].id, { value });
  } else {
    // Create new
    db.insert('settings', { key, value });
  }
  
  const updatedDb = db.getDatabase();
  await saveDatabase(updatedDb);
  setDatabase(updatedDb);
}

/**
 * Delete a setting by key
 */
export async function deleteSetting(key: string): Promise<boolean> {
  const db = new SDCDatabase(getDatabase());
  const settings = db.select('settings', (row) => row.key === key) as Setting[];

  if (settings.length === 0) {
    return false;
  }

  const result = db.delete('settings', settings[0].id);
  if (result) {
    const updatedDb = db.getDatabase();
    await saveDatabase(updatedDb);
    setDatabase(updatedDb);
  }
  return result;
}

/**
 * Get all settings
 */
export function getAllSettings(): Setting[] {
  const db = new SDCDatabase(getDatabase());
  return db.select('settings') as Setting[];
}
