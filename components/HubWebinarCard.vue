<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

import type { WebinarListItem } from '@/lib/sdc-api-types';
import { webinarPartyUrl } from '@/lib/sdc-api/live-chatroom';
import { webinarFiltersToLookingForIcons } from '@/lib/looking-for-icons';
import {
  formatWebinarWhen,
  getWebinarCategoryLine,
  getWebinarPeopleCount,
} from '@/lib/webinar-meta';
import { Badge } from '@/lib/view-router/ui/badge';
import { Card } from '@/lib/view-router/ui/card';

const props = defineProps<{
  item: WebinarListItem;
}>();

const whenLabel = computed(() => formatWebinarWhen(props.item));
const categoryLine = computed(() => getWebinarCategoryLine(props.item));
const audienceIcons = computed(() => webinarFiltersToLookingForIcons(props.item));
const peopleCount = computed(() => getWebinarPeopleCount(props.item));

function open() {
  window.open(webinarPartyUrl(props.item.id), '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <Card
    class="group flex w-full cursor-pointer flex-col gap-0 overflow-hidden rounded-[10px] border border-white/[0.04] bg-[#1a1d21] p-0 py-0 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-lg"
    @click="open"
  >
    <div class="relative aspect-video w-full overflow-hidden bg-[#131517]">
      <img
        v-if="item.flyer"
        :src="item.flyer"
        :alt="item.title"
        class="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
      />
      <div v-else class="flex h-full w-full items-center justify-center text-white/[0.15]">
        <Icon icon="mdi:presentation-play" width="28" height="28" />
      </div>

      <Badge
        v-if="item.live"
        variant="destructive"
        class="absolute left-1.5 top-1.5 inline-flex items-center gap-1 border-0 bg-[rgba(239,68,68,0.85)] px-[7px] py-0.5 pl-[5px] text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-md hover:bg-[rgba(239,68,68,0.85)]"
      >
        <span class="size-[5px] animate-live-blink rounded-full bg-white" />
        LIVE
      </Badge>
    </div>

    <div class="flex flex-1 flex-col gap-1 p-2.5">
      <p class="line-clamp-2 text-xs font-semibold leading-snug text-white">{{ item.title }}</p>

      <p v-if="item.account_id" class="truncate text-[11px] font-medium text-violet-300">
        {{ item.account_id }}
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <span v-if="whenLabel" class="inline-flex items-center gap-0.5 text-[10px] text-gray-500 group-hover:text-gray-400">
          <Icon icon="mdi:calendar-clock-outline" width="11" height="11" />
          {{ whenLabel }}
        </span>
        <span v-if="peopleCount != null" class="inline-flex items-center gap-0.5 text-[10px] text-gray-500 group-hover:text-gray-400">
          <Icon icon="mdi:account-group-outline" width="11" height="11" />
          {{ peopleCount }}
        </span>
      </div>

      <p v-if="categoryLine" class="line-clamp-1 text-[10px] text-gray-500">
        {{ categoryLine }}
      </p>

      <div v-if="audienceIcons.length" class="mt-auto flex flex-wrap items-center gap-0.5 border-t border-white/[0.04] pt-1.5">
        <template v-for="(a, index) in audienceIcons" :key="index">
          <div v-if="a.type === 'couple-group'" class="flex items-center">
            <Icon
              v-for="(ic, i) in a.icons"
              :key="i"
              :icon="ic.icon"
              width="12"
              height="12"
              :style="{ color: ic.color, marginLeft: i === 1 ? '-8px' : '0' }"
            />
          </div>
          <Icon
            v-else
            :icon="a.icon"
            width="12"
            height="12"
            :style="{ color: a.color }"
          />
        </template>
      </div>
    </div>
  </Card>
</template>
