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
const computedPlacement = ref<'top' | 'bottom'>(props.placement);
const computedAlignment = ref<'start' | 'end' | 'center' | 'right-full'>(props.alignment);

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

/**
 * Find the nearest scroll container ancestor
 * Traverses up the DOM tree to find an element with overflow-y-auto or overflow-y-scroll
 */
function findScrollContainer(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  
  let current: HTMLElement | null = element.parentElement;
  
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    
    // Check if this element is a scroll container
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    
    // Stop at body or html
    if (current === document.body || current === document.documentElement) {
      break;
    }
    
    current = current.parentElement;
  }
  
  return null;
}

/**
 * Calculate dynamic placement based on available space in scroll container
 * This is called before the dropdown is rendered, so we use an estimated height
 */
function calculatePlacement(): 'top' | 'bottom' {
  if (!dropdownRef.value) {
    return props.placement;
  }
  
  const triggerRect = dropdownRef.value.getBoundingClientRect();
  const scrollContainer = findScrollContainer(dropdownRef.value);
  
  // If no scroll container found, use default placement
  if (!scrollContainer) {
    return props.placement;
  }
  
  const containerRect = scrollContainer.getBoundingClientRect();
  
  // Estimate dropdown height (we'll measure it after render, but for now use a reasonable estimate)
  // We'll recalculate after the dropdown is rendered
  const estimatedDropdownHeight = 200; // Reasonable estimate, will be refined
  
  // Calculate available space below and above the trigger within the scroll container
  const spaceBelow = containerRect.bottom - triggerRect.bottom;
  const spaceAbove = triggerRect.top - containerRect.top;
  
  // If placement is requested as 'bottom'
  if (props.placement === 'bottom') {
    // Check if there's enough space below (with some padding)
    if (spaceBelow < estimatedDropdownHeight + 10) {
      // Not enough space below, check if we have more space above
      if (spaceAbove > spaceBelow) {
        return 'top';
      }
    }
    return 'bottom';
  }
  
  // If placement is requested as 'top'
  if (props.placement === 'top') {
    // Check if there's enough space above (with some padding)
    if (spaceAbove < estimatedDropdownHeight + 10) {
      // Not enough space above, check if we have more space below
      if (spaceBelow > spaceAbove) {
        return 'bottom';
      }
    }
    return 'top';
  }
  
  return props.placement;
}

/**
 * Calculate initial alignment estimate (before dropdown is rendered)
 */
function calculateInitialAlignment(): 'start' | 'end' | 'center' | 'right-full' {
  if (!dropdownRef.value) {
    return props.alignment;
  }
  
  const triggerRect = dropdownRef.value.getBoundingClientRect();
  const scrollContainer = findScrollContainer(dropdownRef.value);
  
  if (!scrollContainer) {
    return props.alignment;
  }
  
  const containerRect = scrollContainer.getBoundingClientRect();
  const estimatedDropdownWidth = 200; // Reasonable estimate
  
  // Calculate available space on left and right of trigger within scroll container
  const spaceLeft = triggerRect.left - containerRect.left;
  const spaceRight = containerRect.right - triggerRect.right;
  
  // Handle different alignment types
  if (props.alignment === 'start') {
    // start = left-0, dropdown starts at left edge of trigger
    // Check if dropdown would overflow on the right
    if (triggerRect.left + estimatedDropdownWidth > containerRect.right) {
      // Would overflow right, check if we have more space on the left
      if (spaceLeft > spaceRight) {
        return 'end';
      }
    }
    return 'start';
  }
  
  if (props.alignment === 'end') {
    // end = right-0, dropdown ends at right edge of trigger
    // Check if dropdown would overflow on the left
    if (triggerRect.right - estimatedDropdownWidth < containerRect.left) {
      // Would overflow left, check if we have more space on the right
      if (spaceRight > spaceLeft) {
        return 'start';
      }
    }
    return 'end';
  }
  
  if (props.alignment === 'right-full') {
    // right-full = dropdown positioned to the left of trigger
    // Check if dropdown would overflow on the left
    if (triggerRect.left - estimatedDropdownWidth < containerRect.left) {
      // Would overflow left, check if we have more space on the right
      if (spaceRight > spaceLeft) {
        return 'start';
      }
    }
    return 'right-full';
  }
  
  return props.alignment;
}

/**
 * Calculate dynamic alignment based on available horizontal space
 */
function calculateAlignment(): 'start' | 'end' | 'center' | 'right-full' {
  if (!dropdownRef.value || !contentRef.value) {
    return props.alignment;
  }
  
  const triggerRect = dropdownRef.value.getBoundingClientRect();
  const dropdownRect = contentRef.value.getBoundingClientRect();
  const scrollContainer = findScrollContainer(dropdownRef.value);
  
  if (!scrollContainer) {
    return props.alignment;
  }
  
  const containerRect = scrollContainer.getBoundingClientRect();
  const dropdownWidth = dropdownRect.width;
  
  // Calculate available space on left and right of trigger within scroll container
  const spaceLeft = triggerRect.left - containerRect.left;
  const spaceRight = containerRect.right - triggerRect.right;
  
  // Handle different alignment types
  if (props.alignment === 'start') {
    // start = left-0, dropdown starts at left edge of trigger
    // Check if dropdown would overflow on the right
    if (triggerRect.left + dropdownWidth > containerRect.right) {
      // Would overflow right, check if we have more space on the left
      if (spaceLeft > spaceRight) {
        // Flip to end (right-0) if more space on left
        return 'end';
      }
    }
    return 'start';
  }
  
  if (props.alignment === 'end') {
    // end = right-0, dropdown ends at right edge of trigger
    // Check if dropdown would overflow on the left
    if (triggerRect.right - dropdownWidth < containerRect.left) {
      // Would overflow left, check if we have more space on the right
      if (spaceRight > spaceLeft) {
        // Flip to start (left-0) if more space on right
        return 'start';
      }
    }
    return 'end';
  }
  
  if (props.alignment === 'right-full') {
    // right-full = dropdown positioned to the left of trigger
    // Check if dropdown would overflow on the left
    if (triggerRect.left - dropdownWidth < containerRect.left) {
      // Would overflow left, check if we have more space on the right
      if (spaceRight > spaceLeft) {
        // Use start alignment instead (dropdown to the right of trigger)
        return 'start';
      }
    }
    return 'right-full';
  }
  
  // For center alignment, check if it would overflow either side
  if (props.alignment === 'center') {
    const centerX = triggerRect.left + triggerRect.width / 2;
    const dropdownLeft = centerX - dropdownWidth / 2;
    const dropdownRight = centerX + dropdownWidth / 2;
    
    // Check if centered dropdown would overflow
    if (dropdownLeft < containerRect.left) {
      // Would overflow left, use start alignment
      return 'start';
    }
    if (dropdownRight > containerRect.right) {
      // Would overflow right, use end alignment
      return 'end';
    }
    return 'center';
  }
  
  return props.alignment;
}

/**
 * Recalculate placement with actual dropdown dimensions
 */
function recalculatePlacement() {
  if (!props.modelValue || !dropdownRef.value || !contentRef.value) {
    return;
  }
  
  nextTick(() => {
    if (!dropdownRef.value || !contentRef.value) {
      return;
    }
    
    const triggerRect = dropdownRef.value.getBoundingClientRect();
    const dropdownRect = contentRef.value.getBoundingClientRect();
    const scrollContainer = findScrollContainer(dropdownRef.value);
    
    if (!scrollContainer) {
      computedPlacement.value = props.placement;
      computedAlignment.value = props.alignment;
      return;
    }
    
    const containerRect = scrollContainer.getBoundingClientRect();
    const actualDropdownHeight = dropdownRect.height;
    
    // Calculate available space below and above the trigger within the scroll container
    const spaceBelow = containerRect.bottom - triggerRect.bottom;
    const spaceAbove = triggerRect.top - containerRect.top;
    
    // If placement is requested as 'bottom'
    if (props.placement === 'bottom') {
      // Check if there's enough space below (with some padding)
      if (spaceBelow < actualDropdownHeight + 10) {
        // Not enough space below, check if we have more space above
        if (spaceAbove > spaceBelow) {
          computedPlacement.value = 'top';
        } else {
          computedPlacement.value = 'bottom';
        }
      } else {
        computedPlacement.value = 'bottom';
      }
    } else if (props.placement === 'top') {
      // If placement is requested as 'top'
      // Check if there's enough space above (with some padding)
      if (spaceAbove < actualDropdownHeight + 10) {
        // Not enough space above, check if we have more space below
        if (spaceBelow > spaceAbove) {
          computedPlacement.value = 'bottom';
        } else {
          computedPlacement.value = 'top';
        }
      } else {
        computedPlacement.value = 'top';
      }
    } else {
      computedPlacement.value = props.placement;
    }
    
    // Calculate dynamic alignment
    computedAlignment.value = calculateAlignment();
  });
}

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

// Handle scroll events to recalculate placement
function handleScroll() {
  if (props.modelValue) {
    recalculatePlacement();
  }
}

// Watch for modelValue changes to add/remove event listeners
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    // Opening - set flag and wait for render
    isOpening.value = true;
    // Calculate initial placement and alignment
    computedPlacement.value = calculatePlacement();
    computedAlignment.value = calculateInitialAlignment();
    
    nextTick(() => {
      // Recalculate with actual dimensions after render
      recalculatePlacement();
      
      // Small delay to ignore the opening click
      setTimeout(() => {
        if (dropdownRef.value && props.modelValue) {
          isOpening.value = false;
          // Listen on document to catch clicks outside shadow DOM
          document.addEventListener('click', handleClickOutside, true);
          document.addEventListener('pointerdown', handleClickOutside, true);
          document.addEventListener('keydown', handleEscape);
          
          // Add scroll listener to scroll container
          const scrollContainer = findScrollContainer(dropdownRef.value);
          if (scrollContainer) {
            scrollContainer.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', recalculatePlacement);
          }
        }
      }, 100);
    });
  } else {
    // Closing - remove listeners
    isOpening.value = false;
    document.removeEventListener('click', handleClickOutside, true);
    document.removeEventListener('pointerdown', handleClickOutside, true);
    document.removeEventListener('keydown', handleEscape);
    
    // Remove scroll listener
    if (dropdownRef.value) {
      const scrollContainer = findScrollContainer(dropdownRef.value);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll, true);
      }
    }
    window.removeEventListener('resize', recalculatePlacement);
  }
});

// Watch for placement prop changes
watch(() => props.placement, () => {
  if (props.modelValue) {
    computedPlacement.value = calculatePlacement();
    recalculatePlacement();
  } else {
    computedPlacement.value = props.placement;
  }
});

// Watch for alignment prop changes
watch(() => props.alignment, () => {
  if (props.modelValue) {
    computedAlignment.value = calculateAlignment();
    recalculatePlacement();
  } else {
    computedAlignment.value = props.alignment;
  }
});

onMounted(() => {
  if (props.modelValue) {
    // If already open on mount, add listeners
    computedPlacement.value = calculatePlacement();
    computedAlignment.value = props.alignment;
    nextTick(() => {
      if (dropdownRef.value) {
        recalculatePlacement();
        document.addEventListener('click', handleClickOutside, true);
        document.addEventListener('pointerdown', handleClickOutside, true);
        document.addEventListener('keydown', handleEscape);
        
        // Add scroll listener
        const scrollContainer = findScrollContainer(dropdownRef.value);
        if (scrollContainer) {
          scrollContainer.addEventListener('scroll', handleScroll, true);
        }
        window.addEventListener('resize', recalculatePlacement);
      }
    });
  } else {
    computedPlacement.value = props.placement;
    computedAlignment.value = props.alignment;
  }
});

onUnmounted(() => {
  // Clean up listeners
  document.removeEventListener('click', handleClickOutside, true);
  document.removeEventListener('pointerdown', handleClickOutside, true);
  document.removeEventListener('keydown', handleEscape);
  window.removeEventListener('resize', recalculatePlacement);
  
  // Remove scroll listener
  if (dropdownRef.value) {
    const scrollContainer = findScrollContainer(dropdownRef.value);
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', handleScroll, true);
    }
  }
});

// Computed classes for positioning
const positionClasses = computed(() => {
  const classes: string[] = ['absolute'];
  
  // Placement (top/bottom) - use computed placement for dynamic positioning
  if (computedPlacement.value === 'top') {
    classes.push('bottom-full');
  } else {
    classes.push('top-full');
  }
  
  // Alignment (start/end/center/right-full) - use computed alignment for dynamic positioning
  if (computedAlignment.value === 'start') {
    classes.push('left-0');
  } else if (computedAlignment.value === 'end') {
    classes.push('right-0');
  } else if (computedAlignment.value === 'right-full') {
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

const zIndexClass = computed(() => {
  // Use inline style for z-index to ensure it's applied correctly
  return '';
});

const zIndexStyle = computed(() => ({
  zIndex: props.zIndex,
  position: 'absolute' as const,
}));
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
        'bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg overflow-hidden'
      ]"
      :style="zIndexStyle"
      @click.stop
    >
      <slot name="content" :close="close" />
    </div>
  </div>
</template>

