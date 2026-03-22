<script setup lang="ts">
import HubShellLayout from '@/components/HubShellLayout.vue';

defineProps<{
  boostPath: string;
}>();
</script>

<template>
  <HubShellLayout :boost-path="boostPath" />
</template>
