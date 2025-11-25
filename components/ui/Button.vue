<script lang="ts" setup>
import { computed } from 'vue';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-blue-500 text-white hover:bg-blue-600',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline: 'border border-[#333] bg-transparent text-[#e0e0e0] hover:bg-[#333] hover:border-[#444]',
        secondary: 'bg-[#2a2a2a] text-[#e0e0e0] hover:bg-[#333] border border-[#333]',
        ghost: 'hover:bg-[#242424] text-[#e0e0e0]',
        link: 'text-blue-500 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface Props {
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  class?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  disabled: false,
  type: 'button',
});

const buttonClass = computed(() => cn(buttonVariants({ variant: props.variant, size: props.size }), props.class));
</script>

<template>
  <button :class="buttonClass" :disabled="disabled" :type="type">
    <slot />
  </button>
</template>


