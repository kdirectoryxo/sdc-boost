<script lang="ts" setup>
import { ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import type { MessengerFolder } from '@/lib/sdc-api-types';
import { useChatFolders } from '@/lib/composables/chat/useChatFolders';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/lib/view-router/ui/dialog';
import { Button } from '@/lib/view-router/ui/button';
import { ScrollArea } from '@/lib/view-router/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
	CHAT_NESTED_DIALOG_OVERLAY_CLASS,
	CHAT_NESTED_DIALOG_CONTENT_CLASS,
} from '@/lib/chat-ui/nested-dialog-classes';

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

watch(() => props.modelValue, (isOpen) => {
	if (isOpen) {
		selectedFolderId.value = props.currentFolderId ?? null;
		error.value = null;
	}
});

function handleClose() {
	emit('update:modelValue', false);
	error.value = null;
}

function onOpenChange(open: boolean) {
	if (!open) {
		handleClose();
	}
}

function handleSave() {
	emit('select', selectedFolderId.value);
	handleClose();
}

const inboxValue = null;
</script>

<template>
	<Dialog :open="modelValue" @update:open="onOpenChange">
		<DialogContent
			:show-close-button="false"
			:overlay-class="CHAT_NESTED_DIALOG_OVERLAY_CLASS"
			:class="
				cn(
					CHAT_NESTED_DIALOG_CONTENT_CLASS,
					'!max-w-md !w-[90vw] flex max-h-[min(90vh,600px)] flex-col overflow-hidden rounded-lg bg-background',
				)
			"
		>
			<DialogHeader class="flex-row items-center justify-between space-y-0 border-b border-white/[0.06] px-6 py-4 text-left">
				<DialogTitle class="text-xl font-semibold text-white"> Move to Folder </DialogTitle>
				<Button variant="ghost" size="icon" class="shrink-0" title="Close" @click="handleClose">
					<X class="size-5 text-muted-foreground" />
				</Button>
			</DialogHeader>

			<ScrollArea class="min-h-0 flex-1 px-6">
				<div class="py-6">
					<div v-if="error" class="mb-4 rounded border border-red-500/50 bg-red-500/20 p-3 text-sm text-red-400">
						{{ error }}
					</div>

					<div class="space-y-2">
						<label
							:class="[
								'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all',
								selectedFolderId === inboxValue
									? 'border-blue-500/50 bg-blue-500/10'
									: 'border-white/[0.06] bg-sidebar hover:border-white/[0.10] hover:bg-background',
							]"
							@click="selectedFolderId = inboxValue"
						>
							<div
								:class="[
									'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
									selectedFolderId === inboxValue
										? 'border-blue-500 bg-blue-500'
										: 'border-white/[0.10] bg-transparent',
								]"
							>
								<div v-if="selectedFolderId === inboxValue" class="h-2 w-2 rounded-full bg-white" />
							</div>
							<div class="flex flex-1 items-center gap-2">
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
									<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
									<polyline points="22,6 12,13 2,6" />
								</svg>
								<span class="text-sm text-white">Inbox</span>
							</div>
						</label>

						<label
							v-for="folder in folders"
							:key="folder.id"
							:class="[
								'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all',
								selectedFolderId === folder.id
									? 'border-blue-500/50 bg-blue-500/10'
									: 'border-white/[0.06] bg-sidebar hover:border-white/[0.10] hover:bg-background',
							]"
							@click="selectedFolderId = folder.id"
						>
							<div
								:class="[
									'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
									selectedFolderId === folder.id
										? 'border-blue-500 bg-blue-500'
										: 'border-white/[0.10] bg-transparent',
								]"
							>
								<div v-if="selectedFolderId === folder.id" class="h-2 w-2 rounded-full bg-white" />
							</div>
							<div class="flex flex-1 items-center gap-2">
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
									<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
								</svg>
								<span class="text-sm text-white">{{ folder.name }}</span>
							</div>
						</label>
					</div>
				</div>
			</ScrollArea>

			<DialogFooter class="border-t border-white/[0.06] px-6 py-4 sm:justify-end">
				<Button variant="ghost" @click="handleClose">Cancel</Button>
				<Button @click="handleSave">Move</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
</template>
