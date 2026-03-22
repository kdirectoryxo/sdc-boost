<script lang="ts" setup>
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/lib/view-router/ui/dialog';
import { Button } from '@/lib/view-router/ui/button';
import { cn } from '@/lib/utils';
import {
  CHAT_NESTED_DIALOG_OVERLAY_CLASS,
  CHAT_NESTED_DIALOG_CONTENT_CLASS,
} from '@/lib/chat-ui/nested-dialog-classes';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'select': [choice: 'sync-unsynced' | 'resync-all' | 'resync-newest' | 'sync-profiles' | 'sync-profiles-reset'];
}>();

function handleClose() {
  emit('update:modelValue', false);
}

function onOpenChange(open: boolean) {
  if (!open) {
    handleClose();
  }
}

function handleSelect(choice: 'sync-unsynced' | 'resync-all' | 'resync-newest' | 'sync-profiles' | 'sync-profiles-reset') {
  emit('select', choice);
  handleClose();
}

function handleSyncProfiles(event: MouseEvent) {
  const reset = event.shiftKey;
  handleSelect(reset ? 'sync-profiles-reset' : 'sync-profiles');
}
</script>

<template>
  <Dialog :open="props.modelValue" @update:open="onOpenChange">
    <DialogContent
      :show-close-button="false"
      :overlay-class="CHAT_NESTED_DIALOG_OVERLAY_CLASS"
      :class="
        cn(
          CHAT_NESTED_DIALOG_CONTENT_CLASS,
          '!max-w-[500px] !min-w-[min(400px,90vw)] flex flex-col overflow-hidden rounded-lg bg-background',
        )
      "
    >
      <DialogHeader class="border-b border-white/[0.06] px-6 py-4 text-left">
        <DialogTitle class="text-lg font-semibold text-white">Sync All Chat</DialogTitle>
        <DialogDescription class="mt-1 text-sm text-muted-foreground">
          Choose how you want to sync chats
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-2 p-4">
        <button
          type="button"
          class="group w-full cursor-pointer rounded-lg border border-white/[0.06] bg-sidebar px-4 py-3 text-left transition-all duration-150 hover:bg-secondary active:scale-[0.98] active:bg-white/[0.08]"
          @click="handleSelect('sync-unsynced')"
        >
          <div class="mb-1 font-medium text-white">Sync unsynced</div>
          <div class="text-sm text-muted-foreground">Sync all chats that have no sync date</div>
        </button>

        <button
          type="button"
          class="group w-full cursor-pointer rounded-lg border border-white/[0.06] bg-sidebar px-4 py-3 text-left transition-all duration-150 hover:bg-secondary active:scale-[0.98] active:bg-white/[0.08]"
          @click="handleSelect('resync-all')"
        >
          <div class="mb-1 font-medium text-white">Resync all</div>
          <div class="text-sm text-muted-foreground">Force resync all chats (all pages)</div>
        </button>

        <button
          type="button"
          class="group w-full cursor-pointer rounded-lg border border-white/[0.06] bg-sidebar px-4 py-3 text-left transition-all duration-150 hover:bg-secondary active:scale-[0.98] active:bg-white/[0.08]"
          @click="handleSelect('resync-newest')"
        >
          <div class="mb-1 font-medium text-white">Resync newest</div>
          <div class="text-sm text-muted-foreground">Force resync first page of all chats</div>
        </button>

        <button
          type="button"
          class="group w-full cursor-pointer rounded-lg border border-white/[0.06] bg-sidebar px-4 py-3 text-left transition-all duration-150 hover:bg-secondary active:scale-[0.98] active:bg-white/[0.08]"
          @click="handleSyncProfiles"
        >
          <div class="mb-1 font-medium text-white">Sync Profile Data</div>
          <div class="text-sm text-muted-foreground">
            Sync profile data for chats (hold Shift to reset and resync all)
          </div>
        </button>
      </div>

      <DialogFooter class="border-t border-white/[0.06] px-6 py-4 sm:justify-end">
        <Button variant="ghost" @click="handleClose">Cancel</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
