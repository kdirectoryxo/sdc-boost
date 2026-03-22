<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import { X } from 'lucide-vue-next';
import type { MessengerFolder } from '@/lib/sdc-api-types';
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
	CHAT_NESTED_DIALOG_OVERLAY_CLASS,
	CHAT_NESTED_DIALOG_CONTENT_CLASS,
} from '@/lib/chat-ui/nested-dialog-classes';

interface Props {
	modelValue: boolean;
	folder: MessengerFolder | null;
	errorMessage?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
	errorMessage: null,
});

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	'save': [name: string];
}>();

const folderName = ref('');
const error = ref<string | null>(null);
const isSaving = ref(false);

const isEditMode = computed(() => props.folder !== null && props.folder !== undefined);

const canSave = computed(() => {
	return folderName.value.trim().length > 0 && !isSaving.value;
});

watch(() => props.modelValue, (isOpen) => {
	if (isOpen) {
		initializeForm();
	} else {
		resetForm();
	}
});

watch(() => props.folder, () => {
	if (props.modelValue) {
		initializeForm();
	}
});

watch(() => props.errorMessage, (newError) => {
	if (newError) {
		error.value = newError;
		isSaving.value = false;
	}
});

function initializeForm() {
	if (props.folder) {
		folderName.value = props.folder.name;
	} else {
		resetForm();
	}
	error.value = null;
}

function resetForm() {
	folderName.value = '';
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

function validateFolderName(name: string): string | null {
	const trimmedName = name.trim();

	if (!trimmedName) {
		return 'Folder name cannot be empty';
	}

	if (trimmedName.length > 100) {
		return 'Folder name cannot exceed 100 characters';
	}

	return null;
}

function handleSave() {
	const trimmedName = folderName.value.trim();

	const validationError = validateFolderName(trimmedName);
	if (validationError) {
		error.value = validationError;
		return;
	}

	if (isEditMode.value && props.folder && trimmedName === props.folder.name) {
		handleClose();
		return;
	}

	isSaving.value = true;
	error.value = null;

	emit('save', trimmedName);
}
</script>

<template>
	<Dialog :open="modelValue" @update:open="onOpenChange">
		<DialogContent
			:show-close-button="false"
			:overlay-class="CHAT_NESTED_DIALOG_OVERLAY_CLASS"
			:class="
				cn(
					CHAT_NESTED_DIALOG_CONTENT_CLASS,
					'!max-w-md !w-[90vw] flex flex-col overflow-hidden rounded-lg bg-background',
				)
			"
		>
			<DialogHeader class="flex-row items-center justify-between space-y-0 border-b border-white/[0.06] px-6 py-4 text-left">
				<DialogTitle class="text-xl font-semibold text-white">
					{{ isEditMode ? 'Edit Folder' : 'Create Folder' }}
				</DialogTitle>
				<Button variant="ghost" size="icon" class="shrink-0" title="Close" @click="handleClose">
					<X class="size-5 text-muted-foreground" />
				</Button>
			</DialogHeader>

			<div class="flex-1 overflow-y-auto p-6">
				<div v-if="error" class="mb-4 rounded border border-red-500/50 bg-red-500/20 p-3 text-sm text-red-400">
					{{ error }}
				</div>

				<div class="mb-4">
					<Label for="folder-name" class="mb-2 block text-muted-foreground">Folder Name</Label>
					<Input
						id="folder-name"
						v-model="folderName"
						type="text"
						placeholder="Enter folder name..."
						maxlength="100"
						:disabled="isSaving"
						class="border-white/[0.06] bg-sidebar text-white placeholder:text-white/40"
						@keydown.enter="handleSave"
						@keydown.esc="handleClose"
					/>
				</div>
			</div>

			<DialogFooter class="border-t border-white/[0.06] px-6 py-4 sm:justify-end">
				<Button variant="ghost" :disabled="isSaving" @click="handleClose"> Cancel </Button>
				<Button :disabled="!canSave" @click="handleSave">
					<template v-if="isSaving">
						<Spinner class="size-3.5" />
						{{ isEditMode ? 'Saving...' : 'Creating...' }}
					</template>
					<template v-else>
						{{ isEditMode ? 'Save' : 'Create' }}
					</template>
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
</template>
