import type { WebinarListItem } from '@/lib/sdc-api-types';

/**
 * "Looking for" / audience icons — same visual language as PeopleCard and profile views:
 * `fa6-solid:person` with blue (#3a97fe) / pink (#ff60df) / gray (trans), overlapping for couples.
 *
 * `summary_int` (6 chars): Couple M/F, Couple F/F, Couple M/M, Single F, Single M, Transgender
 * — matches SpeedDatingCard / GuestListCard `parseInterests`.
 */
export type LookingForIcon =
  | { type: 'couple-group'; icons: Array<{ icon: string; color: string }> }
  | { type: 'single-female' | 'single-male' | 'transgender'; icon: string; color: string };

export function parseSummaryIntToLookingForIcons(summaryInt: string | undefined | null): LookingForIcon[] {
  if (!summaryInt || summaryInt.length < 6) return [];

  const e = summaryInt.split('');
  const icons: LookingForIcon[] = [];

  if (e[0] === '1') {
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#3a97fe' },
        { icon: 'fa6-solid:person', color: '#ff60df' },
      ],
    });
  }

  if (e[1] === '1') {
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#ff60df' },
        { icon: 'fa6-solid:person', color: '#ff60df' },
      ],
    });
  }

  if (e[2] === '1') {
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#3a97fe' },
        { icon: 'fa6-solid:person', color: '#3a97fe' },
      ],
    });
  }

  // Index 3 = single female, 4 = single male (not swapped)
  if (e[3] === '1') {
    icons.push({
      type: 'single-female',
      icon: 'fa6-solid:person',
      color: '#ff60df',
    });
  }

  if (e[4] === '1') {
    icons.push({
      type: 'single-male',
      icon: 'fa6-solid:person',
      color: '#3a97fe',
    });
  }

  if (e[5] === '1') {
    icons.push({
      type: 'transgender',
      icon: 'fa6-solid:person',
      color: '#9ca3af',
    });
  }

  return icons;
}

/** Webinar audience filters → same icon set as member cards (order matches previous hub card). */
export function webinarFiltersToLookingForIcons(w: WebinarListItem): LookingForIcon[] {
  const out: LookingForIcon[] = [];

  if (w.filter_couple === 1) {
    out.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#3a97fe' },
        { icon: 'fa6-solid:person', color: '#ff60df' },
      ],
    });
  }
  if (w.filter_female === 1) {
    out.push({ type: 'single-female', icon: 'fa6-solid:person', color: '#ff60df' });
  }
  if (w.filter_male === 1) {
    out.push({ type: 'single-male', icon: 'fa6-solid:person', color: '#3a97fe' });
  }
  if (w.filter_trans === 1) {
    out.push({ type: 'transgender', icon: 'fa6-solid:person', color: '#9ca3af' });
  }
  if (w.filter_lesbian === 1) {
    out.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#ff60df' },
        { icon: 'fa6-solid:person', color: '#ff60df' },
      ],
    });
  }
  if (w.filter_gay === 1) {
    out.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#3a97fe' },
        { icon: 'fa6-solid:person', color: '#3a97fe' },
      ],
    });
  }

  return out;
}
