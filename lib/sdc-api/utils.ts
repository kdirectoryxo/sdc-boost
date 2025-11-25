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

