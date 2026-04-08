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

// Parse age string (format: "33|32" or similar)
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

const age1TextClass = computed(() =>
  receiver.value?.gender1 === 1 ? 'text-[rgb(255,96,223)]' : 'text-[rgb(58,151,254)]',
);

const age2TextClass = computed(() =>
  receiver.value?.gender2 === 1 ? 'text-[rgb(255,96,223)]' : 'text-[rgb(58,151,254)]',
);

// Check if first person has birthday
const hasBirthdayFirst = computed(() => {
  const birthdayFor = receiver.value?.birthday_for;
  if (!birthdayFor) return false;
  const parts = birthdayFor.split('|');
  return parts[0] === '1';
});

// Check if second person has birthday
const hasBirthdaySecond = computed(() => {
  const birthdayFor = receiver.value?.birthday_for;
  if (!birthdayFor) return false;
  const parts = birthdayFor.split('|');
  return parts[1] === '1';
});

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
  | { type: 'couple-group'; icons: Array<{ icon: string }> }
  | { type: 'single-female' | 'single-male'; icon: string };

const receiverInterestsIcons = computed((): LookingForIcon[] => {
  const icons: LookingForIcon[] = [];

  if (isGender2Real.value && receiverInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple-group',
      icons: [{ icon: 'fa6-solid:person' }, { icon: 'fa6-solid:person' }],
    });
  }

  if (!isGender2Real.value) {
    if (receiverInterests.value.singleFemale) {
      icons.push({ type: 'single-female', icon: 'fa6-solid:person' });
    }

    if (receiverInterests.value.singleMale) {
      icons.push({ type: 'single-male', icon: 'fa6-solid:person' });
    }
  }

  return icons;
});

// Determine birthday text based on who has birthday
const birthdayText = computed(() => {
  if (hasBirthdayFirst.value && hasBirthdaySecond.value) {
    return 'Hun verjaardag';
  } else if (hasBirthdayFirst.value) {
    return receiver.value?.gender1 === 1 ? 'Haar verjaardag' : 'Zijn verjaardag';
  } else if (hasBirthdaySecond.value) {
    return receiver.value?.gender2 === 1 ? 'Haar verjaardag' : 'Zijn verjaardag';
  }
  return 'Verjaardag';
});

const cardRootClass = computed(() => {
  const stripe = 'border-l-[3px] border-l-[rgba(255,192,203,0.4)]';
  const base =
    `relative overflow-hidden rounded-[10px] border border-white/6 ${stripe} ` +
    'transition-all duration-200 ease-in-out ' +
    'hover:bg-white/5 hover:border-white/10 hover:border-l-[rgba(255,192,203,0.6)]';
  const alt =
    props.index !== undefined && props.index % 2 === 0 ? 'bg-white/2.5' : 'bg-white/3.5';
  return [base, alt];
});
</script>

<template>
  <div :class="cardRootClass">
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-white/6 bg-white/2 px-3 py-2"
    >
      <p class="text-sm font-semibold tracking-tight text-white">
        {{ receiver?.account_id }} in jouw omgeving heeft een verjaardag
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
            class="h-[60px] w-[60px] shrink-0 rounded-lg border-2 border-pink-200/60 object-cover"
          />
          <div
            v-else
            class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg border-2 border-pink-200/60 bg-linear-to-br from-pink-200/15 to-pink-200/5"
          >
            <span class="text-xl font-semibold text-[#ffb3d1]">{{ receiver?.account_id?.charAt(0) || '?' }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex items-center justify-between">
              <p class="text-sm font-semibold tracking-tight text-white">{{ receiver?.account_id }}</p>
              <div class="ml-1.5 flex items-center gap-1">
                <img
                  v-if="receiver?.is_web_user"
                  src="https://www.sdc.com/react/assets/web_user_icon.d5f27f46.svg"
                  alt="is-web-user"
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity hover:opacity-100"
                  title="Web-gebruiker"
                />
                <img
                  v-if="receiver?.speed"
                  src="https://www.sdc.com/react/assets/speed_white.3176d40b.svg"
                  alt="is-speed-date"
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity hover:opacity-100"
                  title="Speed Date"
                />
                <img
                  v-if="receiver?.online === 1"
                  src="https://www.sdc.com/react/assets/messenger_online_icon.0a87dd19.svg"
                  alt="user-is-online"
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity hover:opacity-100"
                  title="Chat nu"
                />
              </div>
            </div>

            <!-- Age with colors and birthday icon -->
            <div
              v-if="ages.first || (ages.second && isGender2Real)"
              class="mt-1 flex flex-col gap-0.5 text-[11px]"
            >
              <div class="inline-block whitespace-nowrap">
                <span v-if="ages.first" class="font-semibold" :class="age1TextClass">
                  {{ ages.first }}
                </span>
                <span
                  v-if="ages.first && ages.second && isGender2Real"
                  class="mx-0.5 text-white/40"
                >
                  |
                </span>
                <span v-if="ages.second && isGender2Real" class="font-semibold" :class="age2TextClass">
                  {{ ages.second }}
                </span>
              </div>
              <div v-if="hasBirthdayFirst || hasBirthdaySecond" class="flex items-center gap-[5px]">
                <img
                  v-if="hasBirthdayFirst"
                  src="https://www.sdc.com/react/assets/female_birthday_icon.fe78472e.svg"
                  alt="cake"
                  title="Is jarig"
                  class="h-3 w-3"
                />
                <img
                  v-if="hasBirthdaySecond"
                  src="https://www.sdc.com/react/assets/female_birthday_icon.fe78472e.svg"
                  alt="cake"
                  title="Is jarig"
                  class="h-3 w-3"
                />
              </div>
            </div>

            <!-- Stats with icons -->
            <div class="mt-1.5 flex items-center gap-2.5">
              <div v-if="receiver?.photo_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img
                  src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg"
                  alt="Foto's"
                  class="h-3.5 w-3.5 opacity-80"
                />
                <span>{{ receiver.photo_count }}</span>
              </div>
              <div v-if="receiver?.video_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img
                  src="https://www.sdc.com/react/assets/videos_white_icon.67fc13b6.svg"
                  alt="Video's"
                  class="h-3.5 w-3.5 opacity-80"
                />
                <span>{{ receiver.video_count }}</span>
              </div>
              <div v-if="receiver?.valid_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img
                  src="https://www.sdc.com/react/assets/validate_grid_card.d90f25d9.svg"
                  alt="Validaties"
                  class="h-3.5 w-3.5 opacity-80"
                />
                <span>{{ receiver.valid_count }}</span>
              </div>
              <div v-if="receiver?.likes_count" class="flex items-center gap-0.5 text-xs text-gray-400">
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
                <template v-for="(interestItem, idx) in receiverInterestsIcons" :key="idx">
                  <!-- Couple group: display horizontally with overlapping -->
                  <div v-if="interestItem.type === 'couple-group'" class="flex items-center">
                    <Icon
                      v-for="(iconEntry, i) in interestItem.icons"
                      :key="i"
                      :icon="iconEntry.icon"
                      width="16"
                      height="16"
                      :class="[
                        i === 1 ? '-ml-1.5' : '',
                        i === 0 ? 'text-[#3a97fe]' : 'text-[#ff60df]',
                      ]"
                    />
                  </div>
                  <!-- Single icons: render normally -->
                  <Icon
                    v-else-if="interestItem.type === 'single-female' || interestItem.type === 'single-male'"
                    :icon="interestItem.icon"
                    width="16"
                    height="16"
                    :class="
                      interestItem.type === 'single-female' ? 'text-[#ff60df]' : 'text-[#3a97fe]'
                    "
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

      <!-- Right: Birthday Info -->
      <div class="flex flex-col gap-2.5">
        <div
          class="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-md border border-pink-200/15 bg-linear-to-br from-pink-200/8 to-pink-200/3 p-4"
        >
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full bg-pink-200/10 text-[#ffb3d1]"
          >
            <img
              src="https://www.sdc.com/react/assets/female_birthday_icon.fe78472e.svg"
              alt="birthday cake"
              class="h-9 w-9 filter-[brightness(0)_saturate(100%)_invert(58%)_sepia(100%)_saturate(2000%)_hue-rotate(200deg)_brightness(1.2)]"
            />
          </div>
          <p class="m-0 text-center text-sm font-semibold text-white">{{ birthdayText }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
