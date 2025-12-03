/**
 * IndexedDB storage manager for chat tags
 * Handles storing and retrieving tags for chats
 */

import { db, type ChatTag, type ChatMetadata } from './db';

const MAX_TAGS_PER_CHAT = 5;

class TagStorage {
	/**
	 * Get tags for a specific chat
	 */
	async getTags(groupId: number): Promise<ChatTag[]> {
		const metadata = await db.chat_metadata.get(groupId);
		if (!metadata?.tags) {
			return [];
		}
		// Ensure we return plain objects (deep clone to avoid reference issues)
		return metadata.tags.map(tag => ({
			text: String(tag.text),
			color: String(tag.color),
		}));
	}

	/**
	 * Set tags for a specific chat
	 * Enforces maximum of 5 tags per chat
	 */
	async setTags(groupId: number, tags: ChatTag[]): Promise<void> {
		if (tags.length > MAX_TAGS_PER_CHAT) {
			throw new Error(`Maximum ${MAX_TAGS_PER_CHAT} tags allowed per chat`);
		}

		// Ensure tags are plain serializable objects (deep clone to avoid IndexedDB cloning issues)
		const serializedTags: ChatTag[] = tags.map(tag => ({
			text: String(tag.text),
			color: String(tag.color),
		}));

		const existing = await db.chat_metadata.get(groupId);
		const metadata: ChatMetadata = {
			group_id: groupId,
			messages_fetched: existing?.messages_fetched || false,
			last_fetched_at: existing?.last_fetched_at,
			isBlocked: existing?.isBlocked,
			isArchived: existing?.isArchived,
			tags: serializedTags.length > 0 ? serializedTags : undefined,
		};

		await db.chat_metadata.put(metadata);
		console.log(`[TagStorage] Set ${tags.length} tags for chat ${groupId}`);
	}

	/**
	 * Add a tag to a chat
	 */
	async addTag(groupId: number, tag: ChatTag): Promise<void> {
		const existingTags = await this.getTags(groupId);
		
		if (existingTags.length >= MAX_TAGS_PER_CHAT) {
			throw new Error(`Maximum ${MAX_TAGS_PER_CHAT} tags allowed per chat`);
		}

		// Check for duplicate text (case-insensitive)
		const tagTextLower = tag.text.trim().toLowerCase();
		if (existingTags.some(t => t.text.trim().toLowerCase() === tagTextLower)) {
			throw new Error('Tag with this text already exists');
		}

		const newTags = [...existingTags, tag];
		await this.setTags(groupId, newTags);
	}

	/**
	 * Remove a tag from a chat by index
	 */
	async removeTag(groupId: number, tagIndex: number): Promise<void> {
		const existingTags = await this.getTags(groupId);
		
		if (tagIndex < 0 || tagIndex >= existingTags.length) {
			throw new Error('Invalid tag index');
		}

		const newTags = existingTags.filter((_, index) => index !== tagIndex);
		await this.setTags(groupId, newTags);
	}

	/**
	 * Update a tag at a specific index
	 */
	async updateTag(groupId: number, tagIndex: number, tag: ChatTag): Promise<void> {
		const existingTags = await this.getTags(groupId);
		
		if (tagIndex < 0 || tagIndex >= existingTags.length) {
			throw new Error('Invalid tag index');
		}

		// Check for duplicate text (case-insensitive), excluding current tag
		const tagTextLower = tag.text.trim().toLowerCase();
		if (existingTags.some((t, index) => 
			index !== tagIndex && t.text.trim().toLowerCase() === tagTextLower
		)) {
			throw new Error('Tag with this text already exists');
		}

		const newTags = [...existingTags];
		newTags[tagIndex] = tag;
		await this.setTags(groupId, newTags);
	}
}

// Create singleton instance
export const tagStorage = new TagStorage();

