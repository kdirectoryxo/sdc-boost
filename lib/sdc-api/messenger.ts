/**
 * SDC API Messenger Functions
 * Functions for fetching and working with messenger/chat data
 */
import type { MessengerLatestResponse, MessengerIOV2Response, MessengerFoldersResponse, MessengerChatDetailsResponse } from '../sdc-api-types';
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
 * Upserts chats incrementally after each page for fast updates
 * @param onPageSynced Optional callback called after each page is synced (for UI updates)
 * @returns Total number of chats synced
 */
export async function syncAllChats(onPageSynced?: () => void | Promise<void>): Promise<number> {
    console.log('[Messenger API] Syncing all chats...');
    let totalSynced = 0;

    // Sync messenger_latest (inbox)
    console.log('[Messenger API] Syncing inbox chats...');
    const inboxCount = await chatStorage.syncChatsFromEndpoint(
        (page) => getMessengerLatest(page),
        async (chats, total) => {
            console.log(`[Messenger API] Synced ${chats.length} inbox chats (total: ${total})`);
            // Trigger UI update after each page
            if (onPageSynced) {
                await onPageSynced();
            }
        }
    );
    totalSynced += inboxCount;
    console.log(`[Messenger API] Synced ${inboxCount} inbox chats`);

    // Sync each folder
    const folderList = await folderStorage.getAllFolders();
    for (const folder of folderList) {
        try {
            console.log(`[Messenger API] Syncing folder "${folder.name}" (${folder.id})...`);
            const folderCount = await chatStorage.syncChatsFromEndpoint(
                (page) => getMessengerFolderItems(folder.id, page),
                async (chats, total) => {
                    console.log(`[Messenger API] Synced ${chats.length} chats from folder "${folder.name}" (total: ${total})`);
                    // Trigger UI update after each page
                    if (onPageSynced) {
                        await onPageSynced();
                    }
                }
            );
            totalSynced += folderCount;
            console.log(`[Messenger API] Synced ${folderCount} chats from folder "${folder.name}"`);
        } catch (err) {
            console.error(`[Messenger API] Failed to sync folder ${folder.id}:`, err);
            // Continue with other folders even if one fails
        }
    }

    console.log(`[Messenger API] Synced ${totalSynced} total chats`);
    return totalSynced;
}

/**
 * Sync inbox chats (messenger_latest) only
 * Removes existing inbox chats first, then syncs fresh data
 * Upserts chats incrementally after each page for fast updates
 * @param onPageSynced Optional callback called after each page is synced (for UI updates)
 * @returns Total number of chats synced
 */
export async function syncInboxChats(onPageSynced?: () => void | Promise<void>): Promise<number> {
    console.log('[Messenger API] Syncing inbox chats...');
    
    // Remove existing inbox chats
    await chatStorage.removeInboxChats();
    
    // Sync messenger_latest
    const count = await chatStorage.syncChatsFromEndpoint(
        (page) => getMessengerLatest(page),
        async (chats, total) => {
            console.log(`[Messenger API] Synced ${chats.length} inbox chats (total: ${total})`);
            // Trigger UI update after each page
            if (onPageSynced) {
                await onPageSynced();
            }
        }
    );
    
    console.log(`[Messenger API] Synced ${count} inbox chats`);
    return count;
}

/**
 * Sync chats for a specific folder
 * Removes existing chats for that folder first, then syncs fresh data
 * Upserts chats incrementally after each page for fast updates
 * @param folderId The folder ID to sync chats for
 * @param onPageSynced Optional callback called after each page is synced (for UI updates)
 * @returns Total number of chats synced
 */
export async function syncFolderChats(folderId: number, onPageSynced?: () => void | Promise<void>): Promise<number> {
    console.log(`[Messenger API] Syncing chats for folder ${folderId}...`);
    
    // Remove existing chats for this folder
    await chatStorage.removeChatsByFolderId(folderId);
    
    // Sync folder chats
    const count = await chatStorage.syncChatsFromEndpoint(
        (page) => getMessengerFolderItems(folderId, page),
        async (chats, total) => {
            console.log(`[Messenger API] Synced ${chats.length} chats from folder ${folderId} (total: ${total})`);
            // Trigger UI update after each page
            if (onPageSynced) {
                await onPageSynced();
            }
        }
    );
    
    console.log(`[Messenger API] Synced ${count} chats from folder ${folderId}`);
    return count;
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
        return data as MessengerChatDetailsResponse;
    } catch (error) {
        console.error('[SDC API] Failed to fetch chat details:', error);
        throw error;
    }
}

