/**
 * Low-level storage operations for SDC Database
 * Handles encoding/decoding and note I/O
 */

import { getCurrentDBId, getCurrentMuid } from '../sdc-api/utils';
import { getCurrentNote } from '../sdc-api/profile';
import type { Database } from './types';

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Encode database to base64 string
 */
export function encodeDatabase(db: Database): string {
  const json = JSON.stringify(db);
  return btoa(unescape(encodeURIComponent(json)));
}

/**
 * Decode base64 string to database
 * Returns null if decoding fails (e.g., old format data)
 */
export function decodeDatabase(encoded: string): Database | null {
  try {
    const htmlDecoded = decodeHtmlEntities(encoded.trim());
    
    // Try to decode base64
    let json: string;
    try {
      json = decodeURIComponent(escape(atob(htmlDecoded)));
    } catch (base64Error) {
      // If base64 decode fails, it's likely old plain text format
      console.warn('[SDCDB Storage] Failed to decode base64, likely old format data');
      return null;
    }
    
    // Try to parse as JSON
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch (jsonError) {
      // If JSON parse fails, it's likely old plain text format
      console.warn('[SDCDB Storage] Failed to parse JSON, likely old format data:', jsonError);
      return null;
    }
    
    // Validate it's a database structure
    if (parsed && typeof parsed === 'object' && 'version' in parsed && 'tables' in parsed) {
      return parsed as Database;
    }
    
    // If it's not a valid database structure, return null
    console.warn('[SDCDB Storage] Invalid database structure');
    return null;
  } catch (error) {
    // Any other error - return null to trigger new database creation
    console.warn('[SDCDB Storage] Failed to decode database:', error);
    return null;
  }
}

/**
 * Load database from SDC profile note
 */
export async function loadDatabase(): Promise<Database | null> {
  console.log('[SDCDB Storage] loadDatabase() called');
  
  const dbId = getCurrentDBId();
  const muid = getCurrentMuid();
  console.log('[SDCDB Storage] Credentials:', { dbId: dbId ? 'present' : 'missing', muid: muid ? 'present' : 'missing' });

  if (!dbId || !muid) {
    console.error('[SDCDB Storage] Missing credentials');
    throw new Error('Could not determine user credentials');
  }

  console.log('[SDCDB Storage] Fetching note from API...');
  const noteText = await getCurrentNote(dbId, muid);
  console.log('[SDCDB Storage] Note fetched, length:', noteText?.length || 0);

  if (!noteText || noteText.trim().length === 0) {
    console.log('[SDCDB Storage] Note is empty, returning null');
    return null;
  }

  // decodeDatabase now returns null on failure instead of throwing
  console.log('[SDCDB Storage] Decoding database...');
  const db = decodeDatabase(noteText);
  console.log('[SDCDB Storage] Decode result:', db ? 'success' : 'failed (null)');
  return db;
}

/**
 * Save database to SDC profile note
 */
export async function saveDatabase(db: Database): Promise<void> {
  console.log('[SDCDB Storage] saveDatabase() called');
  
  const dbId = getCurrentDBId();
  const muid = getCurrentMuid();

  if (!dbId || !muid) {
    console.error('[SDCDB Storage] Missing credentials for save');
    throw new Error('Could not determine user credentials');
  }

  console.log('[SDCDB Storage] Encoding database...');
  const encoded = encodeDatabase(db);
  console.log('[SDCDB Storage] Encoded length:', encoded.length);

  const apiUrl = `https://api.sdc.com/v1/note_add?muid=${muid}`;
  const formData = new FormData();
  formData.append('TargetDB_ID', dbId);
  formData.append('Notes', encoded);
  formData.append('client_token', '0');

  console.log('[SDCDB Storage] Sending API request...');
  const response = await fetch(apiUrl, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SDCDB Storage] API request failed:', response.status, errorText);
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }
  
  console.log('[SDCDB Storage] Database saved successfully');
}
