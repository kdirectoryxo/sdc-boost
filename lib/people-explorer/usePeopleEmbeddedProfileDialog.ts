import { ref } from 'vue';

/**
 * Profile dialog stack used only by the legacy {@link PeopleDialog} overlay.
 * When People is fully on the view router, this can be removed along with {@link PeopleDialog}.
 */
export function usePeopleEmbeddedProfileDialog() {
  const profileDialogVisible = ref(false);
  const profileDialogUserId = ref<number | null>(null);
  const profileDialogStack = ref<number[]>([]);

  function openProfile(userId: number) {
    profileDialogUserId.value = userId;
    profileDialogVisible.value = true;
  }

  function handleOpenNestedProfile(userId: number) {
    if (profileDialogUserId.value !== null) {
      profileDialogStack.value.push(profileDialogUserId.value);
    }
    profileDialogUserId.value = userId;
  }

  function closeProfileDialog() {
    if (profileDialogStack.value.length > 0) {
      profileDialogUserId.value = profileDialogStack.value.pop()!;
    } else {
      profileDialogVisible.value = false;
      profileDialogUserId.value = null;
    }
  }

  return {
    profileDialogVisible,
    profileDialogUserId,
    profileDialogStack,
    openProfile,
    handleOpenNestedProfile,
    closeProfileDialog,
  };
}
