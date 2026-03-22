<script setup lang="ts">
import ChatWorkspace from '@/components/chat/ChatWorkspace.vue';

defineProps<{
  /** When false, chat surface unmounts (e.g. navigating away from `/sdc/chat`). */
  active?: boolean;
}>();
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <ChatWorkspace variant="page" :active="active ?? true" />
  </div>
</template>
