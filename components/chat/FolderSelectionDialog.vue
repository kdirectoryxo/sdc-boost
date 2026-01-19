<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import type { MessengerFolder } from '@/lib/sdc-api-types';
import { useChatFolders } from '@/lib/composables/chat/useChatFolders';

interface Props {
	modelValue: boolean;
	currentFolderId?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
	currentFolderId: null,
});

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	'select': [folderId: number | null];
}>();

const { folders } = useChatFolders();
const selectedFolderId = ref<number | null>(null);
const error = ref<string | null>(null);

// Initialize selected folder when dialog opens
watch(() => props.modelValue, (isOpen) => {
	if (isOpen) {
		// Set current folder as selected, or null for inbox
		selectedFolderId.value = props.currentFolderId ?? null;
		error.value = null;
	}
});

function handleClose() {
	emit('update:modelValue', false);
	error.value = null;
}

function handleSave() {
	emit('select', selectedFolderId.value);
	handleClose();
}

// Inbox option value (0 or null - using null to represent inbox/no folder)
const inboxValue = null;
</script>

<template>
	<div
		v-if="modelValue"
		class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
		:style="{
			pointerEvents: 'auto',
			zIndex: 10000020,
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			width: '100vw',
			height: '100vh',
			background: 'rgba(0, 0, 0, 0.7)',
			backdropFilter: 'blur(4px)',
			WebkitBackdropFilter: 'blur(4px)',
		}"
		@click.self="handleClose"
	>
		<div
			class="w-[90vw] max-w-md bg-[#1a1a1a] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-[#333]"
			@click.stop
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-[#333]">
				<h2 class="text-xl font-semibold text-white">
					Move to Folder
				</h2>
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

				<!-- Folder Selection -->
				<div class="space-y-2">
					<!-- Inbox Option -->
					<label
						:class="[
							'flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all',
							selectedFolderId === inboxValue
								? 'bg-blue-500/10 border-blue-500/50'
								: 'bg-[#0f0f0f] border-[#333] hover:border-[#444] hover:bg-[#1a1a1a]'
						]"
						@click="selectedFolderId = inboxValue"
					>
						<!-- Custom Radio -->
						<div
							:class="[
								'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
								selectedFolderId === inboxValue
									? 'border-blue-500 bg-blue-500'
									: 'border-[#555] bg-transparent'
							]"
						>
							<div
								v-if="selectedFolderId === inboxValue"
								class="w-2 h-2 rounded-full bg-white"
							></div>
						</div>
						<div class="flex items-center gap-2 flex-1">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999]">
								<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
								<polyline points="22,6 12,13 2,6"></polyline>
							</svg>
							<span class="text-white text-sm">Inbox</span>
						</div>
					</label>

					<!-- Folder Options -->
					<label
						v-for="folder in folders"
						:key="folder.id"
						:class="[
							'flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all',
							selectedFolderId === folder.id
								? 'bg-blue-500/10 border-blue-500/50'
								: 'bg-[#0f0f0f] border-[#333] hover:border-[#444] hover:bg-[#1a1a1a]'
						]"
						@click="selectedFolderId = folder.id"
					>
						<!-- Custom Radio -->
						<div
							:class="[
								'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
								selectedFolderId === folder.id
									? 'border-blue-500 bg-blue-500'
									: 'border-[#555] bg-transparent'
							]"
						>
							<div
								v-if="selectedFolderId === folder.id"
								class="w-2 h-2 rounded-full bg-white"
							></div>
						</div>
						<div class="flex items-center gap-2 flex-1">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999]">
								<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
							</svg>
							<span class="text-white text-sm">{{ folder.name }}</span>
						</div>
					</label>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#333]">
				<button
					@click="handleClose"
					class="px-4 py-2 text-sm text-[#999] hover:text-white transition-colors"
				>
					Cancel
				</button>
				<button
					@click="handleSave"
					class="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
				>
					Move
				</button>
			</div>
		</div>
	</div>
</template>
