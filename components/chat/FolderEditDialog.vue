<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import type { MessengerFolder } from '@/lib/sdc-api-types';

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

// Initialize form when dialog opens or folder changes
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

// Watch for error messages from parent
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
	
	// In edit mode, if name hasn't changed, just close
	if (isEditMode.value && props.folder && trimmedName === props.folder.name) {
		handleClose();
		return;
	}
	
	isSaving.value = true;
	error.value = null;
	
	// Emit save event with folder name - parent will handle API call
	// Parent will close dialog on success or set errorMessage prop on error
	emit('save', trimmedName);
}
</script>

<template>
	<div
		v-if="modelValue"
		class="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-[1000001]"
		style="pointer-events: auto; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
		@click.self="handleClose"
	>
		<div
			class="w-[90vw] max-w-md bg-background rounded-lg shadow-2xl flex flex-col overflow-hidden border border-white/[0.06]"
			@click.stop
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
				<h2 class="text-xl font-semibold text-white">
					{{ isEditMode ? 'Edit Folder' : 'Create Folder' }}
				</h2>
				<button
					@click="handleClose"
					class="p-1 hover:bg-white/[0.08] rounded transition-colors"
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
						class="text-muted-foreground hover:text-white"
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

				<!-- Folder Name Input -->
				<div class="mb-4">
					<label class="block text-sm text-muted-foreground mb-2">Folder Name</label>
					<input
						v-model="folderName"
						type="text"
						placeholder="Enter folder name..."
						maxlength="100"
						:disabled="isSaving"
						class="w-full px-4 py-2 bg-sidebar border border-white/[0.06] rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						@keydown.enter="handleSave"
						@keydown.esc="handleClose"
					/>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
				<button
					@click="handleClose"
					:disabled="isSaving"
					class="px-4 py-2 text-sm text-muted-foreground hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Cancel
				</button>
				<button
					@click="handleSave"
					:disabled="!canSave"
					:class="[
						'px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors',
						!canSave ? 'opacity-50 cursor-not-allowed' : ''
					]"
				>
					<template v-if="isSaving">
						<span class="flex items-center gap-2">
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="animate-spin"
							>
								<path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
							</svg>
							{{ isEditMode ? 'Saving...' : 'Creating...' }}
						</span>
					</template>
					<template v-else>
						{{ isEditMode ? 'Save' : 'Create' }}
					</template>
				</button>
			</div>
		</div>
	</div>
</template>
