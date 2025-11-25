<script lang="ts" setup>
import { computed } from 'vue';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const switchVariants = cva('', {
  variants: {
    size: {
      default: 'w-11 h-6',
      sm: 'w-9 h-5',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

const sliderVariants = cva('absolute inset-0 bg-[#444] rounded-full transition-all duration-300 peer-checked:bg-green-500', {
  variants: {
    size: {
      default: '',
      sm: '',
    },
  },
});

const knobVariants = cva('absolute bg-white rounded-full transition-all duration-300 peer-checked:translate-x-[20px]', {
  variants: {
    size: {
      default: 'h-[18px] w-[18px] left-[3px] bottom-[3px]',
      sm: 'h-[14px] w-[14px] left-[3px] bottom-[3px] peer-checked:translate-x-[16px]',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

interface Props {
  modelValue: boolean;
  size?: VariantProps<typeof switchVariants>['size'];
  disabled?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default',
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const labelClass = computed(() =>
  cn('relative inline-block shrink-0 cursor-pointer', switchVariants({ size: props.size }), props.class, {
    'opacity-50 cursor-not-allowed': props.disabled,
  })
);

const sliderClass = computed(() => sliderVariants({ size: props.size }));
const knobClass = computed(() => knobVariants({ size: props.size }));

function handleChange(event: Event) {
  if (props.disabled) return;
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.checked);
}
</script>

<template>
  <label :class="labelClass">
    <input
      type="checkbox"
      class="peer sr-only"
      :checked="modelValue"
      :disabled="disabled"
      @change="handleChange"
    />
    <span :class="sliderClass"></span>
    <span :class="knobClass"></span>
  </label>
</template>


