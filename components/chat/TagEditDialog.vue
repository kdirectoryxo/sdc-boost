<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import { X } from 'lucide-vue-next';
import { createTag, updateTag as updateTagGlobal, getAllTags, type Tag } from '@/lib/sdc-db/tags';
import { TAG_COLOR_PALETTE, isValidHexColor, normalizeHexColor } from '@/lib/tag-colors';
import TagBadge from '@/components/ui/TagBadge.vue';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/lib/view-router/ui/dialog';
import { Button } from '@/lib/view-router/ui/button';
import { Input } from '@/lib/view-router/ui/input';
import { Label } from '@/lib/view-router/ui/label';
import { Spinner } from '@/lib/view-router/ui/spinner';
import { cn } from '@/lib/utils';
import {
	CHAT_SUBDIALOG_OVERLAY_CLASS,
	CHAT_SUBDIALOG_CONTENT_CLASS,
} from '@/lib/chat-ui/nested-dialog-classes';

interface Props {
	modelValue: boolean;
	tag?: Tag | null; // null = create mode, Tag = edit mode
}

const props = withDefaults(defineProps<Props>(), {
	tag: null,
});

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	'save': [];
}>();

const tagText = ref('');
const tagColor = ref<string>(TAG_COLOR_PALETTE[0]);
const showCustomColor = ref(false);
const customColor = ref('#000000');
const error = ref<string | null>(null);
const isSaving = ref(false);

const isEditMode = computed(() => props.tag !== null && props.tag !== undefined);

const currentColor = computed(() => {
	if (showCustomColor.value) {
		return normalizeHexColor(customColor.value);
	}
	return tagColor.value;
});

const canSave = computed(() => {
	return tagText.value.trim().length > 0 && !isSaving.value;
});

// Initialize form when dialog opens or tag changes
watch(() => props.modelValue, (isOpen) => {
	if (isOpen) {
		initializeForm();
	} else {
		resetForm();
	}
});

watch(() => props.tag, () => {
	if (props.modelValue) {
		initializeForm();
	}
});

function initializeForm() {
	if (props.tag) {
		// Edit mode - load tag data
		tagText.value = props.tag.text;
		
		// Check if color is in palette
		const paletteIndex = TAG_COLOR_PALETTE.indexOf(props.tag.color as any);
		if (paletteIndex >= 0) {
			tagColor.value = props.tag.color;
			showCustomColor.value = false;
		} else {
			customColor.value = props.tag.color;
			showCustomColor.value = true;
		}
	} else {
		// Create mode - reset to defaults
		resetForm();
	}
	error.value = null;
}

function resetForm() {
	tagText.value = '';
	tagColor.value = TAG_COLOR_PALETTE[0];
	showCustomColor.value = false;
	customColor.value = '#000000';
	error.value = null;
	isSaving.value = false;
}

function handleClose() {
	emit('update:modelValue', false);
	resetForm();
}

function onOpenChange(open: boolean) {
	if (!open) {
		handleClose();
	}
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
	const allTags = getAllTags();
	const textLower = trimmedText.toLowerCase();
	const duplicateTag = allTags.find(t => 
		t.id !== props.tag?.id && t.text.trim().toLowerCase() === textLower
	);
	
	if (duplicateTag) {
		return 'Tag with this text already exists';
	}
	
	return null;
}

async function handleSave() {
	const trimmedText = tagText.value.trim();
	const normalizedColor = normalizeHexColor(currentColor.value);
	
	const validationError = validateTag(trimmedText, normalizedColor);
	if (validationError) {
		error.value = validationError;
		return;
	}
	
	isSaving.value = true;
	error.value = null;
	
	try {
		if (isEditMode.value && props.tag) {
			// Update existing tag
			await updateTagGlobal(props.tag.id, {
				text: trimmedText,
				color: normalizedColor,
			});
		} else {
			// Create new tag
			await createTag(trimmedText, normalizedColor);
		}
		
		emit('save');
		handleClose();
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to save tag';
	} finally {
		isSaving.value = false;
	}
}

function toggleCustomColor() {
	showCustomColor.value = !showCustomColor.value;
	if (showCustomColor.value) {
		customColor.value = tagColor.value;
	} else {
		tagColor.value = TAG_COLOR_PALETTE[0];
	}
}
</script>

<template>
	<Dialog :open="modelValue" @update:open="onOpenChange">
		<DialogContent
			:show-close-button="false"
			:overlay-class="CHAT_SUBDIALOG_OVERLAY_CLASS"
			:class="
				cn(
					CHAT_SUBDIALOG_CONTENT_CLASS,
					'!max-w-md !w-[90vw] flex flex-col overflow-hidden rounded-lg bg-background',
				)
			"
		>
			<DialogHeader class="flex-row items-center justify-between space-y-0 border-b border-white/[0.06] px-6 py-4 text-left">
				<DialogTitle class="text-xl font-semibold text-white">
					{{ isEditMode ? 'Edit Tag' : 'Create Tag' }}
				</DialogTitle>
				<Button variant="ghost" size="icon" title="Close" @click="handleClose">
					<X class="size-5 text-muted-foreground" />
				</Button>
			</DialogHeader>

			<div class="max-h-[70vh] flex-1 overflow-y-auto p-6">
				<!-- Error Message -->
				<div v-if="error" class="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
					{{ error }}
				</div>

				<!-- Tag Text Input -->
				<div class="mb-4">
					<Label for="tag-text" class="mb-2 block text-muted-foreground">Tag Text</Label>
					<Input
						id="tag-text"
						v-model="tagText"
						type="text"
						placeholder="Enter tag text..."
						maxlength="50"
						:disabled="isSaving"
						class="border-white/[0.06] bg-sidebar text-white placeholder:text-white/40"
						@keydown.enter="handleSave"
					/>
				</div>

				<!-- Color Selection -->
				<div class="mb-4">
					<label class="block text-sm text-muted-foreground mb-2">Color</label>
					
					<!-- Color Palette -->
					<div class="flex flex-wrap gap-2 mb-3">
						<button
							v-for="color in TAG_COLOR_PALETTE"
							:key="color"
							@click="showCustomColor = false; tagColor = color"
							:disabled="isSaving"
							:class="[
								'w-8 h-8 rounded border-2 transition-all',
								!showCustomColor && tagColor === color
									? 'border-white scale-110'
									: 'border-white/[0.06] hover:border-white/[0.12]',
								isSaving ? 'opacity-50 cursor-not-allowed' : ''
							]"
							:style="{ backgroundColor: color }"
							:title="color"
						/>
						<button
							@click="toggleCustomColor"
							:disabled="isSaving"
							:class="[
								'w-8 h-8 rounded border-2 transition-all flex items-center justify-center',
								showCustomColor
									? 'border-white scale-110 bg-secondary'
									: 'border-white/[0.06] hover:border-white/[0.12] bg-background',
								isSaving ? 'opacity-50 cursor-not-allowed' : ''
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
								class="text-muted-foreground"
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
							:disabled="isSaving"
							class="w-12 h-8 rounded border border-white/[0.06] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
							@input="customColor = normalizeHexColor(customColor)"
						/>
						<input
							v-model="customColor"
							type="text"
							placeholder="#000000"
							maxlength="7"
							:disabled="isSaving"
							class="flex-1 px-3 py-1.5 bg-sidebar border border-white/[0.06] rounded text-white text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							@input="customColor = normalizeHexColor(customColor)"
						/>
					</div>

					<!-- Preview -->
					<div class="mt-3 flex items-center gap-2">
						<span class="text-sm text-muted-foreground">Preview:</span>
						<TagBadge :text="tagText || 'Tag text'" :color="currentColor" />
					</div>
				</div>
			</div>

			<DialogFooter class="border-t border-white/[0.06] px-6 py-4 sm:justify-end">
				<Button variant="ghost" :disabled="isSaving" @click="handleClose">Cancel</Button>
				<Button :disabled="!canSave" @click="handleSave">
					<template v-if="isSaving">
						<Spinner class="size-3.5" />
						Saving...
					</template>
					<template v-else>
						{{ isEditMode ? 'Update' : 'Create' }} Tag
					</template>
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
</template>
