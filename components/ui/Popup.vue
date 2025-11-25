<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { cn } from '@/lib/utils';

interface Props {
  modelValue: boolean;
  triggerRef?: HTMLElement | null;
  position?: 'bottom' | 'top' | 'left' | 'right';
  align?: 'start' | 'center' | 'end' | 'auto';
  offset?: number;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  position: 'bottom',
  align: 'start',
  offset: 8,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const popupRef = ref<HTMLElement | null>(null);
const popupStyle = ref<{ top?: string; bottom?: string; left?: string; right?: string; transform?: string }>({});
const isOpening = ref(false);

function updatePosition() {
  console.log('[Popup] updatePosition called, modelValue:', props.modelValue, 'triggerRef:', !!props.triggerRef, 'popupRef:', !!popupRef.value);
  if (!props.modelValue || !props.triggerRef) {
    console.log('[Popup] updatePosition early return - missing modelValue or triggerRef');
    return;
  }

  // Wait for popup to render
  nextTick(() => {
    if (!props.triggerRef || !popupRef.value) {
      console.log('[Popup] updatePosition nextTick early return - waiting for popupRef');
      // Try again after a short delay if popup isn't ready
      if (props.modelValue) {
        setTimeout(() => {
          if (props.triggerRef && popupRef.value) {
            console.log('[Popup] Retrying position update');
            updatePosition();
          }
        }, 50);
      }
      return;
    }
    console.log('[Popup] Calculating position');

    const triggerRect = props.triggerRef.getBoundingClientRect();
    const popupRect = popupRef.value.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;
    let transform = '';

    // Calculate position based on position prop
    switch (props.position) {
      case 'bottom':
        top = triggerRect.bottom + props.offset;
        // Check if popup would go off bottom of viewport
        if (top + popupRect.height > viewportHeight) {
          // Show above instead
          top = triggerRect.top - popupRect.height - props.offset;
        }
        break;
      case 'top':
        top = triggerRect.top - popupRect.height - props.offset;
        // Check if popup would go off top of viewport
        if (top < 0) {
          // Show below instead
          top = triggerRect.bottom + props.offset;
        }
        break;
      case 'left':
        left = triggerRect.left - popupRect.width - props.offset;
        top = triggerRect.top;
        // Check if popup would go off left of viewport
        if (left < 0) {
          // Show to right instead
          left = triggerRect.right + props.offset;
        }
        break;
      case 'right':
        left = triggerRect.right + props.offset;
        top = triggerRect.top;
        // Check if popup would go off right of viewport
        if (left + popupRect.width > viewportWidth) {
          // Show to left instead
          left = triggerRect.left - popupRect.width - props.offset;
        }
        break;
    }

    // Calculate alignment
    if (props.position === 'bottom' || props.position === 'top') {
      let calculatedAlign = props.align;
      
      // Auto alignment: try center first, then adjust if needed
      if (props.align === 'auto') {
        const centerLeft = triggerRect.left + (triggerRect.width / 2) - (popupRect.width / 2);
        // Check if center would fit
        if (centerLeft >= props.offset && centerLeft + popupRect.width <= viewportWidth - props.offset) {
          calculatedAlign = 'center';
        } else {
          // Try left/start alignment
          const startLeft = triggerRect.left;
          if (startLeft >= props.offset && startLeft + popupRect.width <= viewportWidth - props.offset) {
            calculatedAlign = 'start';
          } else {
            // Default to end/right alignment
            calculatedAlign = 'end';
          }
        }
      }
      
      switch (calculatedAlign) {
        case 'start':
          left = triggerRect.left;
          break;
        case 'center':
          left = triggerRect.left + (triggerRect.width / 2) - (popupRect.width / 2);
          break;
        case 'end':
          left = triggerRect.right - popupRect.width;
          break;
      }
      // Ensure popup doesn't go off screen horizontally
      if (left < props.offset) left = props.offset;
      if (left + popupRect.width > viewportWidth - props.offset) {
        left = viewportWidth - popupRect.width - props.offset;
      }
    } else {
      // For left/right positioning, align vertically
      switch (props.align) {
        case 'start':
          top = triggerRect.top;
          break;
        case 'center':
          top = triggerRect.top + (triggerRect.height / 2) - (popupRect.height / 2);
          break;
        case 'end':
          top = triggerRect.bottom - popupRect.height;
          break;
      }
      // Ensure popup doesn't go off screen vertically
      if (top < 0) top = props.offset;
      if (top + popupRect.height > viewportHeight) {
        top = viewportHeight - popupRect.height - props.offset;
      }
    }

    popupStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
      transform,
    };
  });
}

function handleClickOutside(event: MouseEvent) {
  console.log('[Popup] handleClickOutside called, modelValue:', props.modelValue, 'isOpening:', isOpening.value);
  
  // Ignore clicks while opening
  if (isOpening.value) {
    console.log('[Popup] Still opening, ignoring click');
    return;
  }
  
  if (!props.modelValue || !popupRef.value) {
    console.log('[Popup] Early return - modelValue:', props.modelValue, 'popupRef:', !!popupRef.value);
    return;
  }

  const target = event.target as HTMLElement;
  console.log('[Popup] Click target:', target, 'tagName:', target.tagName, 'className:', target.className);
  
  // Don't close if clicking inside popup
  if (popupRef.value.contains(target)) {
    console.log('[Popup] Click inside popup, ignoring');
    return;
  }
  
  // Don't close if clicking on trigger element
  if (props.triggerRef && props.triggerRef.contains(target)) {
    console.log('[Popup] Click on trigger element, ignoring');
    return;
  }

  console.log('[Popup] Closing popup');
  emit('update:modelValue', false);
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.modelValue) {
    emit('update:modelValue', false);
  }
}

watch(() => props.modelValue, (newValue) => {
  console.log('[Popup] modelValue changed to:', newValue);
  if (newValue) {
    console.log('[Popup] Opening popup, triggerRef:', !!props.triggerRef);
    isOpening.value = true;
    updatePosition();
    // Wait for popup to render and then add listeners with a small delay to ignore the opening click
    nextTick(() => {
      // Wait a bit more to ensure popup is rendered and the opening click has been processed
      setTimeout(() => {
        if (popupRef.value && props.modelValue) {
          console.log('[Popup] Adding event listeners, popupRef available:', !!popupRef.value);
          isOpening.value = false;
          document.addEventListener('click', handleClickOutside);
          document.addEventListener('keydown', handleEscape);
          window.addEventListener('resize', updatePosition);
          window.addEventListener('scroll', updatePosition, true);
        } else {
          console.log('[Popup] Popup not ready yet, popupRef:', !!popupRef.value, 'modelValue:', props.modelValue);
        }
      }, 100);
    });
  } else {
    console.log('[Popup] Closing popup, removing event listeners');
    isOpening.value = false;
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleEscape);
    window.removeEventListener('resize', updatePosition);
    window.removeEventListener('scroll', updatePosition, true);
  }
});

watch(() => props.triggerRef, () => {
  if (props.modelValue) {
    updatePosition();
  }
});

onMounted(() => {
  if (props.modelValue) {
    updatePosition();
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleEscape);
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, true);
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="modelValue"
        ref="popupRef"
        :style="popupStyle"
        :class="cn(
          'fixed z-50 min-w-[200px] bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg',
          'py-2',
          props.class
        )"
        role="dialog"
        aria-modal="true"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

