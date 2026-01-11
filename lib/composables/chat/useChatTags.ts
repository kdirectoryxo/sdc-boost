/**
 * Composable for managing chat tags using SDC database
 */

import { ref } from 'vue';
import { 
	getTagsForChat, 
	createTag, 
	linkTagToChat, 
	unlinkTagFromChat,
	getAllTags,
	updateTag as updateTagGlobal,
	deleteTag as deleteTagGlobal,
	type Tag
} from '@/lib/sdc-db/tags';
import type { ChatTag } from '@/lib/db';

export function useChatTags() {
	const tags = ref<ChatTag[]>([]);

	/**
	 * Get tags for a specific chat
	 */
	async function getTags(groupId: number): Promise<ChatTag[]> {
		const fetchedTags = getTagsForChat(groupId);
		// Convert Tag[] to ChatTag[]
		const chatTags: ChatTag[] = fetchedTags.map(tag => ({
			text: tag.text,
			color: tag.color,
		}));
		tags.value = chatTags;
		return chatTags;
	}

	/**
	 * Save tags for a specific chat
	 * Updates chat_tag links to match the provided tags array
	 */
	async function saveTags(groupId: number, newTags: ChatTag[]): Promise<void> {
		// Get current tags for this chat
		const currentTags = getTagsForChat(groupId);
		
		// Find tags to add and remove
		const newTagMap = new Map<string, ChatTag>();
		newTags.forEach(tag => {
			const key = `${tag.text.toLowerCase()}|${tag.color}`;
			newTagMap.set(key, tag);
		});

		const currentTagMap = new Map<string, Tag>();
		currentTags.forEach(tag => {
			const key = `${tag.text.toLowerCase()}|${tag.color}`;
			currentTagMap.set(key, tag);
		});

		// Unlink tags that are no longer in the new list
		for (const [key, tag] of currentTagMap.entries()) {
			if (!newTagMap.has(key)) {
				await unlinkTagFromChat(groupId, tag.id);
			}
		}

		// Link tags that are new or were removed and re-added
		for (const [key, tag] of newTagMap.entries()) {
			if (!currentTagMap.has(key)) {
				// Find or create the tag
				const allTags = getAllTags();
				let tagId: number | null = null;

				// Check if tag exists
				for (const existingTag of allTags) {
					if (existingTag.text.toLowerCase() === tag.text.toLowerCase() && 
					    existingTag.color === tag.color) {
						tagId = existingTag.id;
						break;
					}
				}

				// Create tag if it doesn't exist
				if (!tagId) {
					tagId = await createTag(tag.text, tag.color);
				}

				// Link tag to chat
				await linkTagToChat(groupId, tagId);
			}
		}

		// Refresh tags
		await getTags(groupId);
	}

	/**
	 * Add a tag to a chat
	 * Finds or creates the tag, then links it to the chat
	 */
	async function addTag(groupId: number, tag: ChatTag): Promise<void> {
		// Check if tag already exists
		const allTags = getAllTags();
		let tagId: number | null = null;

		for (const existingTag of allTags) {
			if (existingTag.text.toLowerCase() === tag.text.toLowerCase() && 
			    existingTag.color === tag.color) {
				tagId = existingTag.id;
				break;
			}
		}

		// Create tag if it doesn't exist
		if (!tagId) {
			tagId = await createTag(tag.text, tag.color);
		}

		// Link tag to chat (linkTagToChat handles duplicates)
		await linkTagToChat(groupId, tagId);
		
		// Refresh tags
		await getTags(groupId);
	}

	/**
	 * Remove a tag from a chat by index
	 */
	async function removeTag(groupId: number, tagIndex: number): Promise<void> {
		const currentTags = getTagsForChat(groupId);
		
		if (tagIndex < 0 || tagIndex >= currentTags.length) {
			throw new Error('Invalid tag index');
		}

		const tagToRemove = currentTags[tagIndex];
		await unlinkTagFromChat(groupId, tagToRemove.id);
		
		// Refresh tags
		await getTags(groupId);
	}

	/**
	 * Update a tag globally (affects all chats using this tag)
	 */
	async function updateTag(groupId: number, tagIndex: number, tag: ChatTag): Promise<void> {
		const currentTags = getTagsForChat(groupId);
		
		if (tagIndex < 0 || tagIndex >= currentTags.length) {
			throw new Error('Invalid tag index');
		}

		const tagToUpdate = currentTags[tagIndex];
		
		// Update tag globally
		await updateTagGlobal(tagToUpdate.id, {
			text: tag.text,
			color: tag.color,
		});
		
		// Refresh tags
		await getTags(groupId);
	}

	return {
		tags,
		getTags,
		saveTags,
		addTag,
		removeTag,
		updateTag,
	};
}

