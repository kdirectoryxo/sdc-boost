<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

interface Props {
  modelValue: boolean;
  placement?: 'top' | 'bottom';
  alignment?: 'start' | 'end' | 'center' | 'right-full';
  width?: string;
  zIndex?: number;
  offset?: string; // e.g., 'mt-2', 'mb-2', 'mr-2', 'ml-2', or multiple classes like 'mr-2 mt-1'
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'bottom',
  alignment: 'end',
  width: 'w-48',
  zIndex: 50,
  offset: 'mt-2'
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const dropdownRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const isOpening = ref(false);

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

function toggle() {
  isOpen.value = !isOpen.value;
}

function close() {
  isOpen.value = false;
}

/**
 * Handle clicks outside the dropdown
 * Works with shadow DOM by using composedPath() to check the full event path
 */
function handleClickOutside(event: MouseEvent | PointerEvent): void {
  // Ignore clicks while opening
  if (isOpening.value) {
    return;
  }
  
  if (!props.modelValue || !dropdownRef.value) {
    return;
  }

  // Get the full event path (including shadow DOM boundaries)
  const path = event.composedPath() as Node[];
  
  // Check if click is inside dropdown container or content
  const isInsideDropdown = path.some(node => {
    if (node === dropdownRef.value || node === contentRef.value) {
      return true;
    }
    // Check if node is a descendant of dropdown container
    if (node instanceof Element) {
      return dropdownRef.value?.contains(node) || contentRef.value?.contains(node);
    }
    return false;
  });

  if (isInsideDropdown) {
    return;
  }

  // Click is outside - close the dropdown
  close();
}

/**
 * Handle escape key to close dropdown
 */
function handleEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.modelValue) {
    close();
  }
}

// Watch for modelValue changes to add/remove event listeners
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    // Opening - set flag and wait for render
    isOpening.value = true;
    nextTick(() => {
      // Small delay to ignore the opening click
      setTimeout(() => {
        if (dropdownRef.value && props.modelValue) {
          isOpening.value = false;
          // Listen on document to catch clicks outside shadow DOM
          document.addEventListener('click', handleClickOutside, true);
          document.addEventListener('pointerdown', handleClickOutside, true);
          document.addEventListener('keydown', handleEscape);
        }
      }, 100);
    });
  } else {
    // Closing - remove listeners
    isOpening.value = false;
    document.removeEventListener('click', handleClickOutside, true);
    document.removeEventListener('pointerdown', handleClickOutside, true);
    document.removeEventListener('keydown', handleEscape);
  }
});

onMounted(() => {
  if (props.modelValue) {
    // If already open on mount, add listeners
    nextTick(() => {
      if (dropdownRef.value) {
        document.addEventListener('click', handleClickOutside, true);
        document.addEventListener('pointerdown', handleClickOutside, true);
        document.addEventListener('keydown', handleEscape);
      }
    });
  }
});

onUnmounted(() => {
  // Clean up listeners
  document.removeEventListener('click', handleClickOutside, true);
  document.removeEventListener('pointerdown', handleClickOutside, true);
  document.removeEventListener('keydown', handleEscape);
});

// Computed classes for positioning
const positionClasses = computed(() => {
  const classes: string[] = ['absolute'];
  
  // Placement (top/bottom)
  if (props.placement === 'top') {
    classes.push('bottom-full');
  } else {
    classes.push('top-full');
  }
  
  // Alignment (start/end/center/right-full)
  if (props.alignment === 'start') {
    classes.push('left-0');
  } else if (props.alignment === 'end') {
    classes.push('right-0');
  } else if (props.alignment === 'right-full') {
    classes.push('right-full');
  } else {
    classes.push('left-1/2', '-translate-x-1/2');
  }
  
  // Offset - can be multiple classes separated by spaces
  if (props.offset) {
    const offsetClasses = props.offset.split(' ').filter(cls => cls.length > 0);
    classes.push(...offsetClasses);
  }
  
  return classes.join(' ');
});

const zIndexClass = computed(() => `z-[${props.zIndex}]`);
</script>

<template>
  <div class="relative" ref="dropdownRef">
    <!-- Trigger Slot -->
    <div>
      <slot name="trigger" :isOpen="isOpen" :toggle="toggle" :close="close" />
    </div>
    
    <!-- Dropdown Content -->
    <div
      v-if="isOpen"
      ref="contentRef"
      :class="[
        positionClasses,
        width,
        'bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg overflow-hidden',
        zIndexClass
      ]"
      @click.stop
    >
      <slot name="content" :close="close" />
    </div>
  </div>
</template>

