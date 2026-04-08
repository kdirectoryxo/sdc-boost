/**
 * Routes for the SDC Boost View Router (full-page UI on sdc.com/react).
 *
 * The site’s SPA owns the hash (`#/…`). In-app Boost navigation uses a **query param**
 * (`sdc_boost_vr=`) so React/Vue routers don’t intercept our routes. Hash-only URLs are still
 * supported for bookmarks and older links.
 */

/** Query key for Boost view path (e.g. `?sdc_boost_vr=/sdc/online`). */
export const BOOST_VR_SEARCH_PARAM = 'sdc_boost_vr';

/** Legacy: Boost home path (bare `/sdc`). */
export const VIEW_ROUTER_HOME_PATH = '/sdc';

/** Hub home: main dashboard (`/sdc/dashboard`). */
export const VIEW_ROUTER_HUB_DASHBOARD_PATH = '/sdc/dashboard';

/** @deprecated Use {@link VIEW_ROUTER_HUB_DASHBOARD_PATH}. Kept for legacy `getViewRouterViewId`. */
export const VIEW_ROUTER_DASHBOARD_PATH = VIEW_ROUTER_HUB_DASHBOARD_PATH;

/** People explorer tabs (aligned with `PeopleExplorerPanel` / `PeopleTabId`). */
export type PeopleTabId = 'online' | 'viewed' | 'latest' | 'featured';

export const VIEW_ROUTER_PEOPLE_ONLINE_PATH = '/sdc/online';
export const VIEW_ROUTER_PEOPLE_VISUALLY_PATH = '/sdc/visually';
export const VIEW_ROUTER_PEOPLE_FIELD_PATH = '/sdc/field';
export const VIEW_ROUTER_PEOPLE_SPOTLIGHT_PATH = '/sdc/spotlight';

/** Hub messenger (full-page chat workspace). */
export const VIEW_ROUTER_CHAT_PATH = '/sdc/chat';

/** Hub: live voyeur streams (`/sdc/live`). */
export const VIEW_ROUTER_HUB_LIVE_STREAM_PATH = '/sdc/live';

/** Hub: chatroom list (`/sdc/live-chatroom`). */
export const VIEW_ROUTER_HUB_LIVE_CHATROOM_PATH = '/sdc/live-chatroom';

/** Hub: webinars (`/sdc/webinars`). */
export const VIEW_ROUTER_HUB_WEBINARS_PATH = '/sdc/webinars';

/** Hub: speed dating list (`/sdc/speed-date`). */
export const VIEW_ROUTER_HUB_SPEED_DATE_PATH = '/sdc/speed-date';

/** Member profile (view-router page, not the legacy modal). */
export const VIEW_ROUTER_PROFILE_PREFIX = '/sdc/profile/';

/** Default full-page Boost view: Hub Dashboard. */
export const VIEW_ROUTER_DEFAULT_PATH = VIEW_ROUTER_HUB_DASHBOARD_PATH;

/**
 * Build the Boost path for a profile page (`/sdc/profile/:userId`).
 */
export function getBoostProfilePath(userId: number): string {
  return `${VIEW_ROUTER_PROFILE_PREFIX}${userId}`;
}

/**
 * Parse `/sdc/profile/123` → `123`, or `null` if not a profile route.
 */
/**
 * True when the Boost path is the hub chat page (`/sdc/chat`).
 */
export function isChatBoostPath(path: string): boolean {
  return normalizeBoostPathSegment(path) === VIEW_ROUTER_CHAT_PATH;
}

/**
 * True when the Boost path is the Hub dashboard (`/sdc/dashboard`), including legacy `/sdc` home.
 */
export function isDashboardBoostPath(path: string): boolean {
  const n = normalizeBoostPathSegment(path);
  return (
    n === VIEW_ROUTER_HUB_DASHBOARD_PATH || n === VIEW_ROUTER_HOME_PATH
  );
}

export function isLiveStreamBoostPath(path: string): boolean {
  return normalizeBoostPathSegment(path) === VIEW_ROUTER_HUB_LIVE_STREAM_PATH;
}

export function isLiveChatroomBoostPath(path: string): boolean {
  return normalizeBoostPathSegment(path) === VIEW_ROUTER_HUB_LIVE_CHATROOM_PATH;
}

export function isWebinarsBoostPath(path: string): boolean {
  return normalizeBoostPathSegment(path) === VIEW_ROUTER_HUB_WEBINARS_PATH;
}

export function isSpeedDateBoostPath(path: string): boolean {
  return normalizeBoostPathSegment(path) === VIEW_ROUTER_HUB_SPEED_DATE_PATH;
}

/** Live hub area: voyeur list, chatrooms, or webinars (for breadcrumbs / “last list” memory). */
export function isHubLiveAreaBoostPath(path: string): boolean {
  return (
    isLiveStreamBoostPath(path) ||
    isLiveChatroomBoostPath(path) ||
    isWebinarsBoostPath(path)
  );
}

export function getProfileUserIdFromBoostPath(path: string): number | null {
  const n = normalizeBoostPathSegment(path);
  if (!n.startsWith(VIEW_ROUTER_PROFILE_PREFIX)) {
    return null;
  }
  const rest = n.slice(VIEW_ROUTER_PROFILE_PREFIX.length);
  const idPart = rest.split('/')[0] ?? '';
  const id = parseInt(idPart, 10);
  if (Number.isNaN(id) || id <= 0) {
    return null;
  }
  return id;
}

const PEOPLE_PATH_TO_TAB: Record<string, PeopleTabId> = {
  [VIEW_ROUTER_PEOPLE_ONLINE_PATH]: 'online',
  [VIEW_ROUTER_PEOPLE_VISUALLY_PATH]: 'viewed',
  [VIEW_ROUTER_PEOPLE_FIELD_PATH]: 'latest',
  [VIEW_ROUTER_PEOPLE_SPOTLIGHT_PATH]: 'featured',
};

function normalizeBoostPathSegment(path: string): string {
  return path.split('?')[0].replace(/\/$/, '') || '/';
}

/**
 * Legacy Boost hash home (`#/sdc` → `/sdc`) is the same as {@link VIEW_ROUTER_DEFAULT_PATH} (Hub dashboard).
 */
export function normalizeLegacyBoostHomeToDashboard(path: string): string {
  const n = normalizeBoostPathSegment(path);
  return n === VIEW_ROUTER_HOME_PATH ? VIEW_ROUTER_DEFAULT_PATH : path;
}

/**
 * True when the full-page View Router should be shown: `/sdc`, nested routes like `/sdc/online`,
 * or legacy paths whose last segment is `sdc` (e.g. `#/react/sdc`).
 * Declared before session snapshot helpers that validate paths.
 */
export function isViewRouterActiveRoute(path: string): boolean {
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/';
  if (normalized === '/sdc' || normalized.startsWith('/sdc/')) {
    return true;
  }
  const segments = normalized.split('/').filter(Boolean);
  return segments.length > 0 && segments[segments.length - 1] === 'sdc';
}

/**
 * The React SPA often calls `history.replaceState` and drops unknown query params like
 * `sdc_boost_vr` before our Vue shell reads the URL. We snapshot the path from the query
 * (see {@link persistBoostPathFromCurrentLocationEarly} at document_start) and fall back
 * here when the param is missing so deep links like `?sdc_boost_vr=/sdc/chat` still work.
 */
const BOOST_PATH_SESSION_KEY = 'sdc_boost_vr_path_snapshot';

function persistBoostPathSnapshot(path: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const n = normalizeBoostPathSegment(path);
  if (!isViewRouterActiveRoute(n)) return;
  try {
    sessionStorage.setItem(BOOST_PATH_SESSION_KEY, n);
  } catch {
    /* quota / private mode */
  }
}

function readBoostPathSnapshot(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(BOOST_PATH_SESSION_KEY);
    if (raw == null || raw.trim() === '') return null;
    const n = normalizeBoostPathSegment(raw);
    if (!isViewRouterActiveRoute(n)) return null;
    return n;
  } catch {
    return null;
  }
}

function clearBoostPathSnapshot(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(BOOST_PATH_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Call from `document_start` (e.g. view-router prehide) before the host SPA can strip
 * `sdc_boost_vr` from the URL.
 */
export function persistBoostPathFromCurrentLocationEarly(): void {
  if (typeof location === 'undefined') return;
  try {
    const u = new URL(location.href);
    const fromQuery = u.searchParams.get(BOOST_VR_SEARCH_PARAM);
    if (fromQuery != null && fromQuery.trim() !== '') {
      const p = fromQuery.trim().split('?')[0];
      if (p === '') return;
      const path = p.startsWith('/') ? p : `/${p}`;
      persistBoostPathSnapshot(path);
    }
  } catch {
    /* ignore invalid URL */
  }
}

/**
 * Build the URL object for a Boost view path (query param + cleared hash).
 * Does not mutate browser history.
 */
function buildBoostViewRouterUrlObject(path: string): URL {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const u = new URL(location.href);
  u.searchParams.set(BOOST_VR_SEARCH_PARAM, normalized);
  u.hash = '';
  return u;
}

/**
 * Map Boost path to a People tab, or `null` if the path is not one of the four people routes
 * (e.g. legacy `/sdc`, `/sdc/dashboard`).
 */
export function getPeopleTabFromBoostPath(path: string): PeopleTabId | null {
  const n = normalizeBoostPathSegment(path);
  return PEOPLE_PATH_TO_TAB[n] ?? null;
}

export function getPeopleTabFromBoostPathOrDefault(path: string): PeopleTabId {
  return getPeopleTabFromBoostPath(path) ?? 'online';
}

/** @deprecated Prefer getPeopleTabFromBoostPath; kept for any external imports. */
export type ViewRouterViewId = 'online' | 'dashboard';

/** @deprecated Legacy Online vs Dashboard split; use people paths instead. */
export function getViewRouterViewId(path: string): ViewRouterViewId {
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/';
  if (normalized === VIEW_ROUTER_DASHBOARD_PATH || normalized.endsWith(VIEW_ROUTER_DASHBOARD_PATH)) {
    return 'dashboard';
  }
  return 'online';
}

/**
 * Hash + pathname only (no query param, no session snapshot). Used to detect the host SPA route
 * so we do not resurrect a stale snapshot on e.g. `#/init` after leaving Boost.
 */
function getBoostPathFromHashOrPathname(): string {
  if (typeof location === 'undefined') {
    return '/';
  }

  const hash = location.hash;
  if (hash && hash.length > 1) {
    const raw = hash.slice(1);
    const path = raw.split('?')[0] || '/';
    if (path === '') return '/';
    return path.startsWith('/') ? path : `/${path}`;
  }

  const normalized =
    (location.pathname || '/').replace(/\/+$/, '') || '/';
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length > 0 && segments[segments.length - 1] === 'sdc') {
    return '/sdc';
  }

  return '/';
}

/**
 * Current Boost path: **query param first** (avoids SPA hash router), then hash/pathname when they
 * identify a Boost or non-Boost route; **session snapshot** only when the URL is ambiguous (`/`)
 * after the host strips `sdc_boost_vr` without updating the hash.
 */
export function getBoostViewPathFromLocation(): string {
  if (typeof location === 'undefined') {
    return '/';
  }

  try {
    const u = new URL(location.href);
    const fromQuery = u.searchParams.get(BOOST_VR_SEARCH_PARAM);
    if (fromQuery != null && fromQuery.trim() !== '') {
      const p = fromQuery.trim().split('?')[0];
      if (p === '') return '/';
      const path = p.startsWith('/') ? p : `/${p}`;
      const out = normalizeLegacyBoostHomeToDashboard(path);
      persistBoostPathSnapshot(out);
      return out;
    }
  } catch {
    /* ignore invalid URL */
  }

  const fromHashOrPath = getBoostPathFromHashOrPathname();

  if (isViewRouterActiveRoute(fromHashOrPath)) {
    const out = normalizeLegacyBoostHomeToDashboard(fromHashOrPath);
    persistBoostPathSnapshot(out);
    return out;
  }

  // Explicit host route (e.g. `#/init`, `#/messenger`) — do not show Boost UI from stale snapshot.
  if (fromHashOrPath !== '/') {
    clearBoostPathSnapshot();
    return fromHashOrPath;
  }

  const fromSnapshot = readBoostPathSnapshot();
  if (fromSnapshot != null) {
    return normalizeLegacyBoostHomeToDashboard(fromSnapshot);
  }

  return '/';
}

/**
 * True when the path is exactly `/sdc` (Boost “home” in the hash router).
 * @deprecated Prefer isViewRouterActiveRoute for shell takeover; keep for “home only” checks.
 */
export function isSdcBoostHomeRoute(path: string): boolean {
  const segments = path.split('/').filter(Boolean);
  return segments.length > 0 && segments[segments.length - 1] === 'sdc';
}

/**
 * Full URL for a Boost view (same query-param contract as `navigateBoostViewRouterPath`).
 * Use for `<a href>` so middle-click / open in new tab works.
 */
export function getBoostViewRouterUrl(boostPath: string): string {
  const normalized = boostPath.startsWith('/') ? boostPath : `/${boostPath}`;
  if (typeof location === 'undefined') {
    return `?${BOOST_VR_SEARCH_PARAM}=${encodeURIComponent(normalized)}`;
  }
  return buildBoostViewRouterUrlObject(normalized).toString();
}

/**
 * Convenience: `getBoostViewRouterUrl(getBoostProfilePath(userId))`.
 */
export function getBoostProfileHref(userId: number): string {
  return getBoostViewRouterUrl(getBoostProfilePath(userId));
}

/**
 * Navigate between Boost views using the query param (not `location.hash`) so the site SPA
 * does not swallow updates. Clears the hash to reduce conflicts with React HashRouter.
 *
 * Uses `history.pushState` so the browser Back/Forward stack matches in-app steps. The host
 * page’s SPA only sees our query-param updates; `NavigationWatcher` + `popstate` keep the
 * View Router in sync when the user presses Back.
 */
export function navigateBoostViewRouterPath(path: string): void {
  if (typeof location === 'undefined') {
    return;
  }
  const next = normalizeBoostPathSegment(path);
  const current = normalizeBoostPathSegment(getBoostViewPathFromLocation());
  if (next === current) {
    return;
  }
  const u = buildBoostViewRouterUrlObject(path);
  history.pushState(null, '', u.toString());
}

/**
 * Open the Hub messenger (`/sdc/chat`) and select a conversation by messenger `group_id`.
 * Uses SPA navigation (no reload). Omits `chat=open` so the floating chat dialog does not open;
 * `chatId` is read by {@link useChatDialogLifecycle} on the chat page.
 */
export function navigateBoostHubChatWithGroupId(groupId: number | string): void {
  if (typeof location === 'undefined') {
    return;
  }
  const u = new URL(location.href);
  u.searchParams.set(BOOST_VR_SEARCH_PARAM, VIEW_ROUTER_CHAT_PATH);
  u.searchParams.set('chatId', String(groupId));
  u.searchParams.delete('chat');
  u.hash = '';
  history.pushState(null, '', u.toString());
}

/**
 * Set the Boost view path without adding a history entry (e.g. hash → query migration).
 */
function replaceBoostViewRouterPath(path: string): void {
  if (typeof location === 'undefined') {
    return;
  }
  const u = buildBoostViewRouterUrlObject(path);
  history.replaceState(null, '', u.toString());
}

/**
 * Remove Boost routing from the current URL (query param only).
 */
export function clearBoostViewRouterFromUrl(): void {
  const u = new URL(location.href);
  u.searchParams.delete(BOOST_VR_SEARCH_PARAM);
  history.replaceState(null, '', u.toString());
  clearBoostPathSnapshot();
}

/**
 * If the user opened a legacy hash-only Boost URL (`#/sdc`) but the query param is not set yet,
 * rewrite to `?sdc_boost_vr=...` and clear the hash so the site’s hash router stops fighting us.
 * Bare `/sdc` is normalized to `VIEW_ROUTER_DEFAULT_PATH` (Hub Dashboard). Returns true if a rewrite happened.
 */
export function migrateHashBoostRouteToQuery(): boolean {
  try {
    const u = new URL(location.href);
    if (u.searchParams.has(BOOST_VR_SEARCH_PARAM)) return false;
    const hash = location.hash;
    if (!hash || hash.length <= 1) return false;
    const raw = hash.slice(1).split('?')[0] || '';
    if (!raw) return false;
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    if (!isViewRouterActiveRoute(path)) return false;
    const normalized = path.split('?')[0].replace(/\/$/, '') || '/';
    const target =
      normalized === VIEW_ROUTER_HOME_PATH ? VIEW_ROUTER_DEFAULT_PATH : path;
    replaceBoostViewRouterPath(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rewrite legacy `?sdc_boost_vr=/sdc` to `VIEW_ROUTER_DEFAULT_PATH` (Hub Dashboard).
 */
export function migrateLegacyDashboardBoostPath(): boolean {
  try {
    const u = new URL(location.href);
    const fromQuery = u.searchParams.get(BOOST_VR_SEARCH_PARAM);
    if (fromQuery == null || fromQuery.trim() === '') return false;
    const p = fromQuery.trim().split('?')[0];
    const normalized = (p.startsWith('/') ? p : `/${p}`).replace(/\/$/, '') || '/';
    if (normalized === VIEW_ROUTER_HOME_PATH) {
      u.searchParams.set(BOOST_VR_SEARCH_PARAM, VIEW_ROUTER_DEFAULT_PATH);
      u.hash = '';
      history.replaceState(null, '', u.toString());
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
