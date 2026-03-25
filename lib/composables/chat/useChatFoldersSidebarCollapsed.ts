import { ref, watch } from 'vue';

const STORAGE_KEY = 'sdc-boost.chat-folders-sidebar-collapsed';

function load(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const v = localStorage.getItem(STORAGE_KEY);
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

function save(value: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // quota / private mode
  }
}

/** Persisted collapse state for the chat folders rail (icon vs labels). */
export function useChatFoldersSidebarCollapsed() {
  const collapsed = ref(load());

  watch(collapsed, (v) => {
    save(v);
  });

  return { collapsed };
}
