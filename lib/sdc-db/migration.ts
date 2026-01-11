/**
 * Migration system for tags from IndexedDB to SDC database
 */

import { db, type ChatMetadata } from '../db';
import { getAllTags, createTag, linkTagToChat } from './tags';
import { getDatabase, setDatabase } from './init';
import { saveDatabase } from './storage';
import type { ChatTag } from '../db';

interface MigrationResult {
  tagsCreated: number;
  linksCreated: number;
  chatsUpdated: number;
}

/**
 * Migrate tags from IndexedDB to SDC database
 * Extracts unique tags and creates chat_tag links
 */
export async function migrateTagsFromIndexedDB(): Promise<MigrationResult> {
  console.log('[SDCDB Migration] Starting tag migration from IndexedDB...');

  const result: MigrationResult = {
    tagsCreated: 0,
    linksCreated: 0,
    chatsUpdated: 0,
  };

  try {
    // Get all chat metadata from IndexedDB
    const allMetadata = await db.chat_metadata.toArray();
    console.log(`[SDCDB Migration] Found ${allMetadata.length} chat metadata entries`);

    // Extract all unique tags (by text+color combination)
    const tagMap = new Map<string, { text: string; color: string; tagId?: number }>();
    const chatTagLinks: Array<{ chatId: number; tagText: string; tagColor: string }> = [];

    for (const metadata of allMetadata) {
      if (metadata.tags && metadata.tags.length > 0) {
        for (const tag of metadata.tags) {
          const tagKey = `${tag.text.trim().toLowerCase()}|${tag.color}`;
          
          if (!tagMap.has(tagKey)) {
            tagMap.set(tagKey, {
              text: tag.text.trim(),
              color: tag.color,
            });
          }

          chatTagLinks.push({
            chatId: metadata.group_id,
            tagText: tag.text.trim(),
            tagColor: tag.color,
          });
        }
      }
    }

    console.log(`[SDCDB Migration] Found ${tagMap.size} unique tags across ${chatTagLinks.length} chat-tag relationships`);

    if (tagMap.size === 0) {
      console.log('[SDCDB Migration] No tags to migrate');
      return result;
    }

    // Get existing tags from SDC database
    const existingTags = getAllTags();
    const existingTagMap = new Map<string, number>();
    existingTags.forEach(tag => {
      const key = `${tag.text.trim().toLowerCase()}|${tag.color}`;
      existingTagMap.set(key, tag.id);
    });

    // Create tags in SDC database (skip if already exists)
    const tagIdMap = new Map<string, number>();

    for (const [tagKey, tagData] of tagMap.entries()) {
      if (existingTagMap.has(tagKey)) {
        // Tag already exists, use existing ID
        tagIdMap.set(tagKey, existingTagMap.get(tagKey)!);
      } else {
        // Create new tag
        const tagId = await createTag(tagData.text, tagData.color);
        tagIdMap.set(tagKey, tagId);
        result.tagsCreated++;
        console.log(`[SDCDB Migration] Created tag: "${tagData.text}" (${tagData.color})`);
      }
    }

    // Create chat_tag links
    // Refresh database instance after creating tags
    const dbInstance = getDatabase();
    const existingLinks = new Set<string>();

    // Get existing links to avoid duplicates
    const chatTagsTable = dbInstance.tables.chat_tags;
    if (chatTagsTable) {
      chatTagsTable.data.forEach(link => {
        const linkKey = `${link.chat_id}|${link.tag_id}`;
        existingLinks.add(linkKey);
      });
    }

    for (const link of chatTagLinks) {
      const tagKey = `${link.tagText.toLowerCase()}|${link.tagColor}`;
      const tagId = tagIdMap.get(tagKey);

      if (!tagId) {
        console.warn(`[SDCDB Migration] Tag ID not found for: ${link.tagText}`);
        continue;
      }

      const linkKey = `${link.chatId}|${tagId}`;
      if (!existingLinks.has(linkKey)) {
        await linkTagToChat(link.chatId, tagId);
        result.linksCreated++;
        existingLinks.add(linkKey);
      }
    }

    // Remove tags from IndexedDB chat_metadata
    for (const metadata of allMetadata) {
      if (metadata.tags && metadata.tags.length > 0) {
        const updatedMetadata: ChatMetadata = {
          ...metadata,
          tags: undefined, // Remove tags field
        };
        await db.chat_metadata.put(updatedMetadata);
        result.chatsUpdated++;
      }
    }

    console.log(`[SDCDB Migration] Migration complete:`, result);
    return result;
  } catch (error) {
    console.error('[SDCDB Migration] Migration failed:', error);
    throw error;
  }
}
