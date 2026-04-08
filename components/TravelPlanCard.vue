<script lang="ts" setup>
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
}

const props = defineProps<Props>();

const receiver = computed(() => props.item.receiver);
const extraData = computed(() => props.item.extra_data);

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

// Parse age string (format: "48|50" or similar)
const parseAge = () => {
  if (!receiver.value?.age) return { first: null, second: null };
  const parts = receiver.value.age.split('|');
  return {
    first: parts[0]?.trim() || null,
    second: parts[1]?.trim() || null,
  };
};

const ages = computed(() => parseAge());

// Check if second person age is real (not a placeholder)
const isGender2Real = computed(() => {
  if (!ages.value.second) return false;
  const age = parseInt(ages.value.second, 10);
  return !isNaN(age) && age >= 18 && age <= 100;
});

// Get age color class based on gender (1 = female = pink, 0 = male = blue)
const getAgeColorClass = (gender: number | undefined) => {
  return gender === 1 ? 'text-[#ff60df]' : 'text-[#3a97fe]';
};

const formatDistance = (km: number | undefined) => {
  if (!km) return '';
  return `${km} km`;
};

// Parse interests from summary_int
const parseInterests = (interests: string | undefined) => {
  if (!interests || interests.length < 6) {
    return {
      coupleMaleFemale: false,
      coupleFemaleFemale: false,
      coupleMaleMale: false,
      singleFemale: false,
      singleMale: false,
      transgender: false,
    };
  }

  const chars = interests.split('');
  return {
    coupleMaleFemale: chars[0] === '1',
    coupleFemaleFemale: chars[1] === '1',
    coupleMaleMale: chars[2] === '1',
    singleFemale: chars[3] === '1',
    singleMale: chars[4] === '1',
    transgender: chars[5] === '1',
  };
};

const receiverInterests = computed(() => {
  const interestsStr = receiver.value?.summary_int || '';
  return parseInterests(interestsStr);
});

// Get interests icons - only show couple icons if gender2 is real, otherwise filter them out
type LookingForIcon =
  | { type: 'couple-group'; icons: Array<{ icon: string; colorClass: string }> }
  | { type: 'single-female' | 'single-male'; icon: string; colorClass: string };

const receiverInterestsIcons = computed((): LookingForIcon[] => {
  const icons: LookingForIcon[] = [];

  if (isGender2Real.value && receiverInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', colorClass: 'text-[#3a97fe]' },
        { icon: 'fa6-solid:person', colorClass: 'text-[#ff60df]' },
      ],
    });
  }

  if (!isGender2Real.value) {
    if (receiverInterests.value.singleFemale) {
      icons.push({
        type: 'single-female',
        icon: 'fa6-solid:person',
        colorClass: 'text-[#ff60df]',
      });
    }

    if (receiverInterests.value.singleMale) {
      icons.push({
        type: 'single-male',
        icon: 'fa6-solid:person',
        colorClass: 'text-[#3a97fe]',
      });
    }
  }

  return icons;
});

// Get travel plan description - prefer extra_data.description, fallback to body
const travelDescription = computed(() => {
  if (extraData.value?.description) {
    return extraData.value.description.trim();
  }
  if (extraData.value?.text_description) {
    return extraData.value.text_description.trim();
  }
  // Remove location from end of body if present
  const body = props.item.body || '';
  // Remove HTML tags and trailing location
  return body.replace(/<[^>]*>/g, '').trim();
});

// Get travel dates
const travelDates = computed(() => {
  if (extraData.value?.date_from && extraData.value?.date_until) {
    return `${extraData.value.date_from} - ${extraData.value.date_until}`;
  }
  if (extraData.value?.date_from) {
    return extraData.value.date_from;
  }
  return '';
});

// Get travel location
const travelLocation = computed(() => {
  return extraData.value?.location || receiver.value?.location || '';
});

const cardStripeClass = computed(() =>
  props.index !== undefined && props.index % 2 === 0 ? 'bg-white/2.5' : 'bg-white/3.5',
);
</script>

<template>
  <div
    :class="[
      'relative overflow-hidden rounded-[10px] border border-white/6 border-l-[3px] border-l-blue-500/40 bg-white/3 transition-all duration-200 ease-in-out',
      'hover:border-white/10 hover:border-l-blue-500/60 hover:bg-white/5',
      cardStripeClass,
    ]"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-white/6 bg-white/2 px-3 py-2"
    >
      <p class="text-sm font-semibold tracking-tight text-white">
        {{ receiver?.account_id }} heeft reisplan geplaatst
      </p>
      <p class="text-xs font-medium text-gray-500">{{ item.timed }}</p>
    </div>

    <!-- Content -->
    <div class="grid grid-cols-1 gap-2.5 px-3 py-2.5 md:grid-cols-2">
      <!-- Left: Profile Info -->
      <div class="flex flex-col gap-2.5">
        <div class="flex items-start gap-2.5">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            :alt="receiver?.account_id"
            class="h-[60px] w-[60px] shrink-0 rounded-lg border-2 border-blue-500/60 object-cover"
          />
          <div
            v-else
            class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg border-2 border-blue-500/60 bg-linear-to-br from-blue-500/15 to-blue-500/5"
          >
            <span class="text-xl font-semibold text-blue-400">{{
              receiver?.account_id?.charAt(0) || '?'
            }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex items-center justify-between">
              <p class="text-sm font-semibold tracking-tight text-white">
                {{ receiver?.account_id }}
              </p>
              <div class="ml-1.5 flex items-center gap-1">
                <img
                  v-if="receiver?.is_web_user"
                  src="https://www.sdc.com/react/assets/web_user_icon.d5f27f46.svg"
                  alt="is-web-user"
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity duration-200 hover:opacity-100"
                  title="Web-gebruiker"
                />
                <img
                  v-if="receiver?.is_app_user"
                  src="https://www.sdc.com/react/assets/mobile_user_icon.07eafea0.svg"
                  alt="is-app-user"
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity duration-200 hover:opacity-100"
                  title="App-gebruiker"
                />
                <img
                  v-if="receiver?.speed"
                  src="https://www.sdc.com/react/assets/speed_white.3176d40b.svg"
                  alt="is-speed-date"
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity duration-200 hover:opacity-100"
                  title="Speed Date"
                />
                <img
                  v-if="receiver?.online === 1"
                  src="https://www.sdc.com/react/assets/messenger_online_icon.0a87dd19.svg"
                  alt="user-is-online"
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity duration-200 hover:opacity-100"
                  title="Chat nu"
                />
              </div>
            </div>

            <!-- Age with colors -->
            <div v-if="ages.first || (ages.second && isGender2Real)" class="mt-1 text-[11px]">
              <span v-if="ages.first" class="font-semibold" :class="getAgeColorClass(receiver?.gender1)">
                {{ ages.first }}
              </span>
              <span v-if="ages.first && ages.second && isGender2Real" class="mx-0.5 text-white/40">
                |
              </span>
              <span
                v-if="ages.second && isGender2Real"
                class="font-semibold"
                :class="getAgeColorClass(receiver?.gender2)"
              >
                {{ ages.second }}
              </span>
            </div>

            <!-- Stats with icons -->
            <div class="mt-1.5 flex items-center gap-2.5">
              <div v-if="receiver?.photo_count" class="flex items-center gap-[3px] text-xs text-gray-400">
                <img
                  src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg"
                  alt="Foto's"
                  class="h-3.5 w-3.5 opacity-80"
                />
                <span>{{ receiver.photo_count }}</span>
              </div>
              <div v-if="receiver?.video_count" class="flex items-center gap-[3px] text-xs text-gray-400">
                <img
                  src="https://www.sdc.com/react/assets/videos_white_icon.67fc13b6.svg"
                  alt="Video's"
                  class="h-3.5 w-3.5 opacity-80"
                />
                <span>{{ receiver.video_count }}</span>
              </div>
              <div v-if="receiver?.valid_count" class="flex items-center gap-[3px] text-xs text-gray-400">
                <img
                  src="https://www.sdc.com/react/assets/validate_grid_card.d90f25d9.svg"
                  alt="Validaties"
                  class="h-3.5 w-3.5 opacity-80"
                />
                <span>{{ receiver.valid_count }}</span>
              </div>
              <div v-if="receiver?.likes_count" class="flex items-center gap-[3px] text-xs text-gray-400">
                <img
                  src="https://www.sdc.com/react/assets/like_grid_card.c46847a1.svg"
                  alt="Likes"
                  class="h-3.5 w-3.5 opacity-80"
                />
                <span>{{ receiver.likes_count }}</span>
              </div>
            </div>

            <!-- Interests -->
            <div v-if="receiverInterestsIcons.length > 0" class="mt-1.5">
              <p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Interesses
              </p>
              <div class="flex items-center gap-[5px]">
                <template v-for="(interest, idx) in receiverInterestsIcons" :key="idx">
                  <div v-if="interest.type === 'couple-group'" class="flex items-center">
                    <Icon
                      v-for="(icon, i) in interest.icons"
                      :key="i"
                      :icon="icon.icon"
                      width="16"
                      height="16"
                      :class="[icon.colorClass, i === 1 ? '-ml-1.5' : '']"
                    />
                  </div>
                  <Icon
                    v-else-if="interest.type === 'single-female' || interest.type === 'single-male'"
                    :icon="interest.icon"
                    width="16"
                    height="16"
                    :class="interest.colorClass"
                  />
                </template>
              </div>
            </div>

            <!-- Location -->
            <div
              v-if="receiver?.location && receiver.location !== ', USA'"
              class="mt-1.5 flex items-center gap-1 text-xs text-gray-400"
            >
              <img
                src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg"
                alt="location"
                class="h-3 w-3 opacity-70"
              />
              <span>{{ receiver.location }}</span>
              <span v-if="item.location_how_far" class="ml-1 text-gray-500">
                {{ formatDistance(item.location_how_far) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Travel Plan Info -->
      <div class="relative flex flex-col gap-2.5">
        <div
          class="relative flex flex-col gap-2 rounded-md border border-blue-500/15 bg-linear-to-br from-blue-500/8 to-blue-500/3 p-3"
        >
          <div class="flex items-center gap-2 pr-10">
            <img
              src="https://www.sdc.com/react/assets/travelplans_plane.ab1f2629.svg"
              alt="plane"
              class="h-3.5 w-3.5 shrink-0 opacity-65 brightness-0 invert transition-opacity duration-200"
            />
            <div class="min-w-0 flex-1 text-[13px] text-white">
              <span>{{ travelLocation }}</span>
              <span v-if="travelDates">
                | <span class="font-semibold">{{ travelDates }}</span>
              </span>
            </div>
          </div>

          <div v-if="travelDescription" class="mt-1">
            <p class="m-0 text-[13px] leading-relaxed text-gray-300">{{ travelDescription }}</p>
          </div>

          <div
            class="group absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded border border-blue-500/15 bg-blue-500/8 transition-all duration-200 ease-in-out hover:border-blue-500/25 hover:bg-blue-500/12"
          >
            <img
              src="https://www.sdc.com/react/assets/travel_blue_icon.1c6fa1d6.svg"
              alt="travel"
              class="h-4 w-4 opacity-55 transition-opacity duration-200 group-hover:opacity-75"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
