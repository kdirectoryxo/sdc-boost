<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
}

const props = defineProps<Props>();

const party = computed(() => props.item.party);
const receiver = computed(() => props.item.receiver);

const photoUrl = computed(() => {
  if (receiver.value?.primary_photo) {
    if (receiver.value.primary_photo.startsWith('http')) {
      return receiver.value.primary_photo;
    }
    if (receiver.value.primary_photo === '/thumbnail/') {
      return null;
    }
    return `https://pictures.sdc.com/photos/${receiver.value.primary_photo}`;
  }
  return null;
});

const formatDistance = (km: number | undefined) => {
  if (!km) return '';
  return `${km} km`;
};
</script>

<template>
  <div
    class="relative overflow-hidden rounded-[10px] border border-white/[0.06] border-l-[3px] border-l-amber-200/40 transition-all duration-200 ease-in-out hover:border-white/10 hover:border-l-amber-200/60 hover:bg-white/[0.05]"
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
      <p class="text-sm font-semibold tracking-tight text-white">
        {{ receiver?.account_id }} heeft een nieuwe party toegevoegd
      </p>
      <p class="text-xs font-medium text-gray-500">{{ item.timed }}</p>
    </div>

    <div class="grid grid-cols-1 gap-3 px-3.5 py-3 md:grid-cols-2">
      <div class="flex flex-col gap-2.5">
        <div class="flex items-start gap-2.5">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            :alt="receiver?.account_id"
            class="size-[60px] shrink-0 rounded-lg border-2 border-amber-200/60 object-cover"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold tracking-tight text-white">{{ receiver?.account_id }}</p>
            <div v-if="receiver?.business_type" class="mt-1 text-xs font-medium text-amber-400">
              {{ receiver.business_type }}
            </div>

            <div v-if="receiver" class="mt-1.5 flex flex-wrap items-center gap-2.5">
              <div v-if="receiver.photo_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img
                  src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg"
                  alt="Foto's"
                  class="size-3.5 opacity-80"
                />
                <span>{{ receiver.photo_count }}</span>
              </div>
              <div v-if="receiver.video_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img
                  src="https://www.sdc.com/react/assets/videos_white_icon.67fc13b6.svg"
                  alt="Video's"
                  class="size-3.5 opacity-80"
                />
                <span>{{ receiver.video_count }}</span>
              </div>
              <div v-if="receiver.valid_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img
                  src="https://www.sdc.com/react/assets/validate_grid_card.d90f25d9.svg"
                  alt="Validaties"
                  class="size-3.5 opacity-80"
                />
                <span>{{ receiver.valid_count }}</span>
              </div>
              <div v-if="receiver.likes_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img
                  src="https://www.sdc.com/react/assets/like_grid_card.c46847a1.svg"
                  alt="Likes"
                  class="size-3.5 opacity-80"
                />
                <span>{{ receiver.likes_count }}</span>
              </div>
            </div>

            <div v-if="receiver?.location" class="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
              <img
                src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg"
                alt="location"
                class="size-3 opacity-70"
              />
              <span>{{ receiver.location }}</span>
              <span v-if="item.location_how_far" class="ml-1 text-gray-500">
                {{ formatDistance(item.location_how_far) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2.5">
        <div
          class="flex flex-col gap-1.5 rounded-lg border border-blue-500/15 bg-gradient-to-br from-blue-500/[0.08] to-blue-500/[0.03] p-3"
        >
          <p class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Publieke Party</p>
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="min-w-0 flex-1 text-sm font-semibold leading-snug tracking-tight text-white">
              {{ party?.title }}
            </p>
            <p v-if="party?.date_str" class="shrink-0 whitespace-nowrap text-[10px] font-medium text-gray-400">
              {{ party.date_str }}
            </p>
          </div>
          <p class="text-[10px] text-gray-400">
            door <span class="text-[10px] font-medium text-amber-400">{{ receiver?.account_id }}</span>
          </p>

          <div v-if="party?.location" class="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
            <div class="flex items-center gap-1 text-[10px] text-gray-400">
              <img
                src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg"
                alt="location"
                class="size-3 opacity-70"
              />
              <span>{{ party.location }}</span>
            </div>
            <span v-if="party?.distance" class="text-[10px] font-medium text-gray-500">
              {{ formatDistance(party.distance) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
