/**
 * SDC API People Functions
 * Functions for fetching online and viewed members
 */
import type { OnlineV2Response, ViewedV2Response } from '../sdc-api-types';
import { getCurrentDBId } from './utils';

export interface OnlineV2Params {
    muid?: string | null;
    gender?: string; // e.g., "2,1"
    looking_for_me?: number;
    pictures?: number;
    business_profile?: number;
    speed_dating?: number;
    birthday?: number;
    video?: number;
    quickFilter?: number;
    country?: string;
    lat?: number;
    lon?: number;
    map?: number;
    page?: number;
}

export interface ViewedV2Params {
    muid?: string | null;
    gender?: number;
    pictures?: number;
    business_profile?: number;
    select?: number;
    order?: number;
    map?: number;
    page?: number;
}

/**
 * Get online_v2 data (online members)
 * @param params Query parameters for the API request
 * @returns Online members response
 */
export async function getOnlineV2(params: OnlineV2Params = {}): Promise<OnlineV2Response> {
    const currentMuid = params.muid || getCurrentDBId();

    if (!currentMuid) {
        throw new Error('MUID (DB_ID) not found. Cannot fetch online members.');
    }

    const url = new URL('https://api.sdc.com/v1/online_v2');
    url.searchParams.set('muid', currentMuid);
    
    // Add optional parameters
    if (params.gender !== undefined) url.searchParams.set('gender', params.gender);
    if (params.looking_for_me !== undefined) url.searchParams.set('looking_for_me', params.looking_for_me.toString());
    if (params.pictures !== undefined) url.searchParams.set('pictures', params.pictures.toString());
    if (params.business_profile !== undefined) url.searchParams.set('business_profile', params.business_profile.toString());
    if (params.speed_dating !== undefined) url.searchParams.set('speed_dating', params.speed_dating.toString());
    if (params.birthday !== undefined) url.searchParams.set('birthday', params.birthday.toString());
    if (params.video !== undefined) url.searchParams.set('video', params.video.toString());
    if (params.quickFilter !== undefined) url.searchParams.set('quickFilter', params.quickFilter.toString());
    if (params.country !== undefined) url.searchParams.set('country', params.country);
    if (params.lat !== undefined) url.searchParams.set('lat', params.lat.toString());
    if (params.lon !== undefined) url.searchParams.set('lon', params.lon.toString());
    if (params.map !== undefined) url.searchParams.set('map', params.map.toString());
    if (params.page !== undefined) url.searchParams.set('page', params.page.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
                'origin': 'https://www.sdc.com',
                'referer': 'https://www.sdc.com/',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Online V2 API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as OnlineV2Response;
    } catch (error) {
        console.error('[SDC API] Failed to fetch online members:', error);
        throw error;
    }
}

/**
 * Get viewed_v2 data (viewed members)
 * @param params Query parameters for the API request
 * @returns Viewed members response
 */
export async function getViewedV2(params: ViewedV2Params = {}): Promise<ViewedV2Response> {
    const currentMuid = params.muid || getCurrentDBId();

    if (!currentMuid) {
        throw new Error('MUID (DB_ID) not found. Cannot fetch viewed members.');
    }

    const url = new URL('https://api.sdc.com/v1/viewed_v2');
    url.searchParams.set('muid', currentMuid);
    
    // Add optional parameters
    if (params.gender !== undefined) url.searchParams.set('gender', params.gender.toString());
    if (params.pictures !== undefined) url.searchParams.set('pictures', params.pictures.toString());
    if (params.business_profile !== undefined) url.searchParams.set('business_profile', params.business_profile.toString());
    if (params.select !== undefined) url.searchParams.set('select', params.select.toString());
    if (params.order !== undefined) url.searchParams.set('order', params.order.toString());
    if (params.map !== undefined) url.searchParams.set('map', params.map.toString());
    if (params.page !== undefined) url.searchParams.set('page', params.page.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
                'origin': 'https://www.sdc.com',
                'referer': 'https://www.sdc.com/',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Viewed V2 API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as ViewedV2Response;
    } catch (error) {
        console.error('[SDC API] Failed to fetch viewed members:', error);
        throw error;
    }
}
