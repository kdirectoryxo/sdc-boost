import { ref } from 'vue';
import { createGlobalState } from '@vueuse/core';
import type { MessengerMessage } from '@/lib/sdc-api-types';
import { parseImageMessage, parseGalleryMessage, getImageUrl, getImageDbId } from './utils';
import { useChatMessages } from './useChatMessages';

export const useChatUI = createGlobalState(() => {
  const { messages } = useChatMessages();
  
  const openDropdownMessageId = ref<number | null>(null); // Track which message's dropdown is open
  const dropdownButtonRefs = ref<Map<number, HTMLElement>>(new Map()); // Store refs to dropdown buttons
  
  // Lightbox state
  const lightboxVisible = ref<boolean>(false);
  const lightboxIndex = ref<number>(0);
  const lightboxImages = ref<string[]>([]);
  
  // Gallery modal state
  const galleryModalVisible = ref<boolean>(false);
  const galleryName = ref<string>('');
  const galleryId = ref<string>('');
  const galleryDbId = ref<number>(0);
  const galleryPhotos = ref<string[]>([]);
  
  /**
   * Collect all images from all messages for lightbox
   */
  function getAllImagesFromMessages(): string[] {
    const allImages: string[] = [];
    
    messages.value.forEach(message => {
      const parsed = parseImageMessage(message.message);
      if (parsed.imageIds.length > 0) {
        const dbId = getImageDbId(message);
        parsed.imageIds.forEach((imageId) => {
          allImages.push(getImageUrl(imageId, dbId || undefined));
        });
      }
    });
    
    return allImages;
  }
  
  /**
   * Open lightbox for a specific image
   * @param message The message containing the image (or null if using custom images)
   * @param imageIndex The index of the image within the message (or within custom images array)
   * @param event Optional event to prevent default behavior
   * @param images Optional array of image URLs to use instead of collecting from messages
   */
  function openLightbox(message: MessengerMessage | null, imageIndex: number, event?: Event, images?: string[]): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    // If custom images provided (e.g., from gallery), use those
    if (images && images.length > 0) {
      lightboxImages.value = images;
      lightboxIndex.value = imageIndex;
      lightboxVisible.value = true;
      return;
    }
    
    // Otherwise, use message-based logic
    if (!message) {
      console.warn('[useChatUI] No message provided and no custom images');
      return;
    }
    
    const parsed = parseImageMessage(message.message);
    
    if (parsed.imageIds.length === 0) {
      console.warn('[useChatUI] No image IDs found in message');
      return;
    }
    
    // Collect all images from all messages
    const allImages = getAllImagesFromMessages();
    
    if (allImages.length === 0) {
      console.warn('[useChatUI] No images found in messages');
      return;
    }
    
    // Find the index of the clicked image in the all images array
    let currentIndex = 0;
    for (let i = 0; i < messages.value.length; i++) {
      const msg = messages.value[i];
      if (msg === message) {
        // Found the message, add the image index within this message
        currentIndex += imageIndex;
        break;
      } else {
        // Count images in messages before this one
        const msgParsed = parseImageMessage(msg.message);
        currentIndex += msgParsed.imageIds.length;
      }
    }
    
    console.log('[useChatUI] Opening lightbox:', { currentIndex, totalImages: allImages.length, imageUrl: allImages[currentIndex] });
    
    lightboxImages.value = allImages;
    lightboxIndex.value = currentIndex;
    lightboxVisible.value = true;
  }
  
  /**
   * Open gallery modal for a gallery message
   */
  function openGalleryModal(message: MessengerMessage): void {
    const galleryData = parseGalleryMessage(message.message);
    if (!galleryData) {
      console.warn('[useChatUI] Not a gallery message');
      return;
    }
    
    galleryName.value = galleryData.galleryName;
    galleryId.value = galleryData.galleryId;
    galleryDbId.value = message.db_id;
    galleryModalVisible.value = true;
  }
  
  /**
   * Close gallery modal
   */
  function closeGalleryModal(): void {
    galleryModalVisible.value = false;
    galleryName.value = '';
    galleryId.value = '';
    galleryDbId.value = 0;
    galleryPhotos.value = [];
  }
  
  /**
   * Open lightbox from gallery modal
   */
  function openLightboxFromGallery(photos: string[], imageIndex: number): void {
    galleryPhotos.value = photos;
    openLightbox(null, imageIndex, undefined, photos);
  }
  
  /**
   * Handle click outside to close message dropdowns
   */
  function handleClickOutside(event: MouseEvent): void {
    // This function is kept for any future custom logic if needed
    // Currently, Dropdown component handles all dropdown closing automatically
  }
  
  return {
    openDropdownMessageId,
    dropdownButtonRefs,
    lightboxVisible,
    lightboxIndex,
    lightboxImages,
    openLightbox,
    handleClickOutside,
    galleryModalVisible,
    galleryName,
    galleryId,
    galleryDbId,
    galleryPhotos,
    openGalleryModal,
    closeGalleryModal,
    openLightboxFromGallery,
  };
});

