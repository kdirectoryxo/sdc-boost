<script setup lang="ts">
import { computed } from 'vue';

import { Badge } from '@/lib/view-router/ui/badge';

const props = defineProps<{
  text: string;
  color: string;
}>();

const normalizedColor = computed(() =>
  props.color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(props.color)
    ? props.color
    : '#6b7280',
);
</script>

<template>
  <Badge
    variant="secondary"
    class="border-0 px-2 py-0.5 text-xs font-medium text-white"
    :style="{ backgroundColor: normalizedColor }"
  >
    {{ text }}
  </Badge>
</template>
