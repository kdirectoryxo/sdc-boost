<script lang="ts" setup>
/** Modal shell around `ProfileView`. Prefer `/sdc/profile/:userId` in the view router when possible. */
import { computed } from 'vue';
import ProfileView from '@/components/profile-view/ProfileView.vue';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/lib/view-router/ui/dialog';
import { cn } from '@/lib/utils';
import { CHAT_NESTED_DIALOG_CONTENT_CLASS, chatProfileDialogZIndex } from '@/lib/chat-ui/nested-dialog-classes';

interface Props {
  visible: boolean;
  userId: number | null;
  stackLevel?: number;
  dialogId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  stackLevel: 0,
  dialogId: '',
});

const emit = defineEmits<{
  close: [];
  'open-profile': [userId: number];
}>();

const zIndex = computed(() => chatProfileDialogZIndex(props.stackLevel));

function handleBackdropClose() {
  emit('close');
}

function onOpenChange(open: boolean) {
  if (!open) {
    handleBackdropClose();
  }
}
</script>

<template>
  <Dialog :open="visible" @update:open="onOpenChange">
    <DialogContent
      :show-close-button="false"
      overlay-class="bg-black/80 backdrop-blur-sm"
      :overlay-style="{ zIndex: zIndex }"
      :style="{ zIndex: zIndex }"
      :class="
        cn(
          CHAT_NESTED_DIALOG_CONTENT_CLASS,
          '!flex !h-[90vh] !w-[80vw] !max-w-6xl flex-col overflow-hidden border-0 bg-transparent p-0 shadow-none',
        )
      "
    >
      <DialogTitle class="sr-only">Profiel</DialogTitle>
      <DialogDescription class="sr-only">Profielweergave.</DialogDescription>
      <div
        class="flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/[0.06] bg-background shadow-2xl"
        @click.stop
      >
        <ProfileView
          v-if="userId"
          :user-id="userId"
          :active="visible"
          variant="dialog"
          :stack-level="stackLevel"
          :dialog-id="dialogId"
          @close="emit('close')"
          @open-profile="emit('open-profile', $event)"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
