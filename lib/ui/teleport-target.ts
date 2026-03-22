import type { InjectionKey, Ref } from 'vue';

/**
 * Where to teleport floating UI (Tooltip, DropdownMenu, etc.) so layers stay
 * inside the same shadow root as the app and keep Tailwind / theme styles.
 * Falls back to `body` when not provided (e.g. non-extension or tests).
 */
export const UI_TELEPORT_TARGET: InjectionKey<Ref<HTMLElement | null>> =
  Symbol('uiTeleportTarget');
