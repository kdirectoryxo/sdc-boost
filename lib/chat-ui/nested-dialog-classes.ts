/**
 * Stacking above {@link ChatDialog} shell (~999999) so nested modals stay visible.
 */
export const CHAT_NESTED_DIALOG_OVERLAY_CLASS =
  '!z-[10000010] bg-black/80 backdrop-blur-sm';

export const CHAT_NESTED_DIALOG_CONTENT_CLASS =
  '!z-[10000010] max-h-[90vh] gap-0 border border-white/[0.06] p-0 shadow-2xl sm:max-w-lg';

export function chatProfileDialogZIndex(stackLevel: number): number {
  return 10000011 + stackLevel * 10;
}

/** Stacking above {@link CHAT_NESTED_DIALOG_CONTENT_CLASS} (e.g. TagEditDialog on top of TagDialog). */
export const CHAT_SUBDIALOG_OVERLAY_CLASS =
  '!z-[10000050] bg-black/80 backdrop-blur-sm';

export const CHAT_SUBDIALOG_CONTENT_CLASS =
  '!z-[10000050] max-h-[90vh] gap-0 border border-white/[0.06] p-0 shadow-2xl sm:max-w-lg';
