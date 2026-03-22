/**
 * SDC feed notifications API (bell / activity feed).
 */
import type { FeedNotificationsResponse } from '../sdc-api-types';
import { resolvePeopleApiMuid } from './session-credentials';

export interface GetFeedNotificationsParams {
    page?: number;
    filter?: string;
    filter_f?: string;
    remembered?: boolean;
    client_token?: string;
    muid?: string | null;
}

/**
 * Fetch paginated notifications (same endpoint as the site bell dropdown).
 */
export async function getFeedNotifications(
    params: GetFeedNotificationsParams = {},
): Promise<FeedNotificationsResponse> {
    const currentMuid = await resolvePeopleApiMuid(params.muid ?? null);

    const url = new URL('https://api.sdc.com/v1/feed/notifications');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('page', String(params.page ?? 0));
    url.searchParams.set('filter', params.filter ?? '');
    url.searchParams.set('filter_f', params.filter_f ?? '');
    url.searchParams.set('remembered', String(params.remembered ?? false));
    url.searchParams.set('client_token', params.client_token ?? '0');

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            accept: 'application/json, text/plain, */*',
            'accept-language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        credentials: 'include',
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Feed notifications failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as FeedNotificationsResponse;
    return data;
}
