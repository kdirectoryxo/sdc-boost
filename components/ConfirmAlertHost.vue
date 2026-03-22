<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { ConfirmOptions } from '@/lib/confirm';
import { pushVueConfirmHandler } from '@/lib/confirm';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/lib/view-router/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  CHAT_SUBDIALOG_OVERLAY_CLASS,
  CHAT_SUBDIALOG_CONTENT_CLASS,
} from '@/lib/chat-ui/nested-dialog-classes';

const open = ref(false);
const message = ref('');
const confirmLabel = ref('Yes');
const cancelLabel = ref('No');
let resolvePromise: ((v: boolean) => void) | null = null;

function runConfirm(msg: string, options?: ConfirmOptions): Promise<boolean> {
  message.value = msg;
  confirmLabel.value = options?.confirmText ?? 'Yes';
  cancelLabel.value = options?.cancelText ?? 'No';
  open.value = true;
  return new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  });
}

function onOpenChange(v: boolean) {
  open.value = v;
  if (!v && resolvePromise) {
    resolvePromise(false);
    resolvePromise = null;
  }
}

function handleConfirm() {
  const r = resolvePromise;
  resolvePromise = null;
  open.value = false;
  r?.(true);
}

let unregister: (() => void) | null = null;

onMounted(() => {
  unregister = pushVueConfirmHandler(runConfirm);
});

onUnmounted(() => {
  unregister?.();
  unregister = null;
});
</script>

<template>
  <AlertDialog :open="open" @update:open="onOpenChange">
    <AlertDialogContent :class="cn(CHAT_SUBDIALOG_CONTENT_CLASS, '!max-w-md gap-4 border border-white/[0.06] p-6')">
      <AlertDialogHeader>
        <AlertDialogTitle class="text-left text-white">Confirm</AlertDialogTitle>
      </AlertDialogHeader>
      <p class="text-sm text-muted-foreground whitespace-pre-wrap">{{ message }}</p>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ cancelLabel }}</AlertDialogCancel>
        <AlertDialogAction @click="handleConfirm">{{ confirmLabel }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
