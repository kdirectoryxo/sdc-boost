/**
 * Runs at document_start so we can hide #root before first paint on direct loads of #/sdc,
 * avoiding a flash of MUI chrome / loading UI before the main content script mounts Vue.
 */
import { getBoostViewPathFromLocation, isViewRouterActiveRoute } from '@/lib/view-router/routes';
import { VIEW_ROUTER_SHELL_STYLE_ID, VIEW_ROUTER_SHELL_CSS } from '@/lib/view-router/shell-css';
import { logShellCssDebug } from '@/lib/view-router/shell-debug';
import { viewRouterLog } from '@/lib/view-router/logger';

export default defineContentScript({
  matches: ['*://*.sdc.com/*', '*://sdc.com/*'],
  runAt: 'document_start',
  main() {
    const boostPath = getBoostViewPathFromLocation();
    const active = isViewRouterActiveRoute(boostPath);

    if (window !== window.top) {
      viewRouterLog('prehide skipped', { reason: 'not-top-frame', href: location.href });
      return;
    }

    viewRouterLog('prehide decision', {
      boostPath,
      active,
      href: location.href,
      hash: location.hash,
      pathname: location.pathname,
      readyState: document.readyState,
    });

    if (!active) {
      return;
    }

    document.documentElement.classList.add('sdc-boost-view-router-active');

    if (document.getElementById(VIEW_ROUTER_SHELL_STYLE_ID)) {
      viewRouterLog('prehide: style tag already present, skipping inject', {
        id: VIEW_ROUTER_SHELL_STYLE_ID,
      });
      logShellCssDebug('prehide:style-exists');
      return;
    }

    const el = document.createElement('style');
    el.id = VIEW_ROUTER_SHELL_STYLE_ID;
    el.textContent = VIEW_ROUTER_SHELL_CSS;
    document.documentElement.appendChild(el);
    viewRouterLog('prehide: injected shell style', {
      id: VIEW_ROUTER_SHELL_STYLE_ID,
      cssLength: VIEW_ROUTER_SHELL_CSS.length,
    });
    logShellCssDebug('prehide:after-inject');
  },
});
