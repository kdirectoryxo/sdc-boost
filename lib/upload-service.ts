/**
 * Upload Service
 * Handles file uploads to SDC API
 */

import { getCurrentMuid } from './sdc-api/utils';

/**
 * Upload multiple images/videos to SDC API
 * @param files Array of files to upload (images or videos)
 * @param muid The user's MUID
 * @param targetId The target user's DB_ID
 * @param groupId The group/chat ID
 * @returns Array of image_ids from the response
 */
export async function uploadMultipleMedia(
  files: File[],
  muid: string,
  targetId: string,
  groupId: string
): Promise<string[]> {
  const url = new URL('https://api.sdc.com/v1/upload_mult_images');
  url.searchParams.set('muid', muid);
  url.searchParams.set('targetId', targetId);
  url.searchParams.set('group_id', groupId);

  // Create FormData for multipart/form-data
  const formData = new FormData();
  files.forEach(file => {
    formData.append(file.name, file);
  });

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'accept-language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
        'origin': 'https://www.sdc.com',
        'referer': 'https://www.sdc.com/',
      },
      credentials: 'include', // Include cookies for authentication
      body: formData,
    });

    const data = await response.json();

    // Check for error response (e.g., 403)
    if (!response.ok || data.info?.code !== 200) {
      const errorMessage = data.info?.message || `Upload failed with status ${response.status}`;
      
      // Create a custom error with the API message
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).code = data.info?.code;
      throw error;
    }
    
    if (data.info?.image_data && data.info.image_data.length > 0) {
      return data.info.image_data.map((item: { image_id: string }) => item.image_id);
    } else {
      throw new Error('Invalid response format from upload API');
    }
  } catch (error) {
    console.error('[UploadService] Failed to upload files:', error);
    throw error;
  }
}

/**
 * Upload single image or video (backward compatibility)
 */
export async function uploadMedia(
  file: File,
  muid: string,
  targetId: string,
  groupId: string
): Promise<string> {
  const imageIds = await uploadMultipleMedia([file], muid, targetId, groupId);
  return imageIds[0];
}

/**
 * Upload images/videos with automatic MUID retrieval
 */
export async function uploadFiles(
  files: File[],
  targetId: string,
  groupId: string
): Promise<string[]> {
  const muid = getCurrentMuid();
  if (!muid) {
    throw new Error('MUID not found. Cannot upload files.');
  }
  return uploadMultipleMedia(files, muid, targetId, groupId);
}

