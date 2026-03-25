/**
 * SDC Speed Dating API (`speeddating_v2`, signup, my list, edit, delete).
 */
import type {
  SpeedDatingMySpeedResponse,
  SpeedDatingV2Item,
  SpeedDatingV2Response,
} from '../sdc-api-types';
import { resolvePeopleApiMuid } from './session-credentials';

const ORIGIN = 'https://www.sdc.com';
const REFERER = 'https://www.sdc.com/';

function defaultTimeZoneOffset(): number {
  return -new Date().getTimezoneOffset();
}

export interface SpeedDatingV2Params {
  muid?: string | null;
  gender?: string;
  looking_for_me?: number;
  distance?: number;
  order?: number;
  quickFilter?: number;
  date?: string;
  country?: string;
  lat?: number;
  lon?: number;
  /** 3-digit bitmask: e.g. `111` = privé + openbaar + virtueel */
  locationSearch?: string;
  map?: number;
  ageFrom?: number;
  ageUntil?: number;
  page?: number;
  time_zone?: number;
}

/**
 * Resolve the speed-date post id for `speeddating_edit` when the API uses varying field names.
 */
export function getSpeedDatePostId(row: SpeedDatingV2Item): number | null {
  if (typeof row.id_speed === 'number' && row.id_speed > 0) {
    return row.id_speed;
  }
  const extra = row as unknown as Record<string, unknown>;
  for (const key of ['speed_id', 'id', 'ID_SPEED', 'speedId']) {
    const v = extra[key];
    if (typeof v === 'number' && v > 0) return v;
    if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10);
  }
  return null;
}

/**
 * Parse `page` from `info.url_more` (e.g. `?page=1`).
 */
export function parseNextPageFromUrlMore(urlMore: string | undefined | null): number | null {
  if (!urlMore || typeof urlMore !== 'string') return null;
  try {
    const q = urlMore.includes('?') ? urlMore.slice(urlMore.indexOf('?')) : `?${urlMore}`;
    const params = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
    const p = params.get('page');
    if (p == null || p === '') return null;
    const n = parseInt(p, 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

export async function getSpeedDatingV2(
  params: SpeedDatingV2Params = {}
): Promise<SpeedDatingV2Response> {
  const muid = await resolvePeopleApiMuid(params.muid ?? null);
  const url = new URL('https://api.sdc.com/v1/speeddating_v2');
  url.searchParams.set('muid', muid);

  if (params.gender !== undefined) url.searchParams.set('gender', params.gender);
  if (params.looking_for_me !== undefined) {
    url.searchParams.set('looking_for_me', String(params.looking_for_me));
  }
  if (params.distance !== undefined) url.searchParams.set('distance', String(params.distance));
  if (params.order !== undefined) url.searchParams.set('order', String(params.order));
  if (params.quickFilter !== undefined) {
    url.searchParams.set('quickFilter', String(params.quickFilter));
  }
  if (params.date !== undefined) url.searchParams.set('date', params.date);
  if (params.country !== undefined) url.searchParams.set('country', params.country);
  if (params.lat !== undefined) url.searchParams.set('lat', String(params.lat));
  if (params.lon !== undefined) url.searchParams.set('lon', String(params.lon));
  if (params.locationSearch !== undefined) {
    url.searchParams.set('locationSearch', params.locationSearch);
  }
  if (params.map !== undefined) url.searchParams.set('map', String(params.map));
  if (params.ageFrom !== undefined) url.searchParams.set('ageFrom', String(params.ageFrom));
  if (params.ageUntil !== undefined) url.searchParams.set('ageUntil', String(params.ageUntil));
  if (params.page !== undefined) url.searchParams.set('page', String(params.page));
  url.searchParams.set('time_zone', String(params.time_zone ?? defaultTimeZoneOffset()));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      origin: ORIGIN,
      referer: REFERER,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`speeddating_v2 failed: ${response.status} ${t}`);
  }

  return (await response.json()) as SpeedDatingV2Response;
}

export async function getMySpeedDates(muid?: string | null): Promise<SpeedDatingMySpeedResponse> {
  const current = await resolvePeopleApiMuid(muid ?? null);
  const url = new URL('https://api.sdc.com/v1/speeddating_my_speed');
  url.searchParams.set('muid', current);
  url.searchParams.set('dbidsearch', current);
  url.searchParams.set('time_zone', String(defaultTimeZoneOffset()));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      origin: ORIGIN,
      referer: REFERER,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`speeddating_my_speed failed: ${response.status} ${t}`);
  }

  return (await response.json()) as SpeedDatingMySpeedResponse;
}

export interface SignupSpeedDateParams {
  muid?: string | null;
  country: string;
  state: string;
  city: string;
  lat: number;
  lon: number;
  /** e.g. `03/22/2026` */
  days: string;
  /** 6-char interests bitmask */
  interests: string;
  personal_text: string;
  type: number;
  client_token?: string;
}

export async function signupSpeedDate(params: SignupSpeedDateParams): Promise<SpeedDatingV2Response> {
  const muid = await resolvePeopleApiMuid(params.muid ?? null);
  const url = new URL('https://api.sdc.com/v1/speeddating_signup_v2');
  url.searchParams.set('muid', muid);
  url.searchParams.set('country', params.country);
  url.searchParams.set('state', params.state);
  url.searchParams.set('city', params.city);
  url.searchParams.set('lat', String(params.lat));
  url.searchParams.set('lon', String(params.lon));
  url.searchParams.set('days', params.days);
  url.searchParams.set('interests', params.interests);
  url.searchParams.set('personal_text', params.personal_text);
  url.searchParams.set('type', String(params.type));
  url.searchParams.set('client_token', params.client_token ?? '0');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      origin: ORIGIN,
      referer: REFERER,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`speeddating_signup_v2 failed: ${response.status} ${t}`);
  }

  return (await response.json()) as SpeedDatingV2Response;
}

export interface EditSpeedDateParams {
  muid?: string | null;
  id_speed: number;
  country: string;
  state: string;
  city: string;
  lat: number;
  lon: number;
  days: string;
  interests: string;
  personal_text: string;
  type: number;
  client_token?: string;
}

export async function editSpeedDate(params: EditSpeedDateParams): Promise<SpeedDatingV2Response> {
  const muid = await resolvePeopleApiMuid(params.muid ?? null);
  const url = new URL('https://api.sdc.com/v1/speeddating_edit');
  url.searchParams.set('muid', muid);
  url.searchParams.set('id_speed', String(params.id_speed));
  url.searchParams.set('country', params.country);
  url.searchParams.set('state', params.state);
  url.searchParams.set('city', params.city);
  url.searchParams.set('lat', String(params.lat));
  url.searchParams.set('lon', String(params.lon));
  url.searchParams.set('days', params.days);
  url.searchParams.set('interests', params.interests);
  url.searchParams.set('personal_text', params.personal_text);
  url.searchParams.set('type', String(params.type));
  url.searchParams.set('client_token', params.client_token ?? '0');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      origin: ORIGIN,
      referer: REFERER,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`speeddating_edit failed: ${response.status} ${t}`);
  }

  return (await response.json()) as SpeedDatingV2Response;
}

export interface DeleteSpeedDateParams {
  muid?: string | null;
  /** From site curl: `SDType=0` */
  SDType?: number;
  /** Member DB_ID (same as current user for own post) */
  DB_ID: number;
}

export async function deleteSpeedDate(params: DeleteSpeedDateParams): Promise<SpeedDatingV2Response> {
  const muid = await resolvePeopleApiMuid(params.muid ?? null);
  const url = new URL('https://api.sdc.com/v1/speeddating_delete');
  url.searchParams.set('muid', muid);
  url.searchParams.set('SDType', String(params.SDType ?? 0));
  url.searchParams.set('DB_ID', String(params.DB_ID));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      origin: ORIGIN,
      referer: REFERER,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`speeddating_delete failed: ${response.status} ${t}`);
  }

  return (await response.json()) as SpeedDatingV2Response;
}
