<script lang="ts" setup>
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
}

const props = defineProps<Props>();

// Get action type label for display
const getActionLabel = () => {
  switch (props.item.action) {
    case 2:
      return "Foto's";
    case 5:
      return "Foto's & Video's";
    case 6:
      return 'Validaties';
    case 8:
      return 'Nieuwe vrienden / volgers';
    case 9:
      return 'Speed Date';
    case 13:
      return 'Reisplannen';
    case 14:
      return "Party's & Events";
    case 17:
      return 'Likes gegeven';
    case 18:
      return 'Groepslid geworden';
    case 21:
      return 'Verjaardag';
    case 22:
      return 'Reisplannen';
    case 23:
      return 'Ledenservice';
    case 300:
      return 'Groepen / Blogs';
    case 600:
      return 'Gastenlijst';
    case 903:
      return 'Onbekende actie';
    case 904:
      return 'Speed Date';
    case 906:
      return 'Onbekende actie';
    default:
      return `Actie ${props.item.action}`;
  }
};

const actionLabel = getActionLabel();
</script>

<template>
  <div
    class="relative overflow-hidden rounded-[10px] border border-white/[0.06] border-l-[3px] border-l-gray-500/40 transition-all duration-200 ease-in-out hover:border-white/10 hover:border-l-gray-500/60 hover:bg-white/[0.05]"
    :class="
      props.index !== undefined
        ? props.index % 2 === 0
          ? 'bg-white/[0.025]'
          : 'bg-white/[0.035]'
        : 'bg-white/[0.03]'
    "
  >
    <div
      class="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm leading-none">🚧</span>
        <p class="m-0 text-sm font-semibold tracking-tight text-white">{{ actionLabel }}</p>
      </div>
      <p class="m-0 text-xs font-medium text-gray-500">{{ item.timed }}</p>
    </div>

    <div class="flex items-center justify-center px-4 py-8">
      <div class="max-w-[320px] text-center">
        <div class="mb-3 text-4xl opacity-60 grayscale-[30%]">⏳</div>
        <p class="m-0 mb-1.5 text-base font-semibold tracking-tight text-white">Coming Soon</p>
        <p class="m-0 mb-4 text-[13px] leading-normal text-gray-400">
          Deze actie wordt binnenkort ondersteund. We werken eraan!
        </p>
        <div class="mt-2.5 flex flex-wrap items-center justify-center gap-2">
          <p class="m-0 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Actie ID:</p>
          <p
            class="m-0 rounded border border-white/[0.08] bg-white/[0.05] px-2 py-1 font-mono text-[10px] font-medium text-gray-400"
          >
            {{ item.action }}
          </p>
        </div>
        <div v-if="item.action_id" class="mt-2.5 flex flex-wrap items-center justify-center gap-2">
          <p class="m-0 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Action ID:</p>
          <p
            class="m-0 rounded border border-white/[0.08] bg-white/[0.05] px-2 py-1 font-mono text-[10px] font-medium text-gray-400"
          >
            {{ item.action_id }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
