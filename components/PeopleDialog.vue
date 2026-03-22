<script lang="ts" setup>
import { ref, computed } from 'vue';
import PeopleDialogShell from '@/components/people-explorer/PeopleDialogShell.vue';
import PeopleExplorerPanel from '@/components/people-explorer/PeopleExplorerPanel.vue';
import ProfileDialog from './chat/ProfileDialog.vue';
import { usePeopleExplorerState, usePeopleEmbeddedProfileDialog } from '@/lib/people-explorer';
import type { PeopleTabId } from '@/lib/view-router/routes';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const activeTab = ref<PeopleTabId>('viewed');
const { viewedCount } = usePeopleExplorerState();

const {
  profileDialogVisible,
  profileDialogUserId,
  profileDialogStack,
  openProfile,
  handleOpenNestedProfile,
  closeProfileDialog,
} = usePeopleEmbeddedProfileDialog();

defineExpose({
  openProfile,
});

function handleClose() {
  isOpen.value = false;
  emit('close');
}

function handleTabChange(tab: PeopleTabId) {
  activeTab.value = tab;
}
</script>

<template>
  <PeopleDialogShell
    :model-value="isOpen"
    :active-tab="activeTab"
    :viewed-count="viewedCount"
    @close="handleClose"
    @tab-change="handleTabChange"
  >
    <PeopleExplorerPanel :active-tab="activeTab" />
    <template #after>
      <ProfileDialog
        :visible="profileDialogVisible"
        :user-id="profileDialogUserId"
        :stack-level="profileDialogStack.length"
        @close="closeProfileDialog"
        @open-profile="handleOpenNestedProfile"
      />
    </template>
  </PeopleDialogShell>
</template>
