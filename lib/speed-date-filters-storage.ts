/**
 * Persists Speed Date hub list filters in localStorage (`sdc-boost-speed-date-filters`).
 */

const STORAGE_KEY = 'sdc-boost-speed-date-filters';

export const SPEED_DATE_FILTERS_VERSION = 1 as const;

export interface SpeedDateFiltersStored {
  v: typeof SPEED_DATE_FILTERS_VERSION;
  filterPrive: boolean;
  filterOpenbaar: boolean;
  filterVirtueel: boolean;
  orderStr: string;
  distance: number;
  /** `YYYY-MM-DD` or null */
  dateIso: string | null;
  ageFromStr: string;
  ageUntilStr: string;
  gender: string;
  lookingForMe: number;
  lat: number;
  lon: number;
  placeSearchQuery: string;
}

const DEFAULTS: SpeedDateFiltersStored = {
  v: SPEED_DATE_FILTERS_VERSION,
  filterPrive: true,
  filterOpenbaar: true,
  filterVirtueel: true,
  orderStr: '1',
  distance: 500,
  dateIso: null,
  ageFromStr: '',
  ageUntilStr: '',
  gender: '2,1',
  lookingForMe: 0,
  lat: 52.5755,
  lon: 6.6188,
  placeSearchQuery: '',
};

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asStr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function asNum(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** `YYYY-MM-DD` */
function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function normalize(raw: unknown): SpeedDateFiltersStored {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  let filterPrive = asBool(o.filterPrive, DEFAULTS.filterPrive);
  let filterOpenbaar = asBool(o.filterOpenbaar, DEFAULTS.filterOpenbaar);
  let filterVirtueel = asBool(o.filterVirtueel, DEFAULTS.filterVirtueel);
  if (!filterPrive && !filterOpenbaar && !filterVirtueel) {
    filterPrive = true;
    filterOpenbaar = true;
    filterVirtueel = true;
  }
  const orderStr = o.orderStr === '0' || o.orderStr === '1' ? o.orderStr : DEFAULTS.orderStr;
  const distance = clampInt(asNum(o.distance, DEFAULTS.distance), 1, 2000);
  let dateIso: string | null = null;
  if (typeof o.dateIso === 'string' && isIsoDate(o.dateIso)) {
    dateIso = o.dateIso;
  } else if (o.dateIso === null || o.dateIso === undefined) {
    dateIso = null;
  }
  const ageFromStr = asStr(o.ageFromStr, DEFAULTS.ageFromStr);
  const ageUntilStr = asStr(o.ageUntilStr, DEFAULTS.ageUntilStr);
  const gender = asStr(o.gender, DEFAULTS.gender).trim() || DEFAULTS.gender;
  const lfmRaw = o.lookingForMe ?? o.looking_for_me;
  const lookingForMe =
    lfmRaw === 1 || lfmRaw === '1' ? 1 : 0;
  const lat = asNum(o.lat, DEFAULTS.lat);
  const lon = asNum(o.lon, DEFAULTS.lon);
  const placeSearchQuery = asStr(o.placeSearchQuery, DEFAULTS.placeSearchQuery);

  return {
    v: SPEED_DATE_FILTERS_VERSION,
    filterPrive,
    filterOpenbaar,
    filterVirtueel,
    orderStr,
    distance,
    dateIso,
    ageFromStr,
    ageUntilStr,
    gender,
    lookingForMe,
    lat,
    lon,
    placeSearchQuery,
  };
}

export function loadSpeedDateFilters(): SpeedDateFiltersStored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed: unknown = JSON.parse(raw);
    return normalize(parsed);
  } catch (e) {
    console.error('[Speed Date filters] load failed:', e);
    return { ...DEFAULTS };
  }
}

export function saveSpeedDateFilters(filters: SpeedDateFiltersStored): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (e) {
    console.error('[Speed Date filters] save failed:', e);
  }
}
