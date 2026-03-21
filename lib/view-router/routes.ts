/**
 * Routes for the SDC Boost View Router (full-page UI on sdc.com/react).
 *
 * The site’s SPA owns the hash (`#/…`). In-app Boost navigation uses a **query param**
 * (`sdc_boost_vr=`) so React/Vue routers don’t intercept our routes. Hash-only URLs are still
 * supported for bookmarks and older links.
 */

/** Query key for Boost view path (e.g. `?sdc_boost_vr=/sdc/router-test`). */
export const BOOST_VR_SEARCH_PARAM = 'sdc_boost_vr';

/** Fake route for exercising the in-app router. */
export const VIEW_ROUTER_TEST_PATH = '/sdc/router-test';

export type ViewRouterViewId = 'home' | 'router-test';

/**
 * Current Boost path: **query param first** (avoids SPA hash router), then hash, then pathname.
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
      return p.startsWith('/') ? p : `/${p}`;
    }
  } catch {
    /* ignore invalid URL */
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
 * True when the path is exactly `/sdc` (Boost “home” in the hash router).
 * @deprecated Prefer isViewRouterActiveRoute for shell takeover; keep for “home only” checks.
 */
export function isSdcBoostHomeRoute(path: string): boolean {
  const segments = path.split('/').filter(Boolean);
  return segments.length > 0 && segments[segments.length - 1] === 'sdc';
}

/**
 * True when the full-page View Router should be shown: `/sdc`, nested routes like `/sdc/router-test`,
 * or legacy paths whose last segment is `sdc` (e.g. `#/react/sdc`).
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
 * Which screen to render inside ViewRouterApp.
 */
export function getViewRouterViewId(path: string): ViewRouterViewId {
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/';
  if (normalized === VIEW_ROUTER_TEST_PATH || normalized.endsWith(VIEW_ROUTER_TEST_PATH)) {
    return 'router-test';
  }
  return 'home';
}

/**
 * Navigate between Boost views using the query param (not `location.hash`) so the site SPA
 * does not swallow updates. Clears the hash to reduce conflicts with React HashRouter.
 */
export function navigateBoostViewRouterPath(path: string): void {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const u = new URL(location.href);
  u.searchParams.set(BOOST_VR_SEARCH_PARAM, normalized);
  u.hash = '';
  history.replaceState(null, '', u.toString());
}

/**
 * Remove Boost routing from the current URL (query param only).
 */
export function clearBoostViewRouterFromUrl(): void {
  const u = new URL(location.href);
  u.searchParams.delete(BOOST_VR_SEARCH_PARAM);
  history.replaceState(null, '', u.toString());
}

/**
 * If the user opened a legacy hash-only Boost URL (`#/sdc`) but the query param is not set yet,
 * rewrite to `?sdc_boost_vr=...` and clear the hash so the site’s hash router stops fighting us.
 * Returns true if a rewrite happened.
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
    navigateBoostViewRouterPath(path);
    return true;
  } catch {
    return false;
  }
}
