import {
  getPeopleTabFromBoostPath,
  getPeopleTabFromBoostPathOrDefault,
  getProfileUserIdFromBoostPath,
  isChatBoostPath,
  isDashboardBoostPath,
  isHubLiveAreaBoostPath,
  isLiveChatroomBoostPath,
  isLiveStreamBoostPath,
  isSpeedDateBoostPath,
  isWebinarsBoostPath,
  type PeopleTabId,
  VIEW_ROUTER_DEFAULT_PATH,
} from '@/lib/view-router/routes';

const LAST_PEOPLE_PATH_KEY = 'sdc_boost_vr_last_people_path';

/** Remembers the last hub “list” view (people tab or live hub pages) for profile breadcrumbs. */
const LAST_HUB_LIST_PATH_KEY = 'sdc_boost_vr_last_hub_list_path';

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

/**
 * Remember any hub list path (people explorer tabs or live hub pages) for profile parent links.
 */
export function rememberHubListPath(path: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const n = normalizeBoostPathSegment(path);
  if (getProfileUserIdFromBoostPath(path) != null) return;
  const isPeople = getPeopleTabFromBoostPath(path) != null;
  const isLiveHub = isHubLiveAreaBoostPath(path);
  const isSpeedDate = isSpeedDateBoostPath(path);
  if (!isPeople && !isLiveHub && !isSpeedDate) return;
  try {
    sessionStorage.setItem(LAST_HUB_LIST_PATH_KEY, n);
  } catch {
    /* ignore */
  }
}

function getLastHubListPathForProfile(): string {
  if (typeof sessionStorage === 'undefined') return VIEW_ROUTER_DEFAULT_PATH;
  try {
    const raw = sessionStorage.getItem(LAST_HUB_LIST_PATH_KEY);
    if (!raw || raw.trim() === '') return getLastPeopleTabBoostPath();
    const p = raw.trim().startsWith('/') ? raw.trim() : `/${raw.trim()}`;
    const n = normalizeBoostPathSegment(p);
    if (
      getPeopleTabFromBoostPath(n) != null ||
      isHubLiveAreaBoostPath(n) ||
      isSpeedDateBoostPath(n)
    ) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return getLastPeopleTabBoostPath();
}

function hubListLabelForPath(path: string): string {
  if (isLiveStreamBoostPath(path)) {
    return 'Live';
  }
  if (isLiveChatroomBoostPath(path)) {
    return 'Chatroom';
  }
  if (isWebinarsBoostPath(path)) {
    return 'Webinars';
  }
  if (isSpeedDateBoostPath(path)) {
    return 'Speed Date';
  }
  const tab = getPeopleTabFromBoostPathOrDefault(path);
  return PEOPLE_TAB_LABELS[tab];
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
    const parentPath = getLastHubListPathForProfile();
    const parentLabel = hubListLabelForPath(parentPath);
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

  if (isLiveStreamBoostPath(boostPath)) {
    return [{ label: 'SDC Hub', to: VIEW_ROUTER_DEFAULT_PATH }, { label: 'Live' }];
  }

  if (isLiveChatroomBoostPath(boostPath)) {
    return [{ label: 'SDC Hub', to: VIEW_ROUTER_DEFAULT_PATH }, { label: 'Chatroom' }];
  }

  if (isWebinarsBoostPath(boostPath)) {
    return [{ label: 'SDC Hub', to: VIEW_ROUTER_DEFAULT_PATH }, { label: 'Webinars' }];
  }

  if (isSpeedDateBoostPath(boostPath)) {
    return [{ label: 'SDC Hub', to: VIEW_ROUTER_DEFAULT_PATH }, { label: 'Speed Date' }];
  }

  return [{ label: 'SDC Hub', to: VIEW_ROUTER_DEFAULT_PATH }, { label: 'People' }];
}
