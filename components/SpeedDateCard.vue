<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import type { SpeedDatingV2Item } from '@/lib/sdc-api-types';
import { parseSummaryIntToLookingForIcons } from '@/lib/looking-for-icons';
import { getBoostProfilePath, navigateBoostViewRouterPath } from '@/lib/view-router/routes';

const props = defineProps<{
  item: SpeedDatingV2Item;
  profileHref?: string;
}>();

const FALLBACK_IMAGE_URL = 'https://www.sdc.com/react/assets/couple_male_female_silhouette.cae98680.svg';
const imageError = ref(false);

function parseAge(ageStr: string | undefined) {
  if (!ageStr) return { first: null as string | null, second: null as string | null };
  const parts = ageStr.split('|');
  return { first: parts[0]?.trim() || null, second: parts[1]?.trim() || null };
}

const ages = computed(() => parseAge(props.item.age));

function isSecondAgeReal(ageSecond: string | null) {
  if (!ageSecond) return false;
  const age = parseInt(ageSecond, 10);
  return !Number.isNaN(age) && age >= 18 && age <= 100;
}

const isGender2Real = computed(() => isSecondAgeReal(ages.value.second));

function getAgeColor(gender: number | undefined) {
  return gender === 1 ? '#ff60df' : '#3a97fe';
}

const isValidPhoto = (photo: string | undefined): boolean => {
  if (!photo) return false;
  const trimmed = photo.trim();
  if (trimmed === '' || trimmed === '/thumbnail/' || trimmed.endsWith('/thumbnail/')) {
    return false;
  }
  return true;
};

const photoUrl = computed(() => {
  if (!isValidPhoto(props.item.primary_photo)) return null;
  if (props.item.primary_photo.startsWith('http')) return props.item.primary_photo;
  return `https://pictures.sdc.com/photos/${props.item.primary_photo}`;
});

const displayImageUrl = computed(() => {
  if (!photoUrl.value || imageError.value) return FALLBACK_IMAGE_URL;
  return photoUrl.value;
});

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement;
  if (img?.src && !img.src.includes('couple_male_female_silhouette')) {
    imageError.value = true;
  }
}

watch(
  () => props.item.db_id,
  () => {
    imageError.value = false;
  }
);

const typeLabel = computed(() => {
  switch (props.item.type) {
    case 1:
      return 'Openbare locatie';
    case 2:
      return 'Virtuele date';
    case 0:
    default:
      return 'Privé locatie';
  }
});

const locationBlock = computed(() => {
  const a = props.item.location?.trim() || '';
  const b = props.item.location_sd?.trim() || '';
  if (a && b && a !== b) {
    return { primary: a, secondary: b };
  }
  return { primary: a || b, secondary: '' };
});

const distanceText = computed(() => {
  const d = props.item.location_how_far_sd;
  return typeof d === 'number' && d > 0 ? `${d} km` : '';
});

const profileTypeColor = computed(() => {
  const g1 = props.item.gender1;
  if (!isGender2Real.value) {
    return g1 === 1 ? '#ff60df' : '#3a97fe';
  }
  return '#a855f7';
});

const lookingForIcons = computed(() => parseSummaryIntToLookingForIcons(props.item.summary_int));

const hasLifetimeStatus = computed(() => props.item.lifetime_status === true);

function handleClick(e: MouseEvent) {
  const id = props.item.db_id;
  if (!id) return;
  if (props.profileHref) {
    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigateBoostViewRouterPath(getBoostProfilePath(id));
  }
}

const messagePreview = computed(() => {
  const t = props.item.personal_text?.trim() || '';
  return t;
});
</script>

<template>
  <component
    :is="profileHref ? 'a' : 'div'"
    :href="profileHref || undefined"
    class="group cursor-pointer overflow-hidden rounded-[10px] border border-white/4 bg-[#1a1d21] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
    :class="profileHref ? 'block text-inherit no-underline outline-none' : ''"
    @click="handleClick"
  >
    <div class="relative aspect-square w-full overflow-hidden bg-[#131517]">
      <img
        :key="`${item.db_id}-${imageError}`"
        :src="displayImageUrl"
        :alt="item.account_id"
        class="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
        @error="handleImageError"
      />
      <div v-if="item.online === 1" class="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#1a1d21] bg-green-500" />
      <div class="absolute left-1.5 top-1.5 flex gap-1">
        <div
          v-if="hasLifetimeStatus"
          class="flex h-5 w-5 items-center justify-center rounded-[5px] bg-[rgba(234,179,8,0.85)] backdrop-blur-md"
          title="Lifetime"
        >
          <Icon icon="mdi:star" width="12" height="12" />
        </div>
        <div
          class="flex h-5 w-5 items-center justify-center rounded-[5px] bg-[rgba(139,92,246,0.85)] backdrop-blur-md"
          title="Speed Date"
        >
          <Icon icon="mdi:lightning-bolt" width="12" height="12" />
        </div>
      </div>
      <div
        class="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] rounded-md bg-black/65 px-2 py-0.5 text-[9px] font-semibold leading-tight text-white/95 backdrop-blur-md"
      >
        {{ typeLabel }}
      </div>
      <div
        v-if="item.is_app_user || item.is_web_user"
        class="absolute bottom-1.5 right-1.5 flex gap-0.5 rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-md"
      >
        <Icon v-if="item.is_app_user" icon="mdi:cellphone" width="12" height="12" />
        <Icon v-if="item.is_web_user" icon="mdi:monitor" width="12" height="12" />
      </div>
    </div>

    <div class="flex flex-col gap-1 p-2.5" :style="{ borderTop: `3px solid ${profileTypeColor}` }">
      <div class="flex flex-row items-center gap-1.5">
        <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-white">{{
          item.account_id
        }}</span>
        <div v-if="lookingForIcons.length > 0" class="ml-auto flex shrink-0 flex-row items-center gap-0.5">
          <template v-for="(lf, index) in lookingForIcons" :key="index">
            <div v-if="lf.type === 'couple-group'" class="flex items-center [&>svg+svg]:-ml-2">
              <Icon
                v-for="(ic, i) in lf.icons"
                :key="i"
                :icon="ic.icon"
                width="12"
                height="12"
                :style="{ color: ic.color }"
              />
            </div>
            <Icon v-else :icon="lf.icon" width="12" height="12" :style="{ color: lf.color }" />
          </template>
        </div>
      </div>

      <div class="flex flex-row items-center gap-1.5">
        <div class="flex items-center gap-0.5 text-[13px] font-semibold">
          <span v-if="ages.first" :style="{ color: getAgeColor(item.gender1) }">{{ ages.first }}</span>
          <span v-if="ages.first && ages.second && isGender2Real" class="text-[11px] text-white/20">|</span>
          <span v-if="ages.second && isGender2Real" :style="{ color: getAgeColor(item.gender2) }">{{ ages.second }}</span>
        </div>
        <span v-if="distanceText" class="ml-auto rounded px-1.5 py-0.5 text-[9px] font-medium text-blue-400 bg-blue-400/12">{{
          distanceText
        }}</span>
      </div>

      <div v-if="item.date_list" class="text-[10px] text-white/55">{{ item.date_list }}</div>

      <div v-if="locationBlock.primary || locationBlock.secondary" class="flex items-start gap-1 text-[10px] text-gray-500">
        <Icon icon="mdi:map-marker-outline" width="10" height="10" class="mt-px shrink-0 text-gray-600" />
        <div class="flex min-w-0 flex-col gap-0.5 [&>span:first-child]:overflow-hidden [&>span:first-child]:text-ellipsis [&>span:first-child]:whitespace-nowrap">
          <span>{{ locationBlock.primary }}</span>
          <span v-if="locationBlock.secondary" class="whitespace-normal text-[9px] leading-snug text-white/40">{{
            locationBlock.secondary
          }}</span>
        </div>
      </div>

      <div v-if="messagePreview" class="line-clamp-4 text-[10px] leading-[1.35] text-white/78">
        {{ messagePreview }}
      </div>

      <div v-if="item.photo_count || item.likes_count || item.valid_count" class="mt-1 flex items-center gap-1 border-t border-white/4 pt-1.5">
        <span v-if="item.photo_count" class="flex items-center gap-0.5 text-[10px] text-gray-500">
          <Icon icon="mdi:image-outline" width="11" height="11" />
          {{ item.photo_count }}
        </span>
        <span v-if="item.likes_count" class="flex items-center gap-0.5 text-[10px] text-gray-500">
          <Icon icon="mdi:heart-outline" width="11" height="11" />
          {{ item.likes_count }}
        </span>
        <span v-if="item.valid_count" class="flex items-center gap-0.5 text-[10px] text-gray-500">
          <Icon icon="mdi:check-circle-outline" width="11" height="11" />
          {{ item.valid_count }}
        </span>
      </div>
    </div>
  </component>
</template>
