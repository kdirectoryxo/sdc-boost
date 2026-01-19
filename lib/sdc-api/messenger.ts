/**
 * SDC API Messenger Functions
 * Functions for fetching and working with messenger/chat data
 */
import type { MessengerLatestResponse, MessengerIOV2Response, MessengerFoldersResponse, MessengerChatDetailsResponse, GalleryPhotosResponse, AlbumsResponse, PinChatResponse, MarkUnreadResponse, SearchGlobalV2Response, MessengerGroupContactsResponse, MessengerGroupInfoResponse } from '../sdc-api-types';
import { getCurrentMuid } from './utils';
import { chatStorage } from '../chat-storage';
import { folderStorage } from '../folder-storage';

/**
 * Get messenger_latest data (chat list)
 * @param page Page number (default: 0)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Messenger chat list data
 */
export async function getMessengerLatest(
    page: number = 0,
    muid?: string | null
): Promise<MessengerLatestResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch messenger data.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_latest');
    url.searchParams.set('muid', currentMuid);
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

/**
 * Get messenger_folders data (folder list)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Messenger folders data
 */
export async function getMessengerFolders(muid?: string | null): Promise<MessengerFoldersResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch messenger folders.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_folders');
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
            throw new Error(`Messenger Folders API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as MessengerFoldersResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch messenger folders:', error);
        throw error;
    }
}

/**
 * Get messenger_folder_items data (chats in a specific folder)
 * @param folderId The folder ID to fetch chats for
 * @param page Page number (default: 0)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Messenger chat list data for the folder
 */
export async function getMessengerFolderItems(
    folderId: number,
    page: number = 0,
    muid?: string | null
): Promise<MessengerLatestResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch messenger folder items.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_folder_items');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('folder_id', folderId.toString());
    url.searchParams.set('page', page.toString());
    url.searchParams.set('search_member', ''); // Empty for now, client-side filtering

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
            throw new Error(`Messenger Folder Items API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as MessengerLatestResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch messenger folder items:', error);
        throw error;
    }
}

/**
 * Sync all chats from messenger_latest and all folders
 * Uses incremental sync: first time fetches all pages, subsequent times only fetches new chats
 * Upserts chats incrementally after each page for fast updates
 * @param onPageSynced Optional callback called after each page is synced (for UI updates)
 * @param onFolderSynced Optional callback called after each folder/area is synced (for UI updates)
 * @returns Total number of chats synced
 */
export async function syncAllChats(
    onPageSynced?: () => void | Promise<void>,
    onFolderSynced?: (folderName: string) => void | Promise<void>
): Promise<number> {
    console.log('[Messenger API] Syncing all chats...');
    let totalSynced = 0;

    // Sync messenger_latest (inbox) - uses incremental sync
    const inboxCount = await syncInboxChats(onPageSynced);
    totalSynced += inboxCount;
    if (onFolderSynced) {
        await onFolderSynced('inbox');
    }

    // Sync groups - uses incremental sync
    try {
        const groupsCount = await syncGroupsChats(onPageSynced);
        totalSynced += groupsCount;
        if (onFolderSynced) {
            await onFolderSynced('groups');
        }
    } catch (err) {
        console.error('[Messenger API] Failed to sync groups:', err);
        // Continue even if groups sync fails
    }

    // Sync each folder - uses incremental sync
    const folderList = await folderStorage.getAllFolders();
    for (const folder of folderList) {
        try {
            const folderCount = await syncFolderChats(folder.id, onPageSynced);
            totalSynced += folderCount;
            if (onFolderSynced) {
                await onFolderSynced(folder.name);
            }
        } catch (err) {
            console.error(`[Messenger API] Failed to sync folder ${folder.id}:`, err);
            // Continue with other folders even if one fails
        }
    }

    // Sync archives - uses incremental sync
    try {
        const archivesCount = await syncArchivesChats(onPageSynced);
        totalSynced += archivesCount;
        if (onFolderSynced) {
            await onFolderSynced('archives');
        }
    } catch (err) {
        console.error('[Messenger API] Failed to sync archives:', err);
        // Continue even if archives sync fails
    }

    console.log(`[Messenger API] Synced ${totalSynced} total chats`);
    return totalSynced;
}

/**
 * Sync inbox chats (messenger_latest) only
 * Uses incremental sync: first time fetches all pages, subsequent times only fetches new chats
 * Upserts chats incrementally after each page for fast updates
 * @param onPageSynced Optional callback called after each page is synced (for UI updates)
 * @returns Total number of chats synced
 */
export async function syncInboxChats(onPageSynced?: () => void | Promise<void>): Promise<number> {
    console.log('[Messenger API] Syncing inbox chats...');
    
    // Get last sync time for incremental sync
    const lastSyncTime = await chatStorage.getInboxLastSyncTime();
    
    if (lastSyncTime) {
        console.log(`[Messenger API] Incremental sync: last sync was at ${lastSyncTime}`);
    } else {
        console.log('[Messenger API] First-time sync: fetching all pages');
    }
    
    // Sync messenger_latest with incremental sync support
    const result = await chatStorage.syncChatsFromEndpoint(
        (page) => getMessengerLatest(page),
        async (chats, total) => {
            console.log(`[Messenger API] Synced ${chats.length} inbox chats (total: ${total})`);
            // Trigger UI update after each page
            if (onPageSynced) {
                await onPageSynced();
            }
        },
        lastSyncTime
    );
    
    // Update last sync time
    // If first-time sync, always save (use mostRecentDateTime or current time)
    // If incremental sync, only update if we have a more recent date_time
    if (!lastSyncTime) {
        // First-time sync: always save sync time
        const syncTimeToSave = result.mostRecentDateTime || new Date().toISOString();
        await chatStorage.setLastSyncTime('inbox', syncTimeToSave);
        console.log(`[Messenger API] Set inbox last sync time to ${syncTimeToSave}`);
    } else if (result.mostRecentDateTime) {
        // Incremental sync: only update if we have a more recent date_time
        const mostRecentTimestamp = new Date(result.mostRecentDateTime).getTime();
        const lastSyncTimestamp = new Date(lastSyncTime).getTime();
        if (mostRecentTimestamp >= lastSyncTimestamp) {
            await chatStorage.setLastSyncTime('inbox', result.mostRecentDateTime);
            console.log(`[Messenger API] Updated inbox last sync time to ${result.mostRecentDateTime}`);
        }
    }
    
    console.log(`[Messenger API] Synced ${result.totalSynced} inbox chats`);
    return result.totalSynced;
}

/**
 * Sync groups chats from messenger_groups_gm
 * Uses incremental sync: first time fetches all pages, subsequent times only fetches new chats
 * Upserts chats incrementally after each page for fast updates
 * @param onPageSynced Optional callback called after each page is synced (for UI updates)
 * @returns Total number of chats synced
 */
export async function syncGroupsChats(onPageSynced?: () => void | Promise<void>): Promise<number> {
    console.log('[Messenger API] Syncing groups chats...');
    
    // Get last sync time for incremental sync
    const lastSyncTime = await chatStorage.getGroupsLastSyncTime();
    
    if (lastSyncTime) {
        console.log(`[Messenger API] Incremental sync for groups: last sync was at ${lastSyncTime}`);
    } else {
        console.log('[Messenger API] First-time sync for groups: fetching all pages');
    }
    
    // Sync groups with incremental sync support
    const result = await chatStorage.syncChatsFromEndpoint(
        (page) => {
            const t1 = lastSyncTime ? new Date(lastSyncTime).getTime() : Date.now();
            return getMessengerGroups(page, t1);
        },
        async (chats, total) => {
            console.log(`[Messenger API] Synced ${chats.length} groups chats (total: ${total})`);
            // Trigger UI update after each page
            if (onPageSynced) {
                await onPageSynced();
            }
        },
        lastSyncTime
    );
    
    // Update last sync time
    // If first-time sync, always save (use mostRecentDateTime or current time)
    // If incremental sync, only update if we have a more recent date_time
    if (!lastSyncTime) {
        // First-time sync: always save sync time
        const syncTimeToSave = result.mostRecentDateTime || new Date().toISOString();
        await chatStorage.setLastSyncTime('groups', syncTimeToSave);
        console.log(`[Messenger API] Set groups last sync time to ${syncTimeToSave}`);
    } else if (result.mostRecentDateTime) {
        // Incremental sync: only update if we have a more recent date_time
        const mostRecentTimestamp = new Date(result.mostRecentDateTime).getTime();
        const lastSyncTimestamp = new Date(lastSyncTime).getTime();
        if (mostRecentTimestamp >= lastSyncTimestamp) {
            await chatStorage.setLastSyncTime('groups', result.mostRecentDateTime);
            console.log(`[Messenger API] Updated groups last sync time to ${result.mostRecentDateTime}`);
        }
    }
    
    console.log(`[Messenger API] Synced ${result.totalSynced} groups chats`);
    return result.totalSynced;
}

/**
 * Sync chats for a specific folder
 * Uses incremental sync: first time fetches all pages, subsequent times only fetches new chats
 * Upserts chats incrementally after each page for fast updates
 * @param folderId The folder ID to sync chats for
 * @param onPageSynced Optional callback called after each page is synced (for UI updates)
 * @returns Total number of chats synced
 */
export async function syncFolderChats(folderId: number, onPageSynced?: () => void | Promise<void>): Promise<number> {
    console.log(`[Messenger API] Syncing chats for folder ${folderId}...`);
    
    // Get last sync time for incremental sync
    const lastSyncTime = await chatStorage.getFolderLastSyncTime(folderId);
    
    if (lastSyncTime) {
        console.log(`[Messenger API] Incremental sync for folder ${folderId}: last sync was at ${lastSyncTime}`);
    } else {
        console.log(`[Messenger API] First-time sync for folder ${folderId}: fetching all pages`);
    }
    
    // Sync folder chats with incremental sync support
    const result = await chatStorage.syncChatsFromEndpoint(
        (page) => getMessengerFolderItems(folderId, page),
        async (chats, total) => {
            console.log(`[Messenger API] Synced ${chats.length} chats from folder ${folderId} (total: ${total})`);
            // Trigger UI update after each page
            if (onPageSynced) {
                await onPageSynced();
            }
        },
        lastSyncTime
    );
    
    // Update last sync time
    // If first-time sync, always save (use mostRecentDateTime or current time)
    // If incremental sync, only update if we have a more recent date_time
    if (!lastSyncTime) {
        // First-time sync: always save sync time
        const syncTimeToSave = result.mostRecentDateTime || new Date().toISOString();
        await chatStorage.setLastSyncTime(`folder_${folderId}`, syncTimeToSave);
        console.log(`[Messenger API] Set folder ${folderId} last sync time to ${syncTimeToSave}`);
    } else if (result.mostRecentDateTime) {
        // Incremental sync: only update if we have a more recent date_time
        const mostRecentTimestamp = new Date(result.mostRecentDateTime).getTime();
        const lastSyncTimestamp = new Date(lastSyncTime).getTime();
        if (mostRecentTimestamp >= lastSyncTimestamp) {
            await chatStorage.setLastSyncTime(`folder_${folderId}`, result.mostRecentDateTime);
            console.log(`[Messenger API] Updated folder ${folderId} last sync time to ${result.mostRecentDateTime}`);
        }
    }
    
    console.log(`[Messenger API] Synced ${result.totalSynced} chats from folder ${folderId}`);
    return result.totalSynced;
}

/**
 * Get messenger_chat_details data (messages for a specific chat)
 * @param dbId The DB_ID of the other user/chat
 * @param groupId The GroupID of the chat
 * @param type The type of chat (default: 0)
 * @param page Page number (default: 0)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Chat details with messages
 */
export async function getMessengerChatDetails(
    dbId: number,
    groupId: number,
    type: number = 0,
    page: number = 0,
    muid?: string | null
): Promise<MessengerChatDetailsResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch chat details.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_chat_details');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('DB_ID', dbId.toString());
    url.searchParams.set('type', type.toString());
    url.searchParams.set('GroupID', groupId.toString());
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
            throw new Error(`Chat Details API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Check if the response indicates a blocked chat (code 402)
        // Handle both string '402' and number 402
        const responseCode = data.info?.code;
        if (data.info && (responseCode === '402' || responseCode === 402)) {
            console.log('[SDC API] Blocked chat detected:', data.info);
            const blockedError = new Error(data.info.message || 'Chat is blocked') as Error & {
                code: string | number;
                allowed?: number;
                isBlockedChat: boolean;
            };
            blockedError.code = responseCode;
            blockedError.allowed = data.info.allowed;
            blockedError.isBlockedChat = true;
            blockedError.name = 'BlockedChatError';
            console.log('[SDC API] Throwing blocked chat error:', blockedError);
            throw blockedError;
        }
        
        // Check if the response indicates a deleted/inactive profile (code 404)
        // Handle both string '404' and number 404
        if (data.info && (responseCode === '404' || responseCode === 404)) {
            console.log('[SDC API] Deleted/inactive profile detected:', data.info);
            const deletedError = new Error(data.info.message || 'Profile is no longer available') as Error & {
                code: string | number;
                allowed?: number;
                isDeletedChat: boolean;
            };
            deletedError.code = responseCode;
            deletedError.allowed = data.info.allowed;
            deletedError.isDeletedChat = true;
            deletedError.name = 'DeletedChatError';
            console.log('[SDC API] Throwing deleted chat error:', deletedError);
            throw deletedError;
        }
        
        console.log('[SDC API] Response code:', responseCode, 'type:', typeof responseCode);
        
        return data as MessengerChatDetailsResponse;
    } catch (error) {
        // Re-throw blocked chat errors as-is
        if (error && typeof error === 'object' && 'isBlockedChat' in error && error.isBlockedChat) {
            throw error;
        }
        // Re-throw deleted chat errors as-is
        if (error && typeof error === 'object' && 'isDeletedChat' in error && error.isDeletedChat) {
            throw error;
        }
        console.error('[SDC API] Failed to fetch chat details:', error);
        throw error;
    }
}

/**
 * Get messenger_archives data (archived chat list)
 * @param page Page number (default: 0)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Messenger chat list data for archives
 */
export async function getMessengerArchives(
    page: number = 0,
    muid?: string | null
): Promise<MessengerLatestResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch messenger archives.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_archives');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('search_member', ''); // Empty for now, client-side filtering

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
            throw new Error(`Messenger Archives API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as MessengerLatestResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch messenger archives:', error);
        throw error;
    }
}

/**
 * Sync archived chats from messenger_archives endpoint
 * Uses incremental sync: first time fetches all pages, subsequent times only fetches new chats
 * Upserts chats incrementally after each page for fast updates
 * @param onPageSynced Optional callback called after each page is synced (for UI updates)
 * @returns Total number of chats synced
 */
export async function syncArchivesChats(onPageSynced?: () => void | Promise<void>): Promise<number> {
    console.log('[Messenger API] Syncing archived chats...');
    
    // Get last sync time for incremental sync
    const lastSyncTime = await chatStorage.getArchivesLastSyncTime();
    
    if (lastSyncTime) {
        console.log(`[Messenger API] Incremental sync for archives: last sync was at ${lastSyncTime}`);
    } else {
        console.log('[Messenger API] First-time sync for archives: fetching all pages');
    }
    
    // Sync archives with incremental sync support
    // Mark chats as archived when storing
    const result = await chatStorage.syncChatsFromEndpoint(
        (page) => getMessengerArchives(page),
        async (chats, total) => {
            console.log(`[Messenger API] Synced ${chats.length} archived chats (total: ${total})`);
            // Mark chats as archived and upsert
            await chatStorage.upsertChats(chats, true); // true = markAsArchived
            // Trigger UI update after each page
            if (onPageSynced) {
                await onPageSynced();
            }
        },
        lastSyncTime
    );
    
    // Update last sync time
    if (!lastSyncTime) {
        const syncTimeToSave = result.mostRecentDateTime || new Date().toISOString();
        await chatStorage.setLastSyncTime('archives', syncTimeToSave);
        console.log(`[Messenger API] Set archives last sync time to ${syncTimeToSave}`);
    } else if (result.mostRecentDateTime) {
        const mostRecentTimestamp = new Date(result.mostRecentDateTime).getTime();
        const lastSyncTimestamp = new Date(lastSyncTime).getTime();
        if (mostRecentTimestamp >= lastSyncTimestamp) {
            await chatStorage.setLastSyncTime('archives', result.mostRecentDateTime);
            console.log(`[Messenger API] Updated archives last sync time to ${result.mostRecentDateTime}`);
        }
    }
    
    console.log(`[Messenger API] Synced ${result.totalSynced} archived chats`);
    return result.totalSynced;
}

/**
 * Sync only chats that haven't been synced yet (no sync date)
 * Checks inbox, archives, and all folders for sync times and only syncs those without sync dates
 * @param onPageSynced Optional callback called after each page is synced (for UI updates)
 * @param onFolderSynced Optional callback called after each folder/area is synced (for UI updates)
 * @returns Total number of chats synced
 */
export async function syncUnsyncedChats(
    onPageSynced?: () => void | Promise<void>,
    onFolderSynced?: (folderName: string) => void | Promise<void>
): Promise<number> {
    console.log('[Messenger API] Syncing unsynced chats...');
    let totalSynced = 0;

    // Check inbox sync time
    const inboxSyncTime = await chatStorage.getInboxLastSyncTime();
    if (!inboxSyncTime) {
        console.log('[Messenger API] Inbox has no sync date, syncing inbox...');
        const inboxCount = await syncInboxChats(onPageSynced);
        totalSynced += inboxCount;
        if (onFolderSynced) {
            await onFolderSynced('inbox');
        }
    } else {
        console.log('[Messenger API] Inbox already synced, skipping');
    }

    // Check groups sync time
    const groupsSyncTime = await chatStorage.getGroupsLastSyncTime();
    if (!groupsSyncTime) {
        console.log('[Messenger API] Groups have no sync date, syncing groups...');
        try {
            const groupsCount = await syncGroupsChats(onPageSynced);
            totalSynced += groupsCount;
            if (onFolderSynced) {
                await onFolderSynced('groups');
            }
        } catch (err) {
            console.error('[Messenger API] Failed to sync groups:', err);
        }
    } else {
        console.log('[Messenger API] Groups already synced, skipping');
    }

    // Check archives sync time
    const archivesSyncTime = await chatStorage.getArchivesLastSyncTime();
    if (!archivesSyncTime) {
        console.log('[Messenger API] Archives have no sync date, syncing archives...');
        try {
            const archivesCount = await syncArchivesChats(onPageSynced);
            totalSynced += archivesCount;
            if (onFolderSynced) {
                await onFolderSynced('archives');
            }
        } catch (err) {
            console.error('[Messenger API] Failed to sync archives:', err);
        }
    } else {
        console.log('[Messenger API] Archives already synced, skipping');
    }

    // Check each folder sync time
    const folderList = await folderStorage.getAllFolders();
    for (const folder of folderList) {
        const folderSyncTime = await chatStorage.getFolderLastSyncTime(folder.id);
        if (!folderSyncTime) {
            console.log(`[Messenger API] Folder ${folder.id} has no sync date, syncing...`);
            try {
                const folderCount = await syncFolderChats(folder.id, onPageSynced);
                totalSynced += folderCount;
                if (onFolderSynced) {
                    await onFolderSynced(folder.name);
                }
            } catch (err) {
                console.error(`[Messenger API] Failed to sync folder ${folder.id}:`, err);
            }
        } else {
            console.log(`[Messenger API] Folder ${folder.id} already synced, skipping`);
        }
    }

    console.log(`[Messenger API] Synced ${totalSynced} total unsynced chats`);
    return totalSynced;
}

/**
 * Sync all chats but limit to first page only (page 0)
 * Clears all sync times first to force resync, then syncs only first page
 * @param onPageSynced Optional callback called after each page is synced (for UI updates)
 * @param onFolderSynced Optional callback called after each folder/area is synced (for UI updates)
 * @returns Total number of chats synced
 */
export async function syncAllChatsFirstPageOnly(
    onPageSynced?: () => void | Promise<void>,
    onFolderSynced?: (folderName: string, page: number) => void | Promise<void>
): Promise<number> {
    console.log('[Messenger API] Syncing all chats (first page only)...');
    let totalSynced = 0;

    // Sync inbox (first page only)
    const inboxResult = await chatStorage.syncChatsFromEndpoint(
        (page) => getMessengerLatest(page),
        async (chats, total) => {
            console.log(`[Messenger API] Synced ${chats.length} inbox chats (total: ${total})`);
            if (onPageSynced) {
                await onPageSynced();
            }
        },
        null, // No lastSyncTime - force resync
        1 // maxPages = 1 (only first page)
    );
    totalSynced += inboxResult.totalSynced;
    if (onFolderSynced) {
        await onFolderSynced('inbox', 0);
    }

    // Sync groups (first page only)
    try {
        const groupsResult = await chatStorage.syncChatsFromEndpoint(
            (page) => getMessengerGroups(page),
            async (chats, total) => {
                console.log(`[Messenger API] Synced ${chats.length} groups chats (total: ${total})`);
                if (onPageSynced) {
                    await onPageSynced();
                }
            },
            null, // No lastSyncTime - force resync
            1 // maxPages = 1 (only first page)
        );
        totalSynced += groupsResult.totalSynced;
        if (onFolderSynced) {
            await onFolderSynced('groups', 0);
        }
    } catch (err) {
        console.error('[Messenger API] Failed to sync groups:', err);
    }

    // Sync each folder (first page only)
    const folderList = await folderStorage.getAllFolders();
    for (const folder of folderList) {
        try {
            const folderResult = await chatStorage.syncChatsFromEndpoint(
                (page) => getMessengerFolderItems(folder.id, page),
                async (chats, total) => {
                    console.log(`[Messenger API] Synced ${chats.length} chats from folder ${folder.id} (total: ${total})`);
                    if (onPageSynced) {
                        await onPageSynced();
                    }
                },
                null, // No lastSyncTime - force resync
                1 // maxPages = 1 (only first page)
            );
            totalSynced += folderResult.totalSynced;
            if (onFolderSynced) {
                await onFolderSynced(folder.name, 0);
            }
        } catch (err) {
            console.error(`[Messenger API] Failed to sync folder ${folder.id}:`, err);
        }
    }

    // Sync archives (first page only)
    try {
        const archivesResult = await chatStorage.syncChatsFromEndpoint(
            (page) => getMessengerArchives(page),
            async (chats, total) => {
                console.log(`[Messenger API] Synced ${chats.length} archived chats (total: ${total})`);
                // Mark chats as archived and upsert
                await chatStorage.upsertChats(chats, true); // true = markAsArchived
                if (onPageSynced) {
                    await onPageSynced();
                }
            },
            null, // No lastSyncTime - force resync
            1 // maxPages = 1 (only first page)
        );
        totalSynced += archivesResult.totalSynced;
        if (onFolderSynced) {
            await onFolderSynced('archives', 0);
        }
    } catch (err) {
        console.error('[Messenger API] Failed to sync archives:', err);
    }

    console.log(`[Messenger API] Synced ${totalSynced} total chats (first page only)`);
    return totalSynced;
}

/**
 * Delete a message
 * @param groupId The GroupID of the chat
 * @param messageId The message_id to delete
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Response with deletion status
 */
export async function deleteMessage(
    groupId: number,
    messageId: number,
    muid?: string | null
): Promise<{ info: { code: number; message: string; last_message: string } }> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot delete message.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_del_message');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('group_Id', groupId.toString());
    url.searchParams.set('message_id', messageId.toString());

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
            throw new Error(`Delete Message API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[SDC API] Failed to delete message:', error);
        throw error;
    }
}

/**
 * Get gallery photos for a specific gallery ID
 * @param galleryId The gallery ID from the message
 * @param dbId The DB ID of the user who owns the gallery
 * @param password Optional password for password-protected galleries
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Gallery photos response
 */
export async function getGalleryPhotos(
    galleryId: string,
    dbId: string,
    password?: string,
    muid?: string | null
): Promise<GalleryPhotosResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch gallery photos.');
    }

    const url = new URL('https://api.sdc.com/v1/photo_album_pics');
    url.searchParams.set('muid', dbId); // Use dbId as muid parameter

    // Create form data
    const formData = new FormData();
    formData.append('id', galleryId);
    formData.append('pass', password || '');
    formData.append('step', '1');
    formData.append('client_token', '0');
    formData.append('dbid', dbId);

    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            credentials: 'include', // Include cookies for authentication
            body: formData,
        });

        const data = await response.json();
        
        // Check if response indicates password required (403 with Invalid password message)
        if (response.status === 403 || (data.info && data.info.code === 403 && data.info.message === 'Invalid password')) {
            return data as GalleryPhotosResponse; // Return the error response so caller can handle it
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gallery Photos API request failed: ${response.status} - ${errorText}`);
        }

        return data as GalleryPhotosResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch gallery photos:', error);
        throw error;
    }
}

/**
 * Load albums for a user
 * @param dbId The DB ID of the user whose albums to load
 * @returns Albums response
 */
export async function loadAlbums(dbId: string): Promise<AlbumsResponse> {
    const url = new URL('https://api.sdc.com/v1/load_albums');
    url.searchParams.set('muid', dbId);

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
            throw new Error(`Load Albums API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as AlbumsResponse;
    } catch (error) {
        console.error('[SDC API] Failed to load albums:', error);
        throw error;
    }
}

/**
 * Mark a broadcast as read
 * @param muid The MUID of the current user
 * @param broadcastId The ID of the broadcast to mark as read
 * @returns Response indicating success
 */
export async function readBroadcast(
    muid: string,
    broadcastId: number
): Promise<{ info: { code: number | string; message?: string } }> {
    const url = new URL('https://api.sdc.com/v1/messenger_read_broadcast');
    url.searchParams.set('muid', muid);
    url.searchParams.set('broadcast_id', broadcastId.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Read Broadcast API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[SDC API] Failed to read broadcast:', error);
        throw error;
    }
}

/**
 * Pin or unpin a chat
 * @param groupId The group ID of the chat to pin/unpin
 * @param pin Pin status: 1 to pin, 0 to unpin
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Response indicating success
 */
export async function pinChat(
    groupId: number,
    pin: 0 | 1,
    muid?: string | null
): Promise<PinChatResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot pin/unpin chat.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_pin_chat');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('group_id', groupId.toString());
    url.searchParams.set('pin', pin.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pin Chat API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json() as PinChatResponse;
        
        // Check if the operation was successful
        if (!data.info.success || data.info.code !== 200) {
            throw new Error(data.info.message || 'Failed to pin/unpin chat');
        }

        return data;
    } catch (error) {
        console.error('[SDC API] Failed to pin/unpin chat:', error);
        throw error;
    }
}

/**
 * Mark a chat as read or unread
 * @param groupId The group ID of the chat to mark
 * @param action Action: 1 to mark as unread, 0 to mark as read
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Response indicating success
 */
export async function markChatUnread(
    groupId: number,
    action: 0 | 1,
    muid?: string | null
): Promise<MarkUnreadResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot mark chat as read/unread.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_mark_unread');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('group_id', groupId.toString());
    url.searchParams.set('action', action.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mark Unread API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json() as MarkUnreadResponse;
        
        // Check if the operation was successful
        if (!data.info.updated || data.info.code !== 200) {
            throw new Error(data.info.message || 'Failed to mark chat as read/unread');
        }

        return data;
    } catch (error) {
        console.error('[SDC API] Failed to mark chat as read/unread:', error);
        throw error;
    }
}

/**
 * Search for users globally
 * @param search The search query (username/account_id)
 * @param searchType The type of search (default: 'ALL')
 * @param page Page number (default: 0)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Search results with user profiles
 */
export async function searchGlobalV2(
    search: string,
    searchType: string = 'ALL',
    page: number = 0,
    muid?: string | null
): Promise<SearchGlobalV2Response> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot search users.');
    }

    const url = new URL('https://api.sdc.com/v1/search_global_v2');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('search_type', searchType);
    url.searchParams.set('search', search);
    url.searchParams.set('page', page.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
                'origin': 'https://www.sdc.com',
                'referer': 'https://www.sdc.com/',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Search Global V2 API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as SearchGlobalV2Response;
    } catch (error) {
        console.error('[SDC API] Failed to search users:', error);
        throw error;
    }
}

/**
 * Start a new chat with a user
 * @param dbId The DB_ID of the user to start a chat with
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Chat details response with group_id and session info
 */
export async function startChat(
    dbId: number,
    muid?: string | null
): Promise<MessengerChatDetailsResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot start chat.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_chat_details');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('DB_ID', dbId.toString());
    url.searchParams.set('type', '0');
    url.searchParams.set('GroupID', '0'); // 0 indicates new chat
    url.searchParams.set('page', '0');

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
            throw new Error(`Start Chat API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Check if the response indicates a blocked chat (code 402)
        const responseCode = data.info?.code;
        if (data.info && (responseCode === '402' || responseCode === 402)) {
            console.log('[SDC API] Blocked chat detected:', data.info);
            const blockedError = new Error(data.info.message || 'Chat is blocked') as Error & {
                code: string | number;
                allowed?: number;
                isBlockedChat: boolean;
            };
            blockedError.code = responseCode;
            blockedError.allowed = data.info.allowed;
            blockedError.isBlockedChat = true;
            blockedError.name = 'BlockedChatError';
            throw blockedError;
        }
        
        return data as MessengerChatDetailsResponse;
    } catch (error) {
        // Re-throw blocked chat errors as-is
        if (error && typeof error === 'object' && 'isBlockedChat' in error && error.isBlockedChat) {
            throw error;
        }
        console.error('[SDC API] Failed to start chat:', error);
        throw error;
    }
}

/**
 * Delete a broadcast
 * @param broadcastId The ID of the broadcast to delete
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Response indicating success
 */
export async function deleteBroadcast(
    broadcastId: number,
    muid?: string | null
): Promise<{ info: { code: number | string; message: string } }> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot delete broadcast.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_delete_broadcast');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('broadcast_id', broadcastId.toString());

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
            throw new Error(`Delete Broadcast API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Check if the operation was successful
        const responseCode = data.info?.code;
        if (responseCode !== 200 && responseCode !== '200') {
            throw new Error(data.info?.message || 'Failed to delete broadcast');
        }

        return data;
    } catch (error) {
        console.error('[SDC API] Failed to delete broadcast:', error);
        throw error;
    }
}

/**
 * Delete a conversation
 * @param groupId The Group_ID of the conversation to delete
 * @param dbId The DB_ID of the conversation to delete
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Response indicating success
 */
export async function deleteConversation(
    groupId: number,
    dbId: number,
    muid?: string | null
): Promise<{ info: { code: number | string; message: string } }> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot delete conversation.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_delete_conversation');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('Group_ID', groupId.toString());
    url.searchParams.set('DB_ID', dbId.toString());

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
            throw new Error(`Delete Conversation API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Check if the operation was successful
        const responseCode = data.info?.code;
        if (responseCode !== 200 && responseCode !== '200') {
            throw new Error(data.info?.message || 'Failed to delete conversation');
        }

        return data;
    } catch (error) {
        console.error('[SDC API] Failed to delete conversation:', error);
        throw error;
    }
}

/**
 * Get messenger_groups_gm data (group chat list)
 * @param page Page number (default: 0)
 * @param t1 Optional timestamp (default: current timestamp)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Messenger group list data
 */
export async function getMessengerGroups(
    page: number = 0,
    t1?: number,
    muid?: string | null
): Promise<MessengerLatestResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch messenger groups.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_groups_gm');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('page', page.toString());
    if (t1 !== undefined) {
        url.searchParams.set('t1', t1.toString());
    }

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
                'origin': 'https://www.sdc.com',
                'referer': 'https://www.sdc.com/',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Messenger Groups API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as MessengerLatestResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch messenger groups:', error);
        throw error;
    }
}

/**
 * Get messenger_chat_details_gm data (messages for a specific group)
 * @param groupId The GroupID of the group (string)
 * @param page Page number (default: 0)
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Chat details with messages
 */
export async function getMessengerGroupChatDetails(
    groupId: string,
    page: number = 0,
    muid?: string | null
): Promise<MessengerChatDetailsResponse> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch group chat details.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_chat_details_gm');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('DB_ID', 'undefined');
    url.searchParams.set('type', '1');
    url.searchParams.set('GroupID', groupId);
    url.searchParams.set('page', page.toString());

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
                'origin': 'https://www.sdc.com',
                'referer': 'https://www.sdc.com/',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Group Chat Details API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as MessengerChatDetailsResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch group chat details:', error);
        throw error;
    }
}

/**
 * Get messenger_contacts data (group members)
 * @param groupId The GroupID of the group (string)
 * @param targetDbId The target_db_id from group chat details (should be used as muid)
 * @param page Page number (default: 0)
 * @param searchMember Search query for members (default: empty string)
 * @param muid Optional MUID fallback (will be extracted from cookies if not provided and targetDbId not provided)
 * @returns Group contacts/members response
 */
export async function getMessengerGroupContacts(
    groupId: string,
    targetDbId?: number | null,
    page: number = 0,
    searchMember: string = '',
    muid?: string | null
): Promise<MessengerGroupContactsResponse> {
    // Use target_db_id as muid if provided, otherwise fall back to current muid
    const currentMuid = targetDbId ? targetDbId.toString() : (muid || getCurrentMuid());

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch group contacts.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_contacts');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('search_member', searchMember);
    // Note: messenger_contacts is context-aware - it reads the group from the referer URL
    // Set referer to the group messenger page so the API knows which group's contacts to fetch

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
                'origin': 'https://www.sdc.com',
                'referer': `https://www.sdc.com/react/#/messenger?id=${groupId}&type=1&db=0`,
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Group Contacts API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as MessengerGroupContactsResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch group contacts:', error);
        throw error;
    }
}

/**
 * Get messenger_info_group_gm data (group information)
 * @param groupId The GroupID of the group (string)
 * @param targetDbId The target_db_id from group chat details (should be used as muid)
 * @param muid Optional MUID fallback (will be extracted from cookies if not provided and targetDbId not provided)
 * @returns Group info response
 */
export async function getMessengerGroupInfo(
    groupId: string,
    targetDbId?: number | null,
    muid?: string | null
): Promise<MessengerGroupInfoResponse> {
    // Use target_db_id as muid if provided, otherwise fall back to current muid
    const currentMuid = targetDbId ? targetDbId.toString() : (muid || getCurrentMuid());

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot fetch group info.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_info_group_gm');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('group_Id', groupId);

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,ar;q=0.7,nl;q=0.6',
                'origin': 'https://www.sdc.com',
                'referer': 'https://www.sdc.com/',
            },
            credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Group Info API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as MessengerGroupInfoResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch group info:', error);
        throw error;
    }
}

/**
 * Edit a folder name
 * @param folderId The ID of the folder to edit
 * @param name The new name for the folder
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Response indicating success
 */
export async function editFolder(
    folderId: number,
    name: string,
    muid?: string | null
): Promise<{ info: { code: number; message: string } }> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot edit folder.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_edit_folder');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('id', folderId.toString());
    url.searchParams.set('name', name);

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
            throw new Error(`Edit Folder API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Check if the operation was successful
        const responseCode = data.info?.code;
        if (responseCode !== 200 && responseCode !== '200') {
            throw new Error(data.info?.message || 'Failed to edit folder');
        }

        return data;
    } catch (error) {
        console.error('[SDC API] Failed to edit folder:', error);
        throw error;
    }
}

/**
 * Create a new folder
 * @param name The name for the new folder
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Response indicating success
 */
export async function createFolder(
    name: string,
    muid?: string | null
): Promise<{ info: { code: number; message: string } }> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot create folder.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_new_folder');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('name', name);

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
            throw new Error(`Create Folder API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Check if the operation was successful
        const responseCode = data.info?.code;
        if (responseCode !== 200 && responseCode !== '200') {
            throw new Error(data.info?.message || 'Failed to create folder');
        }

        return data;
    } catch (error) {
        console.error('[SDC API] Failed to create folder:', error);
        throw error;
    }
}

/**
 * Delete a folder
 * @param folderId The ID of the folder to delete
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Response indicating success
 */
export async function deleteFolder(
    folderId: number,
    muid?: string | null
): Promise<{ info: { code: number; message: string } }> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot delete folder.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_delete_folder');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('id', folderId.toString());

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
            throw new Error(`Delete Folder API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Check if the operation was successful
        const responseCode = data.info?.code;
        if (responseCode !== 200 && responseCode !== '200') {
            throw new Error(data.info?.message || 'Failed to delete folder');
        }

        return data;
    } catch (error) {
        console.error('[SDC API] Failed to delete folder:', error);
        throw error;
    }
}

/**
 * Add a chat to a folder
 * @param groupId The group_id of the chat to move
 * @param folderId The ID of the folder to move the chat to
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Response indicating success
 */
export async function addChatToFolder(
    groupId: number | string,
    folderId: number,
    muid?: string | null
): Promise<{ info: { code: number; message: string } }> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot add chat to folder.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_add_to_folder');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('folder_id', folderId.toString());
    url.searchParams.set('group_id', groupId.toString());

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
            throw new Error(`Add Chat to Folder API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Check if the operation was successful
        const responseCode = data.info?.code;
        if (responseCode !== 200 && responseCode !== '200') {
            throw new Error(data.info?.message || 'Failed to add chat to folder');
        }

        return data;
    } catch (error) {
        console.error('[SDC API] Failed to add chat to folder:', error);
        throw error;
    }
}

/**
 * Remove a chat from a folder
 * @param groupId The group_id of the chat to remove
 * @param folderId The ID of the folder to remove the chat from
 * @param muid Optional MUID (will be extracted from cookies if not provided)
 * @returns Response indicating success
 */
export async function removeChatFromFolder(
    groupId: number | string,
    folderId: number,
    muid?: string | null
): Promise<{ info: { code: number; message: string } }> {
    const currentMuid = muid || getCurrentMuid();

    if (!currentMuid) {
        throw new Error('MUID not found. Cannot remove chat from folder.');
    }

    const url = new URL('https://api.sdc.com/v1/messenger_remove_from_folder');
    url.searchParams.set('muid', currentMuid);
    url.searchParams.set('folder_id', folderId.toString());
    url.searchParams.set('group_id', groupId.toString());

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
            throw new Error(`Remove Chat from Folder API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Check if the operation was successful
        const responseCode = data.info?.code;
        if (responseCode !== 200 && responseCode !== '200') {
            throw new Error(data.info?.message || 'Failed to remove chat from folder');
        }

        return data;
    } catch (error) {
        console.error('[SDC API] Failed to remove chat from folder:', error);
        throw error;
    }
}
