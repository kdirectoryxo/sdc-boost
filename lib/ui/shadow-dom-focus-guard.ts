/**
 * Counteracts Reka UI's FocusScope misbehaviour inside a shadow DOM.
 *
 * FocusScope adds `document.addEventListener("focusin", …)` and a
 * MutationObserver on the dialog container.  In a shadow DOM the `focusin`
 * event that reaches `document` has its `target` retargeted to the shadow
 * host, so `container.contains(target)` always fails and
 * `lastFocusedElementRef` is never set.  When any reactive DOM mutation
 * occurs (character-count update, button-state change, …) the
 * MutationObserver fires, checks `container.contains(null) → false`, and
 * calls `focus(container)` — stealing focus from the active input.
 *
 * This guard listens for `focusin` on the portal element (still inside the
 * shadow tree where targets are correct) and, when a DismissableLayer
 * container itself receives focus, redirects back to the previously focused
 * child element.
 *
 * Install once on the UI-teleport portal element via
 * `installShadowDomFocusGuard(portalEl)`.
 */

const LAYER_SELECTOR = '[data-dismissable-layer]';

export function installShadowDomFocusGuard(portal: HTMLElement): () => void {
  const lastFocusedMap = new WeakMap<Element, HTMLElement>();

  function onFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement | null;
    if (!target || target === portal) return;

    const container = target.closest(LAYER_SELECTOR) as HTMLElement | null;
    if (!container) return;

    if (target === container) {
      // The DismissableLayer/FocusScope container itself received focus.
      // This is almost certainly FocusScope's MutationObserver calling
      // `focus(container)` because `lastFocusedElementRef` was never set
      // (shadow-DOM retargeting).  Redirect to the last tracked child.
      const prev = lastFocusedMap.get(container);
      if (prev && prev !== container && container.contains(prev)) {
        queueMicrotask(() => {
          // Guard: only redirect if the container still has focus.
          const root = container.getRootNode();
          const active =
            root instanceof ShadowRoot ? root.activeElement : document.activeElement;
          if (active === container && container.contains(prev)) {
            prev.focus({ preventScroll: true });
          }
        });
      }
    } else {
      lastFocusedMap.set(container, target);
    }
  }

  portal.addEventListener('focusin', onFocusIn);
  return () => portal.removeEventListener('focusin', onFocusIn);
}
