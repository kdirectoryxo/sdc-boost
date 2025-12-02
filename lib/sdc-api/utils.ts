/**
 * SDC API Utility Functions
 * Helper functions for extracting IDs and user information
 */

/**
 * Get the current user's MUID from cookies or localStorage
 */
export function getCurrentMuid(): string | null {
    // Try to get muid from cookies first
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'profile' && value) {
            // Profile cookie might contain the muid
            // Format might be like: 0210110 where the number is the muid
            const muid = value.replace(/^0+/, ''); // Remove leading zeros
            if (muid) {
                console.log('[SDC API] Found muid from profile cookie:', muid);
                return muid;
            }
        }
    }

    // Fallback: Try to get from localStorage user_info
    try {
        const userInfoStr = localStorage.getItem('user_info');
        if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            // Check for sid (Session ID) which is likely the MUID
            if (userInfo.sid) {
                const muid = String(userInfo.sid);
                console.log('[SDC API] Found muid from localStorage user_info.sid:', muid);
                return muid;
            }
            // Also check messengerConnId as alternative
            if (userInfo.messengerConnId) {
                const muid = String(userInfo.messengerConnId);
                console.log('[SDC API] Found muid from localStorage user_info.messengerConnId:', muid);
                return muid;
            }
        }
    } catch (error) {
        console.warn('[SDC API] Error reading user_info from localStorage:', error);
    }

    console.warn('[SDC API] Could not find muid from cookies or localStorage');
    return null;
}

/**
 * Get TargetDB_ID from URL or page elements
 */
export function getTargetDBId(): string | null {
    // Try to get from URL parameter
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const dbId = urlParams.get('db');
    if (dbId) {
        console.log('[SDC API] Found TargetDB_ID from URL:', dbId);
        return dbId;
    }

    // Try to get from header image src
    const headerImage = document.querySelector('#header-container img.cursor-pointer.disableSave') as HTMLImageElement;
    if (headerImage && headerImage.src) {
        // Extract ID from URL like: https://pictures.sdc.com/photos/6558381/thumbnail/...
        const match = headerImage.src.match(/\/photos\/(\d+)\//);
        if (match && match[1]) {
            console.log('[SDC API] Found TargetDB_ID from image:', match[1]);
            return match[1];
        }
    }

    console.warn('[SDC API] Could not find TargetDB_ID');
    return null;
}

/**
 * Get current user's DB_ID from localStorage or cookies
 */
export function getCurrentDBId(): string | null {
    try {
        const userInfoStr = localStorage.getItem('user_info');
        if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            // Check directly on userInfo first (snake_case)
            if (userInfo.db_id) {
                return String(userInfo.db_id);
            }
            // Check inside user object (both snake_case and camelCase)
            if (userInfo.user) {
                if (userInfo.user.db_id) {
                    return String(userInfo.user.db_id);
                }
                if (userInfo.user.dbId) {
                    return String(userInfo.user.dbId);
                }
            }
        }
    } catch (error) {
        console.warn('[SDC API] Error reading DB_ID from localStorage:', error);
    }
    return null;
}

/**
 * Get ConnID from localStorage
 */
export function getConnId(): string | null {
    try {
        const userInfoStr = localStorage.getItem('user_info');
        if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            // Check directly on userInfo first
            if (userInfo.messengerConnId) {
                return String(userInfo.messengerConnId);
            }
            // Check inside user object
            if (userInfo.user && userInfo.user.messengerConnId) {
                return String(userInfo.user.messengerConnId);
            }
        }
    } catch (error) {
        console.warn('[SDC API] Error reading ConnID from localStorage:', error);
    }
    return null;
}

/**
 * Get ID1 (device ID) from localStorage or generate one
 */
export function getId1(): string | null {
    try {
        let id1 = localStorage.getItem('ID1');
        if (!id1) {
            // Generate a new ID1 if it doesn't exist (format: UUID-UUID)
            const uuid1 = crypto.randomUUID();
            const uuid2 = crypto.randomUUID();
            id1 = `${uuid1}-${uuid2}`;
            localStorage.setItem('ID1', id1);
            console.log('[SDC API] Generated new ID1:', id1);
        }
        return id1;
    } catch (error) {
        console.warn('[SDC API] Error reading/generating ID1:', error);
        // Fallback: generate a simple ID
        try {
            const fallbackId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('ID1', fallbackId);
            return fallbackId;
        } catch {
            return null;
        }
    }
}

/**
 * Get client_token from localStorage
 */
export function getClientToken(): string | null {
    try {
        const token = localStorage.getItem('client_token');
        if (token) {
            return token;
        }
    } catch (error) {
        console.warn('[SDC API] Error reading client_token from localStorage:', error);
    }
    return null;
}

/**
 * Get messenger_hh (hash) from localStorage or generate from user info
 */
export function getMessengerHash(): string | null {
    try {
        const hash = localStorage.getItem('messenger_hh');
        if (hash) {
            return hash;
        }
        // Try to get from user_info
        const userInfoStr = localStorage.getItem('user_info');
        if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            if (userInfo.messenger_hh) {
                return userInfo.messenger_hh;
            }
        }
    } catch (error) {
        console.warn('[SDC API] Error reading messenger_hh from localStorage:', error);
    }
    return null;
}

/**
 * Get current user's account_id (username) from cookies or localStorage
 */
export function getCurrentAccountId(): string | null {
    // Try to get from cookies first
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'SDCUsername' && value) {
            return decodeURIComponent(value);
        }
    }

    // Fallback: Try to get from localStorage user_info
    try {
        const userInfoStr = localStorage.getItem('user_info');
        if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            // Check directly on userInfo first (snake_case)
            if (userInfo.account_id) {
                return userInfo.account_id;
            }
            if (userInfo.username) {
                return userInfo.username;
            }
            // Check inside user object (both snake_case and camelCase)
            if (userInfo.user) {
                if (userInfo.user.account_id) {
                    return userInfo.user.account_id;
                }
                if (userInfo.user.accountId) {
                    return userInfo.user.accountId;
                }
                if (userInfo.user.username) {
                    return userInfo.user.username;
                }
            }
        }
    } catch (error) {
        console.warn('[SDC API] Error reading account_id from localStorage:', error);
    }

    return null;
}

