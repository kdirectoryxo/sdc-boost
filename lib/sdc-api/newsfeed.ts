/**
 * SDC API Newsfeed Functions
 * Functions for fetching and working with newsfeed data
 */
import { getCurrentMuid } from './utils';

export interface NewsfeedFilterOptions {
    likes_rec: boolean;
    likes_sent: boolean;
    likes_mutual: boolean;
    group_joined: boolean;
    group_post_blog: boolean;
    photos_videos: boolean;
    birthday: boolean;
    validations: boolean;
    speedating: boolean;
    travelplans: boolean;
    travelplans_area: boolean;
    member_services: boolean;
    friends_new: boolean;
    my_new_friends: boolean;
    viewed_me: boolean;
    my_parties: boolean;
    parties: boolean;
    copies: boolean;
    blogs: boolean;
    members_area: boolean;
    contest: boolean;
    speed_area: boolean;
}

export interface NewsfeedFilterResponse {
    info: {
        code: number;
        options: NewsfeedFilterOptions;
        dto_feed: boolean;
        travel_area: boolean;
    };
}

export interface NewsfeedItem {
    action_id: number;
    action: number;
    fr_action: boolean;
    sender: any;
    receiver: any;
    party?: any;
    location?: string;
    location_how_far?: number;
    status: number;
    db_id: number;
    account_id: string;
    gender1: number;
    gender2: number;
    profile_type: number;
    online: number;
    business_type?: string;
    speed: number;
    photo_count: number;
    video_count: number;
    valid_count: number;
    likes_count: number;
    travel_count: number;
    service_count: number;
    reviews_counter: number;
    follows_counter: number;
    club_id?: number;
    sdcdiscount?: string;
    summary_int: string;
    age: string;
    birthday_for: string;
    primary_photo: string;
    subject?: string;
    body?: string;
    contest_prize?: string;
    timed: string;
    timed2: string;
    comments_data: any[];
    comments_count: number;
    liked: boolean;
    group_status: number;
    action_status: number;
    extra_data?: any;
    extra_data_comment?: string;
    lifetime_status: boolean;
    is_app_user: number;
    is_web_user: number;
}

export interface NewsfeedResponse {
    info: {
        code: number;
        trial: boolean;
        newsfeed: NewsfeedItem[];
        promo_block: boolean;
        last_key: string;
        url_more: string;
        blockNudge?: any;
        settings?: any;
        eventNotification?: any;
        isLogged: number;
        blockFriendsAddedThemSelfs?: any;
        guestListNotification?: any;
        travelAlert?: any;
    };
}

export interface AdminFeedResponse {
    info: {
        code: number;
        trial: boolean;
        newsfeed: NewsfeedItem[];
        url_more: string;
    };
}

/**
 * Get newsfeed filter options
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @param t1 Timestamp (default: current timestamp)
 * @returns Newsfeed filter options
 */
export async function getNewsfeedFilters(
    muid?: string | null,
    t1?: number
): Promise<NewsfeedFilterResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch newsfeed filters.');
    }

    const timestamp = t1 || Date.now();
    const url = new URL('https://api.sdc.com/v1/newsfeed_filter');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('t1', timestamp.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Newsfeed filter API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as NewsfeedFilterResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch newsfeed filters:', error);
        throw error;
    }
}

/**
 * Update newsfeed filter options
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @param filters Filter options to update
 * @returns Update response
 */
export async function updateNewsfeedFilters(
    filters: Partial<NewsfeedFilterOptions>,
    muid?: string | null
): Promise<{ info: { code: number; message: string } }> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot update newsfeed filters.');
    }

    const url = new URL('https://api.sdc.com/v1/newsfeed_update_filter');
    url.searchParams.set('muid', currentMuid);

    // Create FormData for multipart/form-data
    const formData = new FormData();
    
    // Add all filter fields (default to 0 if not provided)
    const defaultFilters: NewsfeedFilterOptions = {
        likes_rec: false,
        likes_sent: false,
        likes_mutual: false,
        group_joined: false,
        group_post_blog: false,
        photos_videos: false,
        birthday: false,
        validations: false,
        speedating: false,
        travelplans: false,
        travelplans_area: false,
        member_services: false,
        friends_new: false,
        my_new_friends: false,
        viewed_me: false,
        my_parties: false,
        parties: false,
        copies: false,
        blogs: false,
        members_area: false,
        contest: false,
        speed_area: false,
    };

    const mergedFilters = { ...defaultFilters, ...filters };

    // Add all filters to FormData (convert boolean to 0/1)
    Object.entries(mergedFilters).forEach(([key, value]) => {
        formData.append(key, value ? '1' : '0');
    });

    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
            },
            credentials: 'include',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Newsfeed filter update API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as { info: { code: number; message: string } };
    } catch (error) {
        console.error('[SDC API] Failed to update newsfeed filters:', error);
        throw error;
    }
}

/**
 * Get newsfeed items
 * @param page Page number (default: 0)
 * @param filter Filter string (comma-separated IDs)
 * @param filter_f Filter_f string (comma-separated IDs)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @param t1 Timestamp (default: current timestamp)
 * @param remembered Remembered flag (default: false)
 * @param last_key Last key for pagination (default: empty string)
 * @param time_zone Timezone offset in minutes (default: current timezone offset)
 * @returns Newsfeed data
 */
export async function getNewsfeed(
    page: number = 0,
    filter: string = '',
    filter_f: string = '',
    muid?: string | null,
    t1?: number,
    remembered: boolean = false,
    last_key: string = '',
    time_zone?: number,
    signal?: AbortSignal
): Promise<NewsfeedResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch newsfeed.');
    }

    const timestamp = t1 || Date.now();
    const timezone = time_zone !== undefined ? time_zone : new Date().getTimezoneOffset() * -1;

    const url = new URL('https://api.sdc.com/v1/newsfeed');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('page', page.toString());
    // Always pass filter parameters (even if empty)
    url.searchParams.set('filter', filter || '');
    url.searchParams.set('filter_f', filter_f || '');
    url.searchParams.set('t1', timestamp.toString());
    url.searchParams.set('remembered', remembered.toString());
    if (last_key) url.searchParams.set('last_key', last_key);
    url.searchParams.set('time_zone', timezone.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
            },
            credentials: 'include',
            signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Newsfeed API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as NewsfeedResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch newsfeed:', error);
        throw error;
    }
}

/**
 * Get admin feed items (SDC berichten)
 * @param page Page number (default: 0)
 * @param filter Filter string (default: empty)
 * @param filter_f Filter_f string (default: empty)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @param remembered Remembered flag (default: false)
 * @param client_token Client token (default: '0')
 * @returns Admin feed data
 */
export async function getAdminFeed(
    page: number = 0,
    filter: string = '',
    filter_f: string = '',
    muid?: string | null,
    remembered: boolean = false,
    client_token: string = '0',
    signal?: AbortSignal
): Promise<AdminFeedResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch admin feed.');
    }

    const url = new URL('https://api.sdc.com/v1/adminfeed');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('page', page.toString());
    // Always pass filter parameters (even if empty)
    url.searchParams.set('filter', filter || '');
    url.searchParams.set('filter_f', filter_f || '');
    url.searchParams.set('remembered', remembered.toString());
    url.searchParams.set('client_token', client_token);

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
            },
            credentials: 'include',
            signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Admin feed API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as AdminFeedResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch admin feed:', error);
        throw error;
    }
}
