<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { 
	getAllTags, 
	getTagsForChat, 
	deleteTag as deleteTagGlobal,
	linkTagToChat,
	unlinkTagFromChat,
	type Tag
} from '@/lib/sdc-db/tags';
import TagBadge from '@/components/ui/TagBadge.vue';
import TagEditDialog from '@/components/chat/TagEditDialog.vue';
import { useSDCDatabaseStore } from '@/lib/sdc-db/store';

interface Props {
	modelValue: boolean;
	chat: MessengerChatItem | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	'save': [];
}>();

const { isReady: dbIsReady } = useSDCDatabaseStore();

// All available tags
const allTags = ref<Tag[]>([]);
// Tags assigned to current chat
const chatTagIds = ref<Set<number>>(new Set());
// Edit dialog state
const showEditDialog = ref(false);
const editingTag = ref<Tag | null>(null);
const error = ref<string | null>(null);
const isLoading = ref(false);
const isDeleting = ref<number | null>(null);

const MAX_TAGS_PER_CHAT = 5;

const assignedTagsCount = computed(() => chatTagIds.value.size);

// Load all tags and current chat's tags when dialog opens
watch(() => props.modelValue, async (isOpen) => {
	if (isOpen && props.chat && dbIsReady.value) {
		await loadAllData();
	} else {
		resetState();
	}
});

// Watch for database readiness
watch(dbIsReady, async (ready) => {
	if (ready && props.modelValue && props.chat) {
		await loadAllData();
	}
});

async function loadAllData() {
	if (!props.chat || !dbIsReady.value) return;
	
	isLoading.value = true;
	error.value = null;
	try {
		// Load all tags
		allTags.value = getAllTags();
		
		// Load tags assigned to current chat
		const chatTags = getTagsForChat(props.chat.group_id);
		chatTagIds.value = new Set(chatTags.map(t => t.id));
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to load tags';
	} finally {
		isLoading.value = false;
	}
}

function resetState() {
	allTags.value = [];
	chatTagIds.value = new Set();
	showEditDialog.value = false;
	editingTag.value = null;
	error.value = null;
	isDeleting.value = null;
}

function handleClose() {
	emit('update:modelValue', false);
	resetState();
}

function openCreateDialog() {
	editingTag.value = null;
	showEditDialog.value = true;
	error.value = null;
}

function openEditDialog(tagId: number) {
	const tag = allTags.value.find(t => t.id === tagId);
	if (!tag) return;
	
	editingTag.value = tag;
	showEditDialog.value = true;
	error.value = null;
}

function handleEditDialogSave() {
	// Reload tags after create/edit
	loadAllData();
	// Don't emit 'save' - keep dialog open, parent will update reactively
}

function handleEditDialogClose() {
	showEditDialog.value = false;
	editingTag.value = null;
}

async function handleDeleteTag(tagId: number) {
	if (!props.chat || !dbIsReady.value) return;
	
	// Check if tag is assigned to this chat
	const isAssigned = chatTagIds.value.has(tagId);
	
	// Confirmation
	if (!confirm(`Are you sure you want to delete this tag?${isAssigned ? '\n\nThis tag is currently assigned to this chat and will be removed.' : ''}\n\nThis will remove the tag from all chats that use it.`)) {
		return;
	}
	
	isDeleting.value = tagId;
	error.value = null;
	
	try {
		await deleteTagGlobal(tagId);
		await loadAllData();
		// Don't emit 'save' - keep dialog open, parent will update reactively
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to delete tag';
	} finally {
		isDeleting.value = null;
	}
}

async function toggleTagAssignment(tagId: number) {
	if (!props.chat || !dbIsReady.value) return;
	
	const isAssigned = chatTagIds.value.has(tagId);
	
	try {
		if (isAssigned) {
			// Unassign tag from chat
			await unlinkTagFromChat(props.chat.group_id, tagId);
			chatTagIds.value.delete(tagId);
		} else {
			// Assign tag to chat
			if (assignedTagsCount.value >= MAX_TAGS_PER_CHAT) {
				error.value = `Maximum ${MAX_TAGS_PER_CHAT} tags allowed per chat`;
				return;
			}
			await linkTagToChat(props.chat.group_id, tagId);
			chatTagIds.value.add(tagId);
		}
		
		error.value = null;
		// Don't emit 'save' - keep dialog open, parent will update reactively
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to update tag assignment';
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
			class="w-[90vw] max-w-2xl bg-[#1a1a1a] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-[#333]"
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
				<!-- Loading State -->
				<div v-if="isLoading" class="flex items-center justify-center py-8">
					<div class="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
				</div>

				<!-- Error Message -->
				<div v-else-if="error" class="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
					{{ error }}
				</div>

				<!-- Database Not Ready -->
				<div v-else-if="!dbIsReady" class="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-400 text-sm">
					Database is loading, please wait...
				</div>

				<template v-else>
					<!-- Create Tag Button -->
					<div class="mb-6">
						<button
							@click="openCreateDialog"
							class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
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
							>
								<path d="M12 5v14M5 12h14"></path>
							</svg>
							Create Tag
						</button>
					</div>

					<!-- Available Tags Section -->
					<div>
						<h3 class="text-sm font-medium text-[#999] mb-3">
							Available Tags ({{ assignedTagsCount }}/{{ MAX_TAGS_PER_CHAT }} assigned to this chat)
						</h3>
						<div v-if="allTags.length === 0" class="text-sm text-[#666] mb-4 py-8 text-center">
							No tags available. Click "Create Tag" to add your first tag.
						</div>
						<div v-else class="flex flex-wrap gap-2">
							<label
								v-for="tag in allTags"
								:key="tag.id"
								class="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] rounded-lg border transition-colors cursor-pointer"
								:class="chatTagIds.has(tag.id) ? 'border-blue-500 bg-blue-500/10' : 'border-[#333] hover:border-[#555]'"
							>
								<input
									type="checkbox"
									:checked="chatTagIds.has(tag.id)"
									:disabled="!chatTagIds.has(tag.id) && assignedTagsCount >= MAX_TAGS_PER_CHAT"
									@change="toggleTagAssignment(tag.id)"
									class="w-4 h-4 rounded border-[#555] bg-[#1a1a1a] text-blue-500 focus:ring-blue-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
								/>
								<TagBadge :text="tag.text" :color="tag.color" />
								<button
									@click.stop="openEditDialog(tag.id)"
									class="p-1 hover:bg-[#3a3a3a] rounded transition-colors ml-1"
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
									@click.stop="handleDeleteTag(tag.id)"
									:disabled="isDeleting === tag.id"
									class="p-1 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									title="Delete tag"
								>
									<svg
										v-if="isDeleting !== tag.id"
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
									<svg
										v-else
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-red-400 animate-spin"
									>
										<path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
									</svg>
								</button>
							</label>
						</div>
					</div>
				</template>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#333]">
				<button
					@click="handleClose"
					class="px-4 py-2 text-sm bg-[#2a2a2a] hover:bg-[#333] text-white rounded transition-colors"
				>
					Close
				</button>
			</div>
		</div>

		<!-- Nested Edit/Create Dialog -->
		<TagEditDialog
			:model-value="showEditDialog"
			:tag="editingTag"
			@update:model-value="handleEditDialogClose"
			@save="handleEditDialogSave"
		/>
	</div>
</template>
