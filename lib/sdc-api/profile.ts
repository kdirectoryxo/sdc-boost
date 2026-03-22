/**
 * SDC API Profile Functions
 * Functions for fetching and working with user profiles
 */
import type { ProfileV2Response, ValidationsV2Response } from '../sdc-api-types';
import { resolveMuidOrAwait } from './session-credentials';

/**
 * Get profile_v2 data for a user
 * @param dbId The target user's DB_ID
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Profile data including note
 */
export async function getProfileV2(dbId: string, muid?: string | null): Promise<ProfileV2Response> {
    const currentMuid = await resolveMuidOrAwait(muid);

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch profile data.');
    }

    // Get current timezone offset in minutes
    const timezoneOffset = -new Date().getTimezoneOffset();
    const currentHour = new Date().getHours();

    const url = new URL('https://api.sdc.com/v1/profile_v2');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('DB_ID', dbId);
    url.searchParams.set('time_zone', timezoneOffset.toString());
    url.searchParams.set('top_friends', '20');
    url.searchParams.set('top_follows', '20');
    url.searchParams.set('current_hour', currentHour.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Profile API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Check if profile_user is a string (error message) instead of an object
        // This happens when the account is deleted/inactive
        if (data.info && typeof data.info.profile_user === 'string') {
            const errorMessage = data.info.profile_user;
            const unavailableError = new Error(errorMessage) as Error & {
                isUnavailableProfile: boolean;
            };
            unavailableError.isUnavailableProfile = true;
            throw unavailableError;
        }
        
        return data as ProfileV2Response;
    } catch (error) {
        console.error('[SDC API] Failed to fetch profile:', error);
        throw error;
    }
}

/**
 * Get the current note for a user
 * @param dbId The target user's DB_ID
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns The current note text, or empty string if no note exists
 */
export async function getCurrentNote(dbId: string, muid?: string | null): Promise<string> {
    try {
        const profile = await getProfileV2(dbId, muid);
        return profile.info?.profile_user?.note || '';
    } catch (error) {
        console.error('[SDC API] Failed to get current note:', error);
        return '';
    }
}

/**
 * Update the note for a user profile
 * @param dbId The target user's DB_ID
 * @param note The note text to save
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Response indicating success
 */
export async function updateProfileNote(
    dbId: string,
    note: string,
    muid?: string | null
): Promise<{ info: { code: number; message?: string } }> {
    const currentMuid = await resolveMuidOrAwait(muid);

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot update profile note.');
    }

    const apiUrl = `https://api.sdc.com/v1/note_add?muid=${currentMuid}`;
    const formData = new FormData();
    formData.append('TargetDB_ID', dbId);
    formData.append('Notes', note);
    formData.append('client_token', '0');

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
            },
            credentials: 'include',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Note update API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Check if the operation was successful
        const responseCode = data.info?.code;
        if (responseCode !== 200 && responseCode !== '200') {
            throw new Error(data.info?.message || 'Failed to update profile note');
        }

        return data as { info: { code: number; message?: string } };
    } catch (error) {
        console.error('[SDC API] Failed to update profile note:', error);
        throw error;
    }
}

/**
 * Get all validations for a user
 * @param dbId The target user's DB_ID
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @param page Page number (default: 0)
 * @returns Validations response with all validation users
 */
export async function getValidationsV2(
    dbId: string,
    muid?: string | null,
    page: number = 0
): Promise<ValidationsV2Response> {
    const currentMuid = await resolveMuidOrAwait(muid);

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch validations.');
    }

    const url = new URL('https://api.sdc.com/v1/validations_v2');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('DB_ID', dbId);
    url.searchParams.set('page', page.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Validations API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as ValidationsV2Response;
    } catch (error) {
        console.error('[SDC API] Failed to fetch validations:', error);
        throw error;
    }
}


