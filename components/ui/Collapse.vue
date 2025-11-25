<script lang="ts" setup>
import { computed } from 'vue';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const collapseVariants = cva('', {
  variants: {
    variant: {
      default: 'w-full py-2.5 px-2.5 bg-[#2a2a2a] border border-[#333] rounded-md text-[#e0e0e0] cursor-pointer text-[13px] font-medium flex justify-between items-center transition-all duration-200 hover:bg-[#333] hover:border-[#444]',
      ghost: 'w-full py-2 px-3 text-[#e0e0e0] cursor-pointer text-sm font-medium flex justify-between items-center transition-all duration-200 hover:bg-[#242424]',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const arrowVariants = cva('transition-transform duration-200', {
  variants: {
    size: {
      default: 'text-[10px]',
      sm: 'text-xs',
      lg: 'text-sm',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

interface Props {
  open: boolean;
  variant?: VariantProps<typeof collapseVariants>['variant'];
  arrowSize?: VariantProps<typeof arrowVariants>['size'];
  class?: string;
  buttonClass?: string;
  contentClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  arrowSize: 'default',
});

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const buttonClass = computed(() => cn(collapseVariants({ variant: props.variant }), props.buttonClass));
const arrowClass = computed(() => cn(arrowVariants({ size: props.arrowSize }), { 'rotate-180': props.open }));

function toggle() {
  emit('update:open', !props.open);
}
</script>

<template>
  <div :class="cn('flex flex-col', props.class)">
    <button :class="buttonClass" @click="toggle">
      <slot name="trigger">
        <span>Toggle</span>
      </slot>
      <span :class="arrowClass">▼</span>
    </button>
    <div v-if="props.open" class="mt-3 pt-3 border-t border-[#333] flex flex-col gap-4" :class="props.contentClass">
      <slot />
    </div>
  </div>
</template>

