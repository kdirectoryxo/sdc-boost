/**
 * SDC place search (`location_search`) — geocoding-style results with lat/lon.
 */
import { resolvePeopleApiMuid } from './session-credentials';

const ORIGIN = 'https://www.sdc.com';
const REFERER = 'https://www.sdc.com/';

export interface LocationSearchPlace {
  place_id: string;
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

export interface LocationSearchResponse {
  info: {
    code: number;
    list?: LocationSearchPlace[];
  };
}

/**
 * Search places by free text (city, region, etc.). Returns OSM/LocationIQ-style rows.
 */
export async function searchLocationPlaces(
  query: string,
  muid?: string | null,
): Promise<LocationSearchPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const resolved = await resolvePeopleApiMuid(muid ?? null);
  const url = new URL('https://api.sdc.com/v1/location_search');
  url.searchParams.set('muid', resolved);
  url.searchParams.set('q', q);

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
    throw new Error(`location_search failed: ${response.status} ${t}`);
  }

  const data = (await response.json()) as LocationSearchResponse;
  const list = data.info?.list;
  return Array.isArray(list) ? list : [];
}

export function parsePlaceLatLon(place: LocationSearchPlace): { lat: number; lon: number } {
  const lat = Number.parseFloat(place.lat);
  const lon = Number.parseFloat(place.lon);
  return { lat, lon };
}
