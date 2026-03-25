/**
 * Voyeur API `timed` strings (e.g. `42m`, `4u26m`) → display like the main site: `42m`, `4h 26m`.
 * `u` = hours, `m` = minutes (same convention as SDC live list).
 */
export function formatVoyeurStreamDuration(timed: string | undefined | null): string {
  if (timed == null) return '';
  const s = String(timed).trim();
  if (!s) return '';

  const hoursMinutes = s.match(/^(\d+)u(\d+)m$/i);
  if (hoursMinutes) {
    const h = hoursMinutes[1];
    const m = hoursMinutes[2];
    return `${h}h ${m}m`;
  }

  const minutesOnly = s.match(/^(\d+)m$/i);
  if (minutesOnly) {
    return `${minutesOnly[1]}m`;
  }

  const hoursOnly = s.match(/^(\d+)u$/i);
  if (hoursOnly) {
    return `${hoursOnly[1]}h`;
  }

  return s;
}
