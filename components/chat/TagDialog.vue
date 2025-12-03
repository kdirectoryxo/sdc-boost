<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import type { ChatTag } from '@/lib/db';
import { useChatTags } from '@/lib/composables/chat/useChatTags';
import { TAG_COLOR_PALETTE, isValidHexColor, normalizeHexColor } from '@/lib/tag-colors';
import TagBadge from '@/components/ui/TagBadge.vue';

interface Props {
	modelValue: boolean;
	chat: MessengerChatItem | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	'save': [tags: ChatTag[]];
}>();

const { getTags, saveTags } = useChatTags();
const tags = ref<ChatTag[]>([]);
const editingIndex = ref<number | null>(null);
const newTagText = ref('');
const newTagColor = ref(TAG_COLOR_PALETTE[0]);
const showCustomColor = ref(false);
const customColor = ref('#000000');
const error = ref<string | null>(null);

const MAX_TAGS = 5;

const canAddTag = computed(() => {
	return tags.value.length < MAX_TAGS && newTagText.value.trim().length > 0;
});

const isEditing = computed(() => editingIndex.value !== null);

const currentColor = computed(() => {
	if (showCustomColor.value) {
		return normalizeHexColor(customColor.value);
	}
	return newTagColor.value;
});

// Load tags when dialog opens
watch(() => props.modelValue, async (isOpen) => {
	if (isOpen && props.chat) {
		await loadTags();
	} else {
		resetForm();
	}
});

async function loadTags() {
	if (!props.chat) return;
	
	try {
		tags.value = await getTags(props.chat.group_id);
		error.value = null;
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to load tags';
	}
}

function resetForm() {
	newTagText.value = '';
	newTagColor.value = TAG_COLOR_PALETTE[0];
	showCustomColor.value = false;
	customColor.value = '#000000';
	editingIndex.value = null;
	error.value = null;
}

function handleClose() {
	emit('update:modelValue', false);
	resetForm();
}

function startEdit(index: number) {
	const tag = tags.value[index];
	editingIndex.value = index;
	newTagText.value = tag.text;
	
	// Check if color is in palette
	const paletteIndex = TAG_COLOR_PALETTE.indexOf(tag.color as any);
	if (paletteIndex >= 0) {
		newTagColor.value = tag.color;
		showCustomColor.value = false;
	} else {
		customColor.value = tag.color;
		showCustomColor.value = true;
	}
}

function cancelEdit() {
	editingIndex.value = null;
	resetForm();
}

function validateTag(text: string, color: string): string | null {
	const trimmedText = text.trim();
	
	if (!trimmedText) {
		return 'Tag text cannot be empty';
	}
	
	if (trimmedText.length > 50) {
		return 'Tag text cannot exceed 50 characters';
	}
	
	const normalizedColor = normalizeHexColor(color);
	if (!isValidHexColor(normalizedColor)) {
		return 'Invalid color format';
	}
	
	// Check for duplicate text (case-insensitive), excluding current editing tag
	const textLower = trimmedText.toLowerCase();
	const duplicateIndex = tags.value.findIndex((t, idx) => 
		idx !== editingIndex.value && t.text.trim().toLowerCase() === textLower
	);
	
	if (duplicateIndex >= 0) {
		return 'Tag with this text already exists';
	}
	
	return null;
}

async function handleSave() {
	if (!props.chat) return;
	
	const trimmedText = newTagText.value.trim();
	const normalizedColor = normalizeHexColor(currentColor.value);
	
	const validationError = validateTag(trimmedText, normalizedColor);
	if (validationError) {
		error.value = validationError;
		return;
	}
	
	const tag: ChatTag = {
		text: trimmedText,
		color: normalizedColor,
	};
	
	try {
		if (editingIndex.value !== null) {
			// Update existing tag
			const newTags = [...tags.value];
			newTags[editingIndex.value] = tag;
			await saveTags(props.chat.group_id, newTags);
			tags.value = newTags;
			editingIndex.value = null;
		} else {
			// Add new tag
			if (tags.value.length >= MAX_TAGS) {
				error.value = `Maximum ${MAX_TAGS} tags allowed`;
				return;
			}
			
			const newTags = [...tags.value, tag];
			await saveTags(props.chat.group_id, newTags);
			tags.value = newTags;
		}
		
		resetForm();
		error.value = null;
		emit('save', tags.value);
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to save tag';
	}
}

async function handleDelete(index: number) {
	if (!props.chat) return;
	
	try {
		const newTags = tags.value.filter((_, idx) => idx !== index);
		await saveTags(props.chat.group_id, newTags);
		tags.value = newTags;
		error.value = null;
		emit('save', tags.value);
		
		// Cancel edit if deleting the tag being edited
		if (editingIndex.value === index) {
			cancelEdit();
		}
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to delete tag';
	}
}

function toggleCustomColor() {
	showCustomColor.value = !showCustomColor.value;
	if (showCustomColor.value) {
		customColor.value = newTagColor.value;
	} else {
		newTagColor.value = TAG_COLOR_PALETTE[0];
	}
}
</script>

<template>
	<div
		v-if="modelValue"
		class="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-[1000000]"
		style="pointer-events: auto; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
		@click.self="handleClose"
	>
		<div
			class="w-[90vw] max-w-md bg-[#1a1a1a] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-[#333]"
			@click.stop
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-[#333]">
				<h2 class="text-xl font-semibold text-white">Manage Tags</h2>
				<button
					@click="handleClose"
					class="p-1 hover:bg-[#333] rounded transition-colors"
					title="Close"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-[#999] hover:text-white"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				<!-- Error Message -->
				<div v-if="error" class="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
					{{ error }}
				</div>

				<!-- Existing Tags -->
				<div v-if="tags.length > 0" class="mb-6">
					<h3 class="text-sm font-medium text-[#999] mb-3">Existing Tags ({{ tags.length }}/{{ MAX_TAGS }})</h3>
					<div class="flex flex-wrap gap-2">
						<div
							v-for="(tag, index) in tags"
							:key="index"
							class="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] rounded-lg border border-[#333]"
						>
							<TagBadge :text="tag.text" :color="tag.color" />
							<button
								@click="startEdit(index)"
								class="p-1 hover:bg-[#3a3a3a] rounded transition-colors"
								title="Edit tag"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-[#999] hover:text-white"
								>
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
									<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
								</svg>
							</button>
							<button
								@click="handleDelete(index)"
								class="p-1 hover:bg-red-500/20 rounded transition-colors"
								title="Delete tag"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-red-400 hover:text-red-300"
								>
									<polyline points="3 6 5 6 21 6"></polyline>
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
								</svg>
							</button>
						</div>
					</div>
				</div>

				<!-- Add/Edit Tag Form -->
				<div>
					<h3 class="text-sm font-medium text-[#999] mb-3">
						{{ isEditing ? 'Edit Tag' : `Add New Tag${tags.length >= MAX_TAGS ? ' (Maximum reached)' : ''}` }}
					</h3>
					
					<!-- Tag Text Input -->
					<div class="mb-4">
						<label class="block text-sm text-[#999] mb-2">Tag Text</label>
						<input
							v-model="newTagText"
							type="text"
							placeholder="Enter tag text..."
							maxlength="50"
							class="w-full px-4 py-2 bg-[#0f0f0f] border border-[#333] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-blue-500 transition-colors"
							@keydown.enter="handleSave"
						/>
					</div>

					<!-- Color Selection -->
					<div class="mb-4">
						<label class="block text-sm text-[#999] mb-2">Color</label>
						
						<!-- Color Palette -->
						<div class="flex flex-wrap gap-2 mb-3">
							<button
								v-for="color in TAG_COLOR_PALETTE"
								:key="color"
								@click="showCustomColor = false; newTagColor = color"
								:class="[
									'w-8 h-8 rounded border-2 transition-all',
									!showCustomColor && newTagColor === color
										? 'border-white scale-110'
										: 'border-[#333] hover:border-[#555]'
								]"
								:style="{ backgroundColor: color }"
								:title="color"
							/>
							<button
								@click="toggleCustomColor"
								:class="[
									'w-8 h-8 rounded border-2 transition-all flex items-center justify-center',
									showCustomColor
										? 'border-white scale-110 bg-[#2a2a2a]'
										: 'border-[#333] hover:border-[#555] bg-[#1a1a1a]'
								]"
								title="Custom color"
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-[#999]"
								>
									<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
									<circle cx="9" cy="9" r="2"></circle>
									<path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
								</svg>
							</button>
						</div>

						<!-- Custom Color Picker -->
						<div v-if="showCustomColor" class="flex items-center gap-2">
							<input
								v-model="customColor"
								type="color"
								class="w-12 h-8 rounded border border-[#333] cursor-pointer"
								@input="customColor = normalizeHexColor(customColor)"
							/>
							<input
								v-model="customColor"
								type="text"
								placeholder="#000000"
								maxlength="7"
								class="flex-1 px-3 py-1.5 bg-[#0f0f0f] border border-[#333] rounded text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
								@input="customColor = normalizeHexColor(customColor)"
							/>
						</div>

						<!-- Preview -->
						<div class="mt-3 flex items-center gap-2">
							<span class="text-sm text-[#999]">Preview:</span>
							<TagBadge :text="newTagText || 'Tag text'" :color="currentColor" />
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#333]">
				<button
					v-if="isEditing"
					@click="cancelEdit"
					class="px-4 py-2 text-sm text-[#999] hover:text-white transition-colors"
				>
					Cancel
				</button>
				<button
					@click="handleClose"
					class="px-4 py-2 text-sm bg-[#2a2a2a] hover:bg-[#333] text-white rounded transition-colors"
				>
					Close
				</button>
				<button
					@click="handleSave"
					:disabled="!canAddTag && !isEditing"
					:class="[
						'px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors',
						(!canAddTag && !isEditing) ? 'opacity-50 cursor-not-allowed' : ''
					]"
				>
					{{ isEditing ? 'Update' : 'Add' }} Tag
				</button>
			</div>
		</div>
	</div>
</template>

