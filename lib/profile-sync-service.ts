/**
 * Profile sync service
 * Handles syncing profile data for chats with batching (2 calls at once)
 */

import { getProfileV2 } from './sdc-api/profile';
import { profileStorage } from './profile-storage';
import type { MessengerChatItem, ProfileUser } from './sdc-api-types';

/**
 * Sync profiles for a list of chats
 * @param chats Array of chats to sync profiles for
 * @param reset If true, sync all chats regardless of cache. If false, only sync unsynced chats.
 */
export async function syncProfilesForChats(
    chats: MessengerChatItem[],
    reset: boolean = false
): Promise<void> {
    // Filter out broadcasts and invalid chats
    const validChats = chats.filter(chat => 
        !chat.broadcast && 
        chat.type !== 100 && 
        chat.db_id > 0
    );

    if (validChats.length === 0) {
        console.log('[ProfileSyncService] No valid chats to sync');
        return;
    }

    // Get chats to sync
    let chatsToSync: MessengerChatItem[];
    if (reset) {
        // Reset mode: sync all chats
        chatsToSync = validChats;
    } else {
        // Normal mode: only sync unsynced chats
        chatsToSync = await profileStorage.getUnsyncedChats(validChats);
    }

    if (chatsToSync.length === 0) {
        console.log('[ProfileSyncService] No chats need syncing');
        const toast = (window as any).__sdcBoostToast;
        if (toast) {
            toast.success('All profiles are already synced');
        }
        return;
    }

    // Sort chats by date_time (newest first) so newest chats are synced first
    chatsToSync.sort((a, b) => {
        const getTime = (chat: MessengerChatItem): number => {
            if (!chat.date_time || chat.date_time === '') {
                return 0;
            }
            const parsed = new Date(chat.date_time).getTime();
            return isNaN(parsed) ? 0 : parsed;
        };
        return getTime(b) - getTime(a); // Descending order (newest first)
    });

    console.log(`[ProfileSyncService] Syncing profiles for ${chatsToSync.length} chats (reset: ${reset})`);

    // Access toast from global window
    const toast = (window as any).__sdcBoostToast;
    let progressToast: { update: (current: number, total: number, message?: string) => void; dismiss: () => void } | null = null;
    
    // Cancel flag to stop sync operation
    let cancelled = false;

    try {
        // Show progress toast with cancel button
        if (toast && toast.progress) {
            progressToast = toast.progress(chatsToSync.length, () => {
                cancelled = true;
                console.log('[ProfileSyncService] Sync cancelled by user');
            });
            if (progressToast) {
                progressToast.update(0, chatsToSync.length, `Syncing profiles... (0/${chatsToSync.length})`);
            }
        }

        const syncedProfiles: ProfileUser[] = [];
        let syncedCount = 0;
        let failedCount = 0;

        // Process chats in batches of 2
        for (let i = 0; i < chatsToSync.length; i += 2) {
            if (cancelled) {
                console.log('[ProfileSyncService] Sync cancelled, stopping...');
                break;
            }

            const batch = chatsToSync.slice(i, i + 2);
            const batchPromises = batch.map(async (chat) => {
                try {
                    // Update progress before syncing
                    if (progressToast) {
                        progressToast.update(
                            i,
                            chatsToSync.length,
                            `Syncing ${chat.account_id || `chat ${chat.db_id}`}... (${i}/${chatsToSync.length})`
                        );
                    }

                    // Fetch profile from API
                    const response = await getProfileV2(chat.db_id.toString());
                    const profile = response.info.profile_user;
                    
                    // Ensure db_id is set (API might not include it)
                    if (!profile.db_id) {
                        profile.db_id = chat.db_id;
                    }
                    
                    return profile;
                } catch (err: any) {
                    // Check if this is an unavailable profile error
                    // Check both the flag and the error message as fallback
                    const isUnavailable = err && (
                        err.isUnavailableProfile === true ||
                        (typeof err.message === 'string' && (
                            err.message.includes('niet langer beschikbaar') ||
                            err.message.includes('niet meer beschikbaar') ||
                            err.message.includes('inactief of verwijderd')
                        ))
                    );
                    
                    if (isUnavailable) {
                        console.log(`[ProfileSyncService] Profile unavailable for chat ${chat.db_id}: ${err.message}`);
                        
                        // Store a minimal profile entry to mark it as "synced" (so we don't retry)
                        try {
                            const unavailableProfile: ProfileUser = {
                                db_id: chat.db_id,
                                account_id: chat.account_id || `Unavailable_${chat.db_id}`,
                                // Mark as unavailable by using a special account_id prefix or empty fields
                                // This minimal entry will prevent retrying this profile
                            };
                            await profileStorage.upsertProfile(unavailableProfile);
                            console.log(`[ProfileSyncService] Marked profile ${chat.db_id} as unavailable in database`);
                        } catch (saveErr) {
                            console.error(`[ProfileSyncService] Failed to save unavailable profile marker for ${chat.db_id}:`, saveErr);
                        }
                        
                        // Don't count unavailable profiles as failures - they're handled
                        return null; // Return null so it's filtered out, but don't increment failedCount
                    }
                    
                    // Other errors are actual failures
                    console.error(`[ProfileSyncService] Failed to fetch profile for chat ${chat.db_id}:`, err);
                    failedCount++;
                    // Update progress on error
                    if (progressToast) {
                        progressToast.update(
                            i + 1,
                            chatsToSync.length,
                            `Failed to sync ${chat.account_id || `chat ${chat.db_id}`}... (${i + 1}/${chatsToSync.length})`
                        );
                    }
                    return null;
                }
            });

            // Wait for batch to complete (2 calls in parallel)
            const batchResults = await Promise.all(batchPromises);
            
            // Filter out null results (failed fetches)
            const successfulProfiles = batchResults.filter((p): p is ProfileUser => p !== null);
            
            if (successfulProfiles.length > 0) {
                // Batch upsert successful profiles
                try {
                    await profileStorage.batchUpsertProfiles(successfulProfiles);
                    syncedProfiles.push(...successfulProfiles);
                    syncedCount += successfulProfiles.length;
                } catch (err) {
                    console.error('[ProfileSyncService] Failed to save profiles to database:', err);
                    failedCount += successfulProfiles.length;
                }
            }

            // Update progress after batch
            if (progressToast && !cancelled) {
                const currentIndex = Math.min(i + batch.length, chatsToSync.length);
                progressToast.update(
                    currentIndex,
                    chatsToSync.length,
                    `Synced ${syncedCount} profile${syncedCount !== 1 ? 's' : ''}... (${currentIndex}/${chatsToSync.length})`
                );
            }

            console.log(`[ProfileSyncService] Processed batch ${Math.floor(i / 2) + 1}, synced ${syncedCount} profiles so far`);
        }

        // Dismiss progress toast
        if (progressToast) {
            progressToast.dismiss();
        }

        if (cancelled) {
            console.log(`[ProfileSyncService] Sync cancelled. Synced ${syncedCount}/${chatsToSync.length} profiles before cancellation`);
            if (toast) {
                toast.error(`Sync cancelled. Synced ${syncedCount} profile${syncedCount !== 1 ? 's' : ''} before cancellation`);
            }
        } else {
            console.log(`[ProfileSyncService] Successfully synced ${syncedCount}/${chatsToSync.length} profiles (${failedCount} failed)`);
            if (toast) {
                if (failedCount > 0) {
                    toast.error(`Synced ${syncedCount} profile${syncedCount !== 1 ? 's' : ''}, ${failedCount} failed`);
                } else {
                    toast.success(`Synced ${syncedCount} profile${syncedCount !== 1 ? 's' : ''}`);
                }
            }
        }
    } catch (err) {
        console.error('[ProfileSyncService] Failed to sync profiles:', err);
        
        // Dismiss progress toast if it exists
        if (progressToast) {
            progressToast.dismiss();
        }
        
        if (toast) {
            toast.error('Failed to sync profiles');
        }
        throw err;
    }
}
