import { ref } from 'vue';
import type { MessengerMessage } from '@/lib/sdc-api-types';
import { parseImageMessage, getImageUrl } from './utils';
import { useChatMessages } from './useChatMessages';

export function useChatUI() {
  const { messages } = useChatMessages();
  
  const openDropdownMessageId = ref<number | null>(null); // Track which message's dropdown is open
  const dropdownButtonRefs = ref<Map<number, HTMLElement>>(new Map()); // Store refs to dropdown buttons
  
  // Lightbox state
  const lightboxVisible = ref<boolean>(false);
  const lightboxIndex = ref<number>(0);
  const lightboxImages = ref<string[]>([]);
  
  /**
   * Collect all images from all messages for lightbox
   */
  function getAllImagesFromMessages(): string[] {
    const allImages: string[] = [];
    
    messages.value.forEach(message => {
      const parsed = parseImageMessage(message.message);
      if (parsed.imageIds.length > 0) {
        parsed.imageIds.forEach((imageId) => {
          allImages.push(getImageUrl(imageId, message.db_id));
        });
      }
    });
    
    return allImages;
  }
  
  /**
   * Open lightbox for a specific image
   */
  function openLightbox(message: MessengerMessage, imageIndex: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
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
  };
}

