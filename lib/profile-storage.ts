/**
 * IndexedDB storage manager for user profiles using Dexie
 * Handles storing and retrieving profile data
 */

import { db, type ProfileEntity } from './db';
import type { ProfileUser, MessengerChatItem } from './sdc-api-types';

/**
 * Sanitize profile data to ensure it can be stored in IndexedDB
 * Handles non-serializable objects and circular references
 */
function sanitizeProfileForStorage(profile: ProfileUser): ProfileUser {
    // Use JSON serialization to ensure all data is IndexedDB-compatible
    // This removes any non-serializable properties (functions, circular refs, etc.)
    let sanitized: ProfileUser;
    try {
        sanitized = JSON.parse(JSON.stringify(profile));
    } catch (e) {
        console.error('[ProfileStorage] Failed to sanitize profile:', e);
        // Fallback: shallow copy
        sanitized = { ...profile };
    }
    return sanitized;
}

class ProfileStorage {
    /**
     * Get a profile by db_id
     */
    async getProfile(dbId: number): Promise<ProfileUser | null> {
        try {
            const profileEntity = await db.profiles.get(dbId);
            if (!profileEntity) {
                return null;
            }
            
            // ProfileUser includes db_id, so return it as-is
            return profileEntity as ProfileUser;
        } catch (error) {
            console.error(`[ProfileStorage] Failed to get profile ${dbId}:`, error);
            return null;
        }
    }

    /**
     * Upsert a single profile (insert or update)
     */
    async upsertProfile(profile: ProfileUser): Promise<void> {
        if (!profile.db_id) {
            throw new Error('Profile must have db_id');
        }

        const sanitized = sanitizeProfileForStorage(profile);
        const profileEntity: ProfileEntity = {
            ...sanitized,
            db_id: profile.db_id,
        };

        try {
            await db.profiles.put(profileEntity);
            console.log(`[ProfileStorage] Upserted profile for db_id ${profile.db_id}`);
        } catch (error) {
            console.error(`[ProfileStorage] Failed to upsert profile ${profile.db_id}:`, error);
            throw error;
        }
    }

    /**
     * Batch upsert multiple profiles
     */
    async batchUpsertProfiles(profiles: ProfileUser[]): Promise<void> {
        if (profiles.length === 0) {
            return;
        }

        const profileEntities: ProfileEntity[] = profiles.map(profile => {
            if (!profile.db_id) {
                throw new Error('Profile must have db_id');
            }
            const sanitized = sanitizeProfileForStorage(profile);
            return {
                ...sanitized,
                db_id: profile.db_id,
            };
        });

        try {
            await db.profiles.bulkPut(profileEntities);
            console.log(`[ProfileStorage] Batch upserted ${profiles.length} profiles`);
        } catch (error) {
            console.error(`[ProfileStorage] Failed to batch upsert profiles:`, error);
            throw error;
        }
    }

    /**
     * Check if a profile has been synced (exists in database)
     */
    async hasProfileBeenSynced(dbId: number): Promise<boolean> {
        try {
            const count = await db.profiles.where('db_id').equals(dbId).count();
            return count > 0;
        } catch (error) {
            console.error(`[ProfileStorage] Failed to check if profile ${dbId} exists:`, error);
            return false;
        }
    }

    /**
     * Filter chats to only include those without synced profiles
     */
    async getUnsyncedChats(chats: MessengerChatItem[]): Promise<MessengerChatItem[]> {
        // Filter out broadcasts and invalid db_ids
        const validChats = chats.filter(chat => 
            !chat.broadcast && 
            chat.type !== 100 && 
            chat.db_id > 0
        );

        if (validChats.length === 0) {
            return [];
        }

        // Get all db_ids that exist in profiles table
        const dbIds = validChats.map(chat => chat.db_id);
        const existingDbIds = new Set<number>();
        
        try {
            // Query in batches to avoid performance issues
            const batchSize = 100;
            for (let i = 0; i < dbIds.length; i += batchSize) {
                const batch = dbIds.slice(i, i + batchSize);
                const existing = await db.profiles
                    .where('db_id')
                    .anyOf(batch)
                    .toArray();
                existing.forEach(p => existingDbIds.add(p.db_id));
            }
        } catch (error) {
            console.error('[ProfileStorage] Failed to check existing profiles:', error);
            // On error, assume all are unsynced to be safe
            return validChats;
        }

        // Return only chats that don't have profiles
        return validChats.filter(chat => !existingDbIds.has(chat.db_id));
    }

    /**
     * Delete a profile by db_id
     */
    async deleteProfile(dbId: number): Promise<void> {
        try {
            await db.profiles.delete(dbId);
            console.log(`[ProfileStorage] Deleted profile ${dbId}`);
        } catch (error) {
            console.error(`[ProfileStorage] Failed to delete profile ${dbId}:`, error);
            throw error;
        }
    }

    /**
     * Get all profiles (for debugging/admin purposes)
     */
    async getAllProfiles(): Promise<ProfileUser[]> {
        try {
            const entities = await db.profiles.toArray();
            // ProfileUser includes db_id, so return entities as-is
            return entities as ProfileUser[];
        } catch (error) {
            console.error('[ProfileStorage] Failed to get all profiles:', error);
            return [];
        }
    }
}

// Export singleton instance
export const profileStorage = new ProfileStorage();
