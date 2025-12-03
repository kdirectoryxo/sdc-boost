/**
 * SDC API Messenger Functions
 * Functions for fetching and working with messenger/chat data
 */
import type { MessengerLatestResponse, MessengerIOV2Response, MessengerFoldersResponse, MessengerChatDetailsResponse, GalleryPhotosResponse, AlbumsResponse } from '../sdc-api-types';
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
 * @returns Total number of chats synced
 */
export async function syncAllChats(onPageSynced?: () => void | Promise<void>): Promise<number> {
    console.log('[Messenger API] Syncing all chats...');
    let totalSynced = 0;

    // Sync messenger_latest (inbox) - uses incremental sync
    const inboxCount = await syncInboxChats(onPageSynced);
    totalSynced += inboxCount;

    // Sync each folder - uses incremental sync
    const folderList = await folderStorage.getAllFolders();
    for (const folder of folderList) {
        try {
            const folderCount = await syncFolderChats(folder.id, onPageSynced);
            totalSynced += folderCount;
        } catch (err) {
            console.error(`[Messenger API] Failed to sync folder ${folder.id}:`, err);
            // Continue with other folders even if one fails
        }
    }

    // Sync archives - uses incremental sync
    try {
        const archivesCount = await syncArchivesChats(onPageSynced);
        totalSynced += archivesCount;
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
        
        console.log('[SDC API] Response code:', responseCode, 'type:', typeof responseCode);
        
        return data as MessengerChatDetailsResponse;
    } catch (error) {
        // Re-throw blocked chat errors as-is
        if (error && typeof error === 'object' && 'isBlockedChat' in error && error.isBlockedChat) {
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

