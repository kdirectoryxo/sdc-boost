/**
 * SDC API Service
 * Main export file for all SDC API functions
 */

// Re-export types
export type {
    ProfileV2Response,
    ProfileV2Info,
    ProfileUser,
    Validation,
    Friend,
    TravelPlan,
    PhotoAlbum,
    Community,
    MessengerLatestResponse,
    MessengerChatItem,
    MessengerLatestInfo
} from '../sdc-api-types';

// Re-export utility functions
export { getCurrentMuid, getTargetDBId } from './utils';

// Re-export profile functions
export { getProfileV2, getCurrentNote } from './profile';

// Re-export note utility functions
export { noteContainsSummary, extractSummaryFromNote, getNoteBeforeSummary } from './notes';

// Re-export messenger functions
export { getMessengerLatest, getMessengerIOV2 } from './messenger';

// Re-export counters functions
export { getCounters } from './counters';

// Re-export WebSocket utilities
export { 
    getCurrentDBId, 
    getConnId, 
    getId1, 
    getClientToken, 
    getMessengerHash 
} from './utils';


