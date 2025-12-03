/**
 * Composable for managing chat tags
 */

import { ref } from 'vue';
import { tagStorage } from '@/lib/tag-storage';
import type { ChatTag } from '@/lib/db';

export function useChatTags() {
	const tags = ref<ChatTag[]>([]);

	/**
	 * Get tags for a specific chat
	 */
	async function getTags(groupId: number): Promise<ChatTag[]> {
		const fetchedTags = await tagStorage.getTags(groupId);
		tags.value = fetchedTags;
		return fetchedTags;
	}

	/**
	 * Save tags for a specific chat
	 */
	async function saveTags(groupId: number, newTags: ChatTag[]): Promise<void> {
		await tagStorage.setTags(groupId, newTags);
		tags.value = newTags;
	}

	/**
	 * Add a tag to a chat
	 */
	async function addTag(groupId: number, tag: ChatTag): Promise<void> {
		await tagStorage.addTag(groupId, tag);
		await getTags(groupId); // Refresh tags
	}

	/**
	 * Remove a tag from a chat
	 */
	async function removeTag(groupId: number, tagIndex: number): Promise<void> {
		await tagStorage.removeTag(groupId, tagIndex);
		await getTags(groupId); // Refresh tags
	}

	/**
	 * Update a tag in a chat
	 */
	async function updateTag(groupId: number, tagIndex: number, tag: ChatTag): Promise<void> {
		await tagStorage.updateTag(groupId, tagIndex, tag);
		await getTags(groupId); // Refresh tags
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

