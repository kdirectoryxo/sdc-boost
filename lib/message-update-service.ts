/**
 * Message Update Service
 * Centralized service for handling counter and folder updates when messages are sent or received
 */

import { countersManager } from './counters-manager';
import { getMessengerFolders } from './sdc-api/messenger';
import { folderStorage } from './folder-storage';

/**
 * Handle message-related updates (counters and folders)
 * This function should be called whenever a message is sent or received
 * @param groupType The group type (0 = 1-on-1 chat, non-zero = group chat)
 * @param groupId The group ID
 */
export async function handleMessageUpdate(
    groupType: number,
    groupId: number | string
): Promise<void> {
    try {
        // Always refresh counters when a message is sent/received
        await countersManager.refresh();
        console.log('[MessageUpdateService] Refreshed counters');

        // If message is in a group (groupType !== 0), also refresh folders
        if (groupType !== 0) {
            console.log(`[MessageUpdateService] Message is in group (groupType: ${groupType}), refreshing folders...`);
            
            try {
                const foldersResponse = await getMessengerFolders();
                
                if (foldersResponse.info.code === 200 && foldersResponse.info.folders) {
                    // Update folder storage with new new_messages counts
                    await folderStorage.upsertFolders(foldersResponse.info.folders);
                    console.log(`[MessageUpdateService] Updated ${foldersResponse.info.folders.length} folders with new_messages counts`);
                } else {
                    console.warn('[MessageUpdateService] Invalid folders response:', foldersResponse);
                }
            } catch (error) {
                // Don't throw - folder update failure shouldn't break message flow
                console.error('[MessageUpdateService] Failed to refresh folders:', error);
            }
        }
    } catch (error) {
        // Don't throw - counter update failure shouldn't break message flow
        console.error('[MessageUpdateService] Failed to handle message update:', error);
    }
}





