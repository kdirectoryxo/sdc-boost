import type { WebinarListItem } from '@/lib/sdc-api-types';

export function getWebinarCategoryLine(w: WebinarListItem): string {
  const parts: string[] = [];
  const biz = w.business_type?.trim();
  if (biz) parts.push(biz);
  const subs = w.biz_type_subcategories?.filter((s) => s && String(s).trim());
  if (subs?.length) parts.push(...subs.map((s) => String(s).trim()));
  return parts.join(' · ');
}

export function formatWebinarWhen(w: WebinarListItem): string {
  if (w.date_str?.trim()) return w.date_str.trim();
  if (w.dateFromLocTime) {
    try {
      const d = new Date(w.dateFromLocTime);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      }
    } catch {
      /* ignore */
    }
  }
  return '';
}

/**
 * Guest / interest counts — API exposes both; prefer the main guest counter when present.
 */
export function getWebinarPeopleCount(w: WebinarListItem): number | null {
  if (typeof w.GuestListCounter === 'number') return w.GuestListCounter;
  if (typeof w.GuestListCounterAll === 'number') return w.GuestListCounterAll;
  return null;
}
