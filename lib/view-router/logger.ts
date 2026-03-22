/** Console prefix for SDC Hub — all logs from this feature use this. */
export const VIEW_ROUTER_LOG_PREFIX = '[SDC-Boost:SDCHub]';

export function viewRouterLog(...args: unknown[]): void {
  console.log(VIEW_ROUTER_LOG_PREFIX, ...args);
}

export function viewRouterWarn(...args: unknown[]): void {
  console.warn(VIEW_ROUTER_LOG_PREFIX, ...args);
}
