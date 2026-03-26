/** Injected on sdc.com so opening Boost overlays/modals does not shift layout when the scrollbar gutter appears/disappears. */
export const HOST_SCROLLBAR_GUTTER_STYLE_ID = 'sdc-boost-host-scrollbar-gutter';

export const HOST_SCROLLBAR_GUTTER_CSS = `
html {
  scrollbar-gutter: stable !important;
}
`;

export function ensureHostScrollbarGutterStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(HOST_SCROLLBAR_GUTTER_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = HOST_SCROLLBAR_GUTTER_STYLE_ID;
  el.textContent = HOST_SCROLLBAR_GUTTER_CSS;
  document.documentElement.appendChild(el);
}
