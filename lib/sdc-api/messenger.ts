/**
 * SDC API Messenger Functions
 * Functions for fetching and working with messenger/chat data
 */
import type { MessengerLatestResponse } from '../sdc-api-types';
import { getCurrentMuid } from './utils';

/**
 * Get messenger_latest data (chat list)
 * @param page Page number (default: 0)
 * @param searchMember Search member filter (default: empty string)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Messenger chat list data
 */
export async function getMessengerLatest(
    page: number = 0,
    searchMember: string = '',
    muid?: string | null
): Promise<MessengerLatestResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch messenger data.');
    }

    // Use messenger_search when searching, messenger_latest when not
    const endpoint = searchMember.trim() ? 'messenger_search' : 'messenger_latest';
    const url = new URL(`https://api.sdc.com/v1/${endpoint}`);
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('search_member', searchMember);
    url.searchParams.set('page', page.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Messenger API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as MessengerLatestResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch messenger data:', error);
        throw error;
    }
}

/**
 * Get messenger_io_v2 data (WebSocket connection parameters)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns WebSocket connection parameters
 */
export async function getMessengerIOV2(muid?: string | null): Promise<MessengerIOV2Response> {
    const { getCurrentMuid } = await import('./utils');
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch messenger IO data.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_io_v2');
    url.searchParams.set('muid', currentMuid);

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Messenger IO API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as MessengerIOV2Response;
    } catch (error) {
        console.error('[SDC API] Failed to fetch messenger IO data:', error);
        throw error;
    }
}


