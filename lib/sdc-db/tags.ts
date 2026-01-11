/**
 * High-level Tags API for SDC Database
 */

import { SDCDatabase } from './database';
import { getDatabase, setDatabase } from './init';
import { saveDatabase } from './storage';
import { triggerTagChange } from './tag-change-trigger';

export interface Tag {
  id: number;
  text: string;
  color: string;
}

/**
 * Get all tags
 */
export function getAllTags(): Tag[] {
  const db = new SDCDatabase(getDatabase());
  return db.select('tags') as Tag[];
}

/**
 * Create a new tag
 */
export async function createTag(text: string, color: string): Promise<number> {
  const db = new SDCDatabase(getDatabase());
  const id = db.insert('tags', { text, color });
  const updatedDb = db.getDatabase();
  await saveDatabase(updatedDb);
  setDatabase(updatedDb);
  triggerTagChange();
  return id;
}

/**
 * Get a tag by ID
 */
export function getTag(id: number): Tag | null {
  const db = new SDCDatabase(getDatabase());
  const tags = db.select('tags', (row) => row.id === id) as Tag[];
  return tags.length > 0 ? tags[0] : null;
}

/**
 * Update a tag
 */
export async function updateTag(id: number, updates: Partial<Omit<Tag, 'id'>>): Promise<boolean> {
  const db = new SDCDatabase(getDatabase());
  const result = db.update('tags', id, updates);
  if (result) {
    const updatedDb = db.getDatabase();
    await saveDatabase(updatedDb);
    setDatabase(updatedDb);
    triggerTagChange();
  }
  return result;
}

/**
 * Delete a tag (also removes all chat_tag links)
 */
export async function deleteTag(id: number): Promise<boolean> {
  const db = new SDCDatabase(getDatabase());

  // Delete all chat_tag links first
  const chatTags = db.select('chat_tags', (row) => row.tag_id === id);
  for (const chatTag of chatTags) {
    db.delete('chat_tags', chatTag.id);
  }

  // Delete the tag
  const result = db.delete('tags', id);
  if (result) {
    const updatedDb = db.getDatabase();
    await saveDatabase(updatedDb);
    setDatabase(updatedDb);
    triggerTagChange();
  }
  return result;
}

/**
 * Get tags for a specific chat (via chat_tags junction table)
 */
export function getTagsForChat(chatId: number): Tag[] {
  const db = new SDCDatabase(getDatabase());

  // Get all chat_tag links for this chat
  const chatTags = db.select('chat_tags', (row) => row.chat_id === chatId);

  // Get the actual tags
  const tagIds = chatTags.map(ct => ct.tag_id);
  const allTags = db.select('tags') as Tag[];

  return allTags.filter(tag => tagIds.includes(tag.id));
}

/**
 * Link a tag to a chat
 */
export async function linkTagToChat(chatId: number, tagId: number): Promise<number> {
  const db = new SDCDatabase(getDatabase());

  // Check if tag exists
  const tag = getTag(tagId);
  if (!tag) {
    throw new Error(`Tag with id ${tagId} does not exist`);
  }

  // Check if link already exists
  const existing = db.select('chat_tags', (row) => 
    row.chat_id === chatId && row.tag_id === tagId
  );

  if (existing.length > 0) {
    return existing[0].id; // Return existing link ID
  }

  // Create new link
  const id = db.insert('chat_tags', { chat_id: chatId, tag_id: tagId });
  const updatedDb = db.getDatabase();
  await saveDatabase(updatedDb);
  setDatabase(updatedDb);
  triggerTagChange();
  return id;
}

/**
 * Unlink a tag from a chat
 */
export async function unlinkTagFromChat(chatId: number, tagId: number): Promise<boolean> {
  const db = new SDCDatabase(getDatabase());

  const chatTags = db.select('chat_tags', (row) => 
    row.chat_id === chatId && row.tag_id === tagId
  );

  if (chatTags.length === 0) {
    return false;
  }

  // Delete all matching links (should only be one, but handle multiple)
  let deleted = false;
  for (const chatTag of chatTags) {
    if (db.delete('chat_tags', chatTag.id)) {
      deleted = true;
    }
  }

  if (deleted) {
    const updatedDb = db.getDatabase();
    await saveDatabase(updatedDb);
    setDatabase(updatedDb);
    triggerTagChange();
  }

  return deleted;
}
