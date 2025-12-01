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
    Community
} from '../sdc-api-types';

// Re-export utility functions
export { getCurrentMuid, getTargetDBId } from './utils';

// Re-export profile functions
export { getProfileV2, getCurrentNote } from './profile';

// Re-export note utility functions
export { noteContainsSummary, extractSummaryFromNote, getNoteBeforeSummary } from './notes';


