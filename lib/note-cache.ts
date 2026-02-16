/**
 * Global note cache for profile notes
 * Persists until page reload - after reload, API values are used
 */
export const noteCache = new Map<number, string>();
