<script lang="ts" setup>
/** Modal shell around `ProfileView`. Prefer `/sdc/profile/:userId` in the view router when possible. */
import ProfileView from '@/components/profile-view/ProfileView.vue';

interface Props {
  visible: boolean;
  userId: number | null;
  stackLevel?: number;
  dialogId?: string;
}

withDefaults(defineProps<Props>(), {
  stackLevel: 0,
  dialogId: '',
});

const emit = defineEmits<{
  close: [];
  'open-profile': [userId: number];
}>();

function handleBackdropClose() {
  emit('close');
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    :style="{
      pointerEvents: 'auto',
      zIndex: 10000011 + stackLevel * 10,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      background: stackLevel > 0 ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
    }"
    @click.self="handleBackdropClose"
  >
    <div class="flex h-[90vh] w-[80vw] max-w-6xl flex-col overflow-hidden" @click.stop>
      <ProfileView
        v-if="userId"
        :user-id="userId"
        :active="visible"
        variant="dialog"
        :stack-level="stackLevel"
        :dialog-id="dialogId"
        @close="emit('close')"
        @open-profile="emit('open-profile', $event)"
      />
    </div>
  </div>
</template>
