import {
  getPeopleTabFromBoostPath,
  getPeopleTabFromBoostPathOrDefault,
  getProfileUserIdFromBoostPath,
  isChatBoostPath,
  isDashboardBoostPath,
  type PeopleTabId,
  VIEW_ROUTER_DEFAULT_PATH,
} from '@/lib/view-router/routes';

const LAST_PEOPLE_PATH_KEY = 'sdc_boost_vr_last_people_path';

export type SdcHubBreadcrumbItem = {
  label: string;
  /** Boost path segment (e.g. `/sdc/online`); omit on the current page crumb */
  to?: string;
};

/** Dutch labels aligned with `NavMain.vue`. */
export const PEOPLE_TAB_LABELS: Record<PeopleTabId, string> = {
  online: 'Online',
  viewed: 'Bekeken',
  latest: 'Nieuwe leden',
  featured: 'Spotlight leden',
};

function normalizeBoostPathSegment(path: string): string {
  return path.split('?')[0].replace(/\/$/, '') || '/';
}

/**
 * Remember the last people-list path so profile breadcrumbs can link “back” to the right tab.
 */
export function rememberLastPeopleTabPath(path: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const n = normalizeBoostPathSegment(path);
  if (getProfileUserIdFromBoostPath(path) != null) return;
  if (getPeopleTabFromBoostPath(path) == null) return;
  try {
    sessionStorage.setItem(LAST_PEOPLE_PATH_KEY, n);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getLastPeopleTabBoostPath(): string {
  if (typeof sessionStorage === 'undefined') return VIEW_ROUTER_DEFAULT_PATH;
  try {
    const raw = sessionStorage.getItem(LAST_PEOPLE_PATH_KEY);
    if (!raw || raw.trim() === '') return VIEW_ROUTER_DEFAULT_PATH;
    const p = raw.trim().startsWith('/') ? raw.trim() : `/${raw.trim()}`;
    if (getPeopleTabFromBoostPath(p) == null) return VIEW_ROUTER_DEFAULT_PATH;
    return normalizeBoostPathSegment(p);
  } catch {
    return VIEW_ROUTER_DEFAULT_PATH;
  }
}

/**
 * Breadcrumb trail for SDC Hub (people list + profile).
 */
export function buildSdcHubBreadcrumbs(
  boostPath: string,
  options?: { profileTitle?: string | null }
): SdcHubBreadcrumbItem[] {
  const profileId = getProfileUserIdFromBoostPath(boostPath);

  if (profileId != null) {
    const parentPath = getLastPeopleTabBoostPath();
    const parentTab = getPeopleTabFromBoostPathOrDefault(parentPath);
    const parentLabel = PEOPLE_TAB_LABELS[parentTab];
    const title =
      options?.profileTitle?.trim() ||
      `Profiel #${profileId}`;
    return [
      { label: 'SDC Hub', to: VIEW_ROUTER_DEFAULT_PATH },
      { label: parentLabel, to: parentPath },
      { label: title },
    ];
  }

  const tab = getPeopleTabFromBoostPath(boostPath);
  if (tab != null) {
    return [{ label: 'SDC Hub', to: VIEW_ROUTER_DEFAULT_PATH }, { label: PEOPLE_TAB_LABELS[tab] }];
  }

  if (isChatBoostPath(boostPath)) {
    return [{ label: 'SDC Hub', to: VIEW_ROUTER_DEFAULT_PATH }, { label: 'Chat' }];
  }

  if (isDashboardBoostPath(boostPath)) {
    return [{ label: 'SDC Hub', to: VIEW_ROUTER_DEFAULT_PATH }, { label: 'Dashboard' }];
  }

  return [{ label: 'SDC Hub', to: VIEW_ROUTER_DEFAULT_PATH }, { label: 'People' }];
}
