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
    return `https://pictures.sdc.com/photos/${receiver.value.primary_photo}`;
  }
  return null;
});

// Parse age string (format: "35|32" or similar)
const parseAge = () => {
  if (!receiver.value?.age) return { first: null, second: null };
  const parts = receiver.value.age.split('|');
  return {
    first: parts[0]?.trim() || null,
    second: parts[1]?.trim() || null,
  };
};

const ages = computed(() => parseAge());

// Check if gender2 is a real person (not a placeholder)
// Gender2 is not real if age is > 100, undefined, or < 18
const isGender2Real = computed(() => {
  if (!ages.value.second) return false;
  const g2Age = parseInt(ages.value.second, 10);
  // If age is > 100 or < 18, it's not a real person
  return !isNaN(g2Age) && g2Age <= 100 && g2Age >= 18;
});

// Get age color based on gender (1 = female = pink, 0 = male = blue)
const getAgeColor = (gender: number | undefined) => {
  return gender === 1 ? 'rgb(255, 96, 223)' : 'rgb(58, 151, 254)';
};

// Check if first person has birthday
const hasBirthdayFirst = computed(() => {
  const birthdayFor = receiver.value?.birthday_for;
  if (!birthdayFor) return false;
  const parts = birthdayFor.split('|');
  return parts[0] === '1' && receiver.value?.gender1 === 1;
});

// Check if second person has birthday
const hasBirthdaySecond = computed(() => {
  const birthdayFor = receiver.value?.birthday_for;
  if (!birthdayFor) return false;
  const parts = birthdayFor.split('|');
  return parts[1] === '1' && receiver.value?.gender2 === 1;
});

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  // Return date as-is in MM/DD/YYYY format
  return dateStr.trim();
};

// Format all available dates
const formatAvailableDates = () => {
  const availableDays = extraData.value?.AvailableDays;
  if (!availableDays) return '';

  // Split by comma and filter out empty strings
  const dates = availableDays.split(',').filter((d: string) => d.trim());
  if (dates.length === 0) return '';

  // Format each date and join with " - "
  const formattedDates = dates.map((date: string) => formatDate(date.trim())).filter((d: string) => d);
  return formattedDates.join(' - ');
};

const availableDates = computed(() => formatAvailableDates());

const formatDistance = (km: number | undefined) => {
  if (!km) return '';
  return `${km} km`;
};

// Parse interests from summary_int (6 characters: Couple M/F, Couple F/F, Couple M/M, Single F, Single M, Transgender)
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

// Interests for left side (profile) - use summary_int
const profileInterests = computed(() => {
  const interestsStr = receiver.value?.summary_int || '';
  return parseInterests(interestsStr);
});

// Interests for right side (MET section) - use extra_data.interests
// For action 8, interests is in extra_data.interests
// For action 904, interests might be in extra_data.interests or elsewhere
const metInterests = computed(() => {
  const interestsStr = extraData.value?.interests || '';
  return parseInterests(interestsStr);
});

// Get interests icons for profile (left side)
// Only show couple icons if gender2 is real, otherwise filter them out
type LookingForIcon =
  | { type: 'couple-group'; icons: Array<{ icon: string; color: string }> }
  | { type: 'single-female' | 'single-male'; icon: string; color: string };

const profileInterestsIcons = computed((): LookingForIcon[] => {
  const icons: LookingForIcon[] = [];

  // Only show couple icons if this is actually a couple (gender2 is real)
  if (isGender2Real.value && profileInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#3a97fe' }, // Blue for male
        { icon: 'fa6-solid:person', color: '#ff60df' }, // Pink for female
      ],
    });
  }

  // Only show single icons if this is actually a single profile (gender2 is not real)
  if (!isGender2Real.value) {
    if (profileInterests.value.singleFemale) {
      icons.push({
        type: 'single-female',
        icon: 'fa6-solid:person',
        color: '#ff60df', // Pink
      });
    }

    if (profileInterests.value.singleMale) {
      icons.push({
        type: 'single-male',
        icon: 'fa6-solid:person',
        color: '#3a97fe', // Blue
      });
    }
  }

  return icons;
});

// Get interests icons for MET section (right side)
// MET section shows what they're looking for, so show all interests regardless of profile type
const metInterestsIcons = computed((): LookingForIcon[] => {
  const icons: LookingForIcon[] = [];

  if (metInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#3a97fe' }, // Blue for male
        { icon: 'fa6-solid:person', color: '#ff60df' }, // Pink for female
      ],
    });
  }

  if (metInterests.value.singleFemale) {
    icons.push({
      type: 'single-female',
      icon: 'fa6-solid:person',
      color: '#ff60df', // Pink
    });
  }

  if (metInterests.value.singleMale) {
    icons.push({
      type: 'single-male',
      icon: 'fa6-solid:person',
      color: '#3a97fe', // Blue
    });
  }

  return icons;
});

// Decode HTML entities (handles both &#39; and &#39 without semicolon)
const decodeHtmlEntities = (text: string) => {
  if (!text) return '';
  // First fix incomplete entities (like &#39 without semicolon)
  let fixed = text.replace(/&#(\d+)(?!;)/g, '&#$1;');
  // Then decode using textarea method
  const textarea = document.createElement('textarea');
  textarea.innerHTML = fixed;
  return textarea.value;
};

// Check if this is action 8 (Vrienden speed dating) vs 904 (Algemeen speed dating)
const isAction8 = computed(() => props.item.action === 8);

// Get message content - prefer body, but if PlaceToMeet exists and is different, show both
// For action 8, use personal_text from extra_data
const messageContent = computed(() => {
  let content = '';

  // For action 8, use personal_text
  if (isAction8.value && extraData.value?.personal_text) {
    content = extraData.value.personal_text;
  } else if (extraData.value?.PlaceToMeet && extraData.value.PlaceToMeet !== props.item.body) {
    content = extraData.value.PlaceToMeet;
  } else {
    content = props.item.body || '';
  }
  // Decode HTML entities
  return decodeHtmlEntities(content);
});

// Get date string - for action 8, use date_list from extra_data
const speedDatingDate = computed(() => {
  if (isAction8.value && extraData.value?.date_list) {
    // date_list format: "Jan 17,2026 | " - remove trailing " | "
    return extraData.value.date_list.replace(/\s*\|\s*$/, '').trim();
  }
  return availableDates.value;
});

// Get location - for action 8, use location from extra_data
const speedDatingLocation = computed(() => {
  if (isAction8.value && extraData.value?.location) {
    return extraData.value.location;
  }
  return extraData.value?.location || '';
});

// Get distance - for action 8, use how_far from extra_data
const speedDatingDistance = computed(() => {
  if (isAction8.value && extraData.value?.how_far !== undefined) {
    return extraData.value.how_far;
  }
  return extraData.value?.distance;
});

const cardRootClass = computed(() => {
  const isEven = props.index !== undefined && props.index % 2 === 0;
  return [
    'relative overflow-hidden rounded-[10px] border border-white/6 border-l-[3px] border-l-purple-500/40 transition-all duration-200 ease-in-out',
    'hover:bg-white/5 hover:border-white/10 hover:border-l-purple-500/60',
    isEven ? 'bg-white/[0.025]' : 'bg-white/[0.035]',
  ];
});
</script>

<template>
  <div :class="cardRootClass">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-white/6 bg-white/2 px-3.5 py-2.5">
      <p class="text-sm font-semibold tracking-tight text-white">
        Nieuwe speed date in jouw omgeving
      </p>
      <p class="text-xs font-medium text-gray-500">{{ item.timed }}</p>
    </div>

    <!-- Content -->
    <div class="grid grid-cols-1 gap-3 px-3.5 py-3 md:grid-cols-2">
      <!-- Left: Profile Info -->
      <div class="flex flex-col gap-2.5">
        <div class="flex items-start gap-2.5">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            :alt="receiver?.account_id"
            class="h-[60px] w-[60px] shrink-0 rounded-lg border-2 border-purple-500/60 object-cover"
          />
          <div class="min-w-0 flex-1">
            <p class="mb-1 text-sm font-semibold tracking-tight text-white">{{ receiver?.account_id }}</p>

            <!-- Age with colors and birthday icon -->
            <div v-if="ages.first || (ages.second && isGender2Real)" class="mt-1 flex flex-col gap-0.5 text-[13px]">
              <div class="inline-block whitespace-nowrap">
                <span
                  v-if="ages.first"
                  class="font-semibold"
                  :style="{ color: getAgeColor(receiver?.gender1) }"
                >
                  {{ ages.first }}
                </span>
                <span v-if="ages.first && ages.second && isGender2Real" class="mx-[3px] text-white/40"> | </span>
                <span
                  v-if="ages.second && isGender2Real"
                  class="font-semibold"
                  :style="{ color: getAgeColor(receiver?.gender2) }"
                >
                  {{ ages.second }}
                </span>
              </div>
              <div v-if="hasBirthdayFirst || hasBirthdaySecond" class="flex items-center gap-1.5">
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

            <!-- Device Icons -->
            <div v-if="receiver?.is_web_user || receiver?.speed || receiver?.online" class="float-right mt-1.5 flex items-center gap-1">
              <img
                v-if="receiver?.is_web_user"
                src="https://www.sdc.com/react/assets/web_user_icon.d5f27f46.svg"
                alt="is-web-user"
                class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity duration-200 hover:opacity-100"
                title="Web-gebruiker"
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

            <!-- Stats with icons -->
            <div class="mt-1.5 flex items-center gap-2.5">
              <div v-if="receiver?.photo_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg" alt="Foto's" class="h-3.5 w-3.5 opacity-80" />
                <span>{{ receiver.photo_count }}</span>
              </div>
              <div v-if="receiver?.video_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img src="https://www.sdc.com/react/assets/videos_white_icon.67fc13b6.svg" alt="Video's" class="h-3.5 w-3.5 opacity-80" />
                <span>{{ receiver.video_count }}</span>
              </div>
              <div v-if="receiver?.valid_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img src="https://www.sdc.com/react/assets/validate_grid_card.d90f25d9.svg" alt="Validaties" class="h-3.5 w-3.5 opacity-80" />
                <span>{{ receiver.valid_count }}</span>
              </div>
              <div v-if="receiver?.likes_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img src="https://www.sdc.com/react/assets/like_grid_card.c46847a1.svg" alt="Likes" class="h-3.5 w-3.5 opacity-80" />
                <span>{{ receiver.likes_count }}</span>
              </div>
            </div>

            <!-- Location -->
            <div v-if="receiver?.location" class="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
              <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="h-3 w-3 opacity-70" />
              <span>{{ receiver.location }}</span>
              <span v-if="item.location_how_far" class="ml-1 text-gray-500">
                {{ formatDistance(item.location_how_far) }}
              </span>
            </div>

            <!-- Interests -->
            <div v-if="profileInterestsIcons.length > 0" class="mt-1.5">
              <p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Interesses</p>
              <div class="flex items-center gap-1.5">
                <template v-for="(interestItem, interestIndex) in profileInterestsIcons" :key="interestIndex">
                  <!-- Couple group: display horizontally with overlapping -->
                  <div v-if="interestItem.type === 'couple-group'" class="flex items-center">
                    <Icon
                      v-for="(icon, i) in interestItem.icons"
                      :key="i"
                      :icon="icon.icon"
                      width="16"
                      height="16"
                      :class="i === 1 ? '-ml-1.5' : ''"
                      :style="{ color: icon.color }"
                    />
                  </div>
                  <!-- Single icons: render normally -->
                  <Icon
                    v-else-if="interestItem.type === 'single-female' || interestItem.type === 'single-male'"
                    :icon="interestItem.icon"
                    width="16"
                    height="16"
                    :style="{ color: interestItem.color }"
                  />
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Speed Dating Details -->
      <div class="flex flex-col gap-2.5">
        <div
          class="flex flex-col gap-1.5 rounded-lg border border-blue-500/15 bg-linear-to-br from-blue-500/8 to-blue-500/3 p-3"
        >
          <p class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Privé locatie</p>
          <div v-if="speedDatingDate" class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="min-w-0 flex-1 text-sm font-semibold leading-snug tracking-tight text-white">
              {{ isAction8 ? 'WANNEER:' : 'Beschikbaar' }}
            </p>
            <p class="shrink-0 whitespace-nowrap text-[10px] font-medium text-gray-400">
              {{ speedDatingDate }}
              <span v-if="isAction8 && speedDatingLocation" class="ml-1 text-gray-500"> at {{ speedDatingLocation }} </span>
            </p>
          </div>

          <!-- Message Content (only show once) -->
          <div v-if="messageContent" class="mt-2 rounded-md border-l-2 border-blue-500/40 bg-white/3 px-2.5 py-2">
            <p class="text-[13px] leading-relaxed text-gray-200">{{ messageContent }}</p>
          </div>

          <!-- Location and Distance (for action 904, not action 8) -->
          <div v-if="!isAction8 && speedDatingLocation" class="mt-1.5 flex items-center justify-between border-t border-white/6 pt-1.5">
            <div class="flex items-center gap-1 text-[10px] text-gray-400">
              <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="h-3 w-3 opacity-70" />
              <span>{{ speedDatingLocation }}</span>
            </div>
            <span v-if="speedDatingDistance !== undefined" class="text-[10px] font-medium text-gray-500">
              {{ formatDistance(speedDatingDistance) }}
            </span>
          </div>

          <!-- Interests for speed date -->
          <div v-if="metInterestsIcons.length > 0" class="mt-2 flex items-center gap-2 border-t border-white/6 pt-2">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">MET:</p>
            <div class="flex items-center gap-1.5">
              <template v-for="(interestItem, interestIndex) in metInterestsIcons" :key="interestIndex">
                <!-- Couple group: display horizontally with overlapping -->
                <div v-if="interestItem.type === 'couple-group'" class="flex items-center">
                  <Icon
                    v-for="(icon, i) in interestItem.icons"
                    :key="i"
                    :icon="icon.icon"
                    width="16"
                    height="16"
                    :class="i === 1 ? '-ml-1.5' : ''"
                    :style="{ color: icon.color }"
                  />
                </div>
                <!-- Single icons: render normally -->
                <Icon
                  v-else-if="interestItem.type === 'single-female' || interestItem.type === 'single-male'"
                  :icon="interestItem.icon"
                  width="16"
                  height="16"
                  :style="{ color: interestItem.color }"
                />
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
