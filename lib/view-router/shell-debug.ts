import { viewRouterLog, viewRouterWarn } from '@/lib/view-router/logger';
import { VIEW_ROUTER_SHELL_STYLE_ID } from '@/lib/view-router/shell-css';

/**
 * Snapshot DOM + computed styles to debug why shell CSS might not hide #root.
 * All logs use [SDC-Boost:ViewRouter] prefix via viewRouterLog.
 */
export function logShellCssDebug(label: string): void {
  try {
    const html = document.documentElement;
    const hasActiveClass = html.classList.contains('sdc-boost-view-router-active');
    const styleEl = document.getElementById(VIEW_ROUTER_SHELL_STYLE_ID);
    const root = document.getElementById('root');
    const reactRoot = document.getElementById('react-root');
    const rootDisplay = root ? window.getComputedStyle(root).display : null;
    const rootVisibility = root ? window.getComputedStyle(root).visibility : null;
    const bodyChildCount = document.body ? document.body.children.length : 0;

    viewRouterLog('shell CSS debug', {
      label,
      href: location.href,
      hash: location.hash,
      search: location.search,
      hasHtmlClass_sdcBoostViewRouterActive: hasActiveClass,
      htmlClassSnippet: (html.className || '').slice(0, 120),
      styleElementFound: Boolean(styleEl),
      styleTextLength: styleEl?.textContent?.length ?? 0,
      rootExists: Boolean(root),
      rootComputedDisplay: rootDisplay,
      rootComputedVisibility: rootVisibility,
      reactRootExists: Boolean(reactRoot),
      bodyExists: Boolean(document.body),
      bodyDirectChildCount: bodyChildCount,
    });

    if (!hasActiveClass) {
      viewRouterWarn('shell CSS debug: <html> missing class sdc-boost-view-router-active', { label });
    }
    if (!styleEl) {
      viewRouterWarn('shell CSS debug: style#' + VIEW_ROUTER_SHELL_STYLE_ID + ' not in DOM', { label });
    }
    if (!root) {
      if (document.readyState === 'loading') {
        viewRouterLog('shell CSS debug: #root not found (DOM still loading at document_start — expected)', {
          label,
        });
      } else {
        viewRouterWarn('shell CSS debug: #root not found', { label });
      }
    } else if (hasActiveClass && rootDisplay !== 'none') {
      viewRouterWarn('shell CSS debug: #root display is not none despite active class — specificity or wrong id?', {
        label,
        rootComputedDisplay: rootDisplay,
      });
    }
  } catch (e) {
    viewRouterWarn('shell CSS debug: exception', { label, e });
  }
}
