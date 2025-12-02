/**
 * SDC API Counters Functions
 * Functions for fetching and working with counters
 */
import type { CountersResponse } from '../sdc-api-types';
import { getCurrentMuid } from './utils';

/**
 * Get counters data
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Counters data
 */
export async function getCounters(muid?: string | null): Promise<CountersResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch counters.');
    }

    const url = new URL('https://api.sdc.com/v1/counters');
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
            throw new Error(`Counters API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as CountersResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch counters:', error);
        throw error;
    }
}

