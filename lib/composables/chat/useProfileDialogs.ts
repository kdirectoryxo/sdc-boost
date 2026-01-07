import { ref, computed } from 'vue';

interface ProfileDialog {
  id: string;
  userId: number;
  stackLevel: number;
}

const profileDialogs = ref<ProfileDialog[]>([]);

export function useProfileDialogs() {
  function openProfileDialog(userId: number): string {
    const stackLevel = profileDialogs.value.length;
    const id = `profile-${userId}-${Date.now()}-${Math.random()}`;
    
    profileDialogs.value.push({
      id,
      userId,
      stackLevel,
    });
    
    return id;
  }
  
  function closeProfileDialog(id: string) {
    const index = profileDialogs.value.findIndex(d => d.id === id);
    if (index !== -1) {
      profileDialogs.value.splice(index, 1);
      // Update stack levels for remaining dialogs
      profileDialogs.value.forEach((dialog, i) => {
        dialog.stackLevel = i;
      });
    }
  }
  
  function closeAllProfileDialogs() {
    profileDialogs.value = [];
  }
  
  const hasOpenDialogs = computed(() => profileDialogs.value.length > 0);
  
  return {
    profileDialogs,
    openProfileDialog,
    closeProfileDialog,
    closeAllProfileDialogs,
    hasOpenDialogs,
  };
}


