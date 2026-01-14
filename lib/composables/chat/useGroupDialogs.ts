import { ref, computed } from 'vue';

interface GroupDialog {
  id: string;
  groupId: string;
  stackLevel: number;
}

const groupDialogs = ref<GroupDialog[]>([]);

export function useGroupDialogs() {
  function openGroupDialog(groupId: string): string {
    const stackLevel = groupDialogs.value.length;
    const id = `group-${groupId}-${Date.now()}-${Math.random()}`;
    
    groupDialogs.value.push({
      id,
      groupId,
      stackLevel,
    });
    
    return id;
  }
  
  function closeGroupDialog(id: string) {
    const index = groupDialogs.value.findIndex(d => d.id === id);
    if (index !== -1) {
      groupDialogs.value.splice(index, 1);
      // Update stack levels for remaining dialogs
      groupDialogs.value.forEach((dialog, i) => {
        dialog.stackLevel = i;
      });
    }
  }
  
  function closeAllGroupDialogs() {
    groupDialogs.value = [];
  }
  
  const hasOpenDialogs = computed(() => groupDialogs.value.length > 0);
  
  return {
    groupDialogs,
    openGroupDialog,
    closeGroupDialog,
    closeAllGroupDialogs,
    hasOpenDialogs,
  };
}
