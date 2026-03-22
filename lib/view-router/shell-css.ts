/**
 * Shared CSS to hide the SDC React shell while the View Router is active.
 * Used by document_start prehide + main content script so the first paint does not flash MUI.
 */

export const VIEW_ROUTER_SHELL_STYLE_ID = 'sdc-boost-view-router-shell-style';

/**
 * Keep in sync with MUI/React behavior: visibility:hidden is overridden by children;
 * display:none on #root removes the whole tree from layout.
 */
export const VIEW_ROUTER_SHELL_CSS = `
html.sdc-boost-view-router-active {
  background-color: #131517 !important;
}
html.sdc-boost-view-router-active #root {
  display: none !important;
  pointer-events: none !important;
}
html.sdc-boost-view-router-active #react-root {
  display: none !important;
  pointer-events: none !important;
}
html.sdc-boost-view-router-active body > .MuiModal-root,
html.sdc-boost-view-router-active body > .MuiPopover-root,
html.sdc-boost-view-router-active body > .MuiPopper-root,
html.sdc-boost-view-router-active body > div[role="presentation"].MuiModal-root {
  display: none !important;
  pointer-events: none !important;
}
`;
