<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
}

const props = defineProps<Props>();

const sender = computed(() => props.item.sender);
const receiver = computed(() => props.item.receiver);

// Determine action type and message
// Based on SDC source code action mappings:
// Action 3 = likeReceivedActionId
// Action 21 = validationReceivedStatusAcceptedActionId (receiver validated sender)
// Action 22 = matchLikeActionId (mutual match)
const getActionInfo = () => {
  switch (props.item.action) {
    case 3:
      // Like received: receiver liked sender (from profile owner's perspective)
      // API returns: sender = profile owner, receiver = the one who liked
      return {
        title: `${receiver.value?.account_id || 'Iemand'} heeft ${sender.value?.account_id || 'jouw profiel'} een like gegeven`,
        icon: '❤️',
        type: 'like'
      };
    case 21:
      // Validation: "receiver validated sender" (receiver.accountId validated sender.accountId)
      return {
        title: `${receiver.value?.account_id || 'Iemand'} heeft ${sender.value?.account_id || 'jou'} gevalideerd`,
        icon: '✓',
        type: 'validation',
        subject: props.item.extra_data?.subject || ''
      };
    case 22:
      // Mutual match: both users liked each other
      return {
        title: 'Mutual match',
        icon: '💕',
        type: 'match'
      };
    default:
      return {
        title: 'Nieuwe interactie',
        icon: '🔔',
        type: 'unknown'
      };
  }
};

const actionInfo = computed(() => getActionInfo());

// For validation (action 21), the roles are reversed: receiver validated sender
// For like (action 3), receiver liked sender (from profile owner's perspective)
//   API returns: sender = profile owner, receiver = the one who liked
// For match (action 22), both liked each other
const primaryProfile = computed(() => {
  if (actionInfo.value.type === 'validation') {
    return receiver.value; // The one who validated
  }
  if (actionInfo.value.type === 'like') {
    return receiver.value; // The one who liked (receiver in API response)
  }
  return sender.value; // For match, use sender
});

const secondaryProfile = computed(() => {
  if (actionInfo.value.type === 'validation') {
    return sender.value; // The one who was validated
  }
  if (actionInfo.value.type === 'like') {
    return sender.value; // The one who was liked (sender in API response = profile owner)
  }
  return receiver.value; // For match, use receiver
});

const primaryPhotoUrl = computed(() => {
  const profile = primaryProfile.value;
  if (profile?.primary_photo) {
    if (profile.primary_photo.startsWith('http')) {
      return profile.primary_photo;
    }
    if (profile.primary_photo !== '/thumbnail/') {
      return `https://pictures.sdc.com/photos/${profile.primary_photo}`;
    }
  }
  return null;
});

const secondaryPhotoUrl = computed(() => {
  const profile = secondaryProfile.value;
  if (profile?.primary_photo) {
    if (profile.primary_photo.startsWith('http')) {
      return profile.primary_photo;
    }
    return `https://pictures.sdc.com/photos/${profile.primary_photo}`;
  }
  return null;
});

// Parse age string (format: "35|32" or similar)
const parseAge = (ageStr: string | undefined) => {
  if (!ageStr) return { first: null, second: null };
  const parts = ageStr.split('|');
  return {
    first: parts[0]?.trim() || null,
    second: parts[1]?.trim() || null,
  };
};

// Check if second person age is real (not a placeholder)
// Gender2 is not real if age is > 100, undefined, or < 18
const isSecondAgeReal = (ageSecond: string | null) => {
  if (!ageSecond) return false;
  const age = parseInt(ageSecond, 10);
  return !isNaN(age) && age >= 18 && age <= 100;
};

const primaryAges = computed(() => parseAge(primaryProfile.value?.age));
const secondaryAges = computed(() => parseAge(secondaryProfile.value?.age));
const senderAges = computed(() => parseAge(sender.value?.age));
const receiverAges = computed(() => parseAge(receiver.value?.age));

// Check if each profile has a real second person
const isPrimaryGender2Real = computed(() => isSecondAgeReal(primaryAges.value.second));
const isSecondaryGender2Real = computed(() => isSecondAgeReal(secondaryAges.value.second));
const isSenderGender2Real = computed(() => isSecondAgeReal(senderAges.value.second));
const isReceiverGender2Real = computed(() => isSecondAgeReal(receiverAges.value.second));

/** Tailwind: female = pink, male = blue (matches previous rgb values) */
const getAgeColorClass = (gender: number | undefined) =>
  gender === 1 ? 'text-[rgb(255,96,223)]' : 'text-[rgb(58,151,254)]';

const formatDistance = (km: number | undefined) => {
  if (!km) return '';
  return `${km} km`;
};

const rootCardClass = computed(() => {
  const stripe = props.index !== undefined && props.index % 2 === 0;
  return [
    'relative overflow-hidden rounded-[10px] border border-white/6 border-l-[3px] border-l-purple-500/40 bg-white/3 transition-all duration-200 ease-in-out',
    stripe ? 'bg-white/[0.025]' : 'bg-white/[0.035]',
    'hover:border-white/10 hover:bg-white/5 hover:border-l-purple-500/60',
  ].join(' ');
});
</script>

<template>
  <div :class="rootCardClass">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-white/6 bg-white/2 px-3.5 py-2.5">
      <div class="flex items-center gap-2">
        <span class="text-sm leading-none">{{ actionInfo.icon }}</span>
        <p class="m-0 text-sm font-semibold tracking-tight text-white">{{ actionInfo.title }}</p>
      </div>
      <p class="m-0 text-xs font-medium text-gray-500">{{ item.timed }}</p>
    </div>

    <!-- Content -->
    <div class="flex flex-col gap-3 px-3.5 py-3">
      <!-- All profile types use 2-column grid layout -->
      <div class="grid grid-cols-1 gap-3 min-[601px]:grid-cols-2">
        <!-- For match: show sender and receiver -->
        <template v-if="actionInfo.type === 'match'">
          <!-- Sender Profile -->
          <div class="flex flex-col gap-1.5">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{{ sender?.account_id || 'Gebruiker 1' }}</div>
            <div class="flex items-start gap-2.5">
              <img
                v-if="sender?.primary_photo && sender.primary_photo !== '/thumbnail/'"
                :src="sender.primary_photo.startsWith('http') ? sender.primary_photo : `https://pictures.sdc.com/photos/${sender.primary_photo}`"
                :alt="sender?.account_id"
                class="h-[60px] w-[60px] shrink-0 rounded-lg border-2 border-purple-500/60 object-cover"
              />
              <div
                v-else
                class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg border-2 border-purple-500/60 bg-linear-to-br from-purple-500/15 to-purple-500/5"
              >
                <span class="text-xl font-semibold text-blue-400">{{ sender?.account_id?.charAt(0) || '?' }}</span>
              </div>
              <div class="flex flex-1 flex-col gap-1">
                <p class="m-0 text-sm font-semibold tracking-tight text-white">{{ sender?.account_id || 'Onbekend' }}</p>

                <!-- Age with colors - only show second if real -->
                <div v-if="senderAges.first" class="inline-block text-[13px] font-medium">
                  <span :class="['font-semibold', getAgeColorClass(sender?.gender1)]">
                    {{ senderAges.first }}
                  </span>
                  <template v-if="isSenderGender2Real">
                    <span class="mx-0.5 text-white/40"> | </span>
                    <span :class="['font-semibold', getAgeColorClass(sender?.gender2)]">
                      {{ senderAges.second }}
                    </span>
                  </template>
                </div>

                <!-- Location -->
                <div v-if="sender?.location && sender.location !== ', USA'" class="flex items-center gap-1 text-xs text-gray-400">
                  <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="h-3 w-3 opacity-70" />
                  <span>{{ sender.location }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Receiver Profile -->
          <div class="flex flex-col gap-1.5">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{{ receiver?.account_id || 'Gebruiker 2' }}</div>
            <div class="flex items-start gap-2.5">
              <img
                v-if="receiver?.primary_photo && receiver.primary_photo !== '/thumbnail/'"
                :src="receiver.primary_photo.startsWith('http') ? receiver.primary_photo : `https://pictures.sdc.com/photos/${receiver.primary_photo}`"
                :alt="receiver?.account_id"
                class="h-[60px] w-[60px] shrink-0 rounded-lg border-2 border-purple-500/60 object-cover"
              />
              <div
                v-else
                class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg border-2 border-purple-500/60 bg-linear-to-br from-purple-500/15 to-purple-500/5"
              >
                <span class="text-xl font-semibold text-blue-400">{{ receiver?.account_id?.charAt(0) || '?' }}</span>
              </div>
              <div class="flex flex-1 flex-col gap-1">
                <p class="m-0 text-sm font-semibold tracking-tight text-white">{{ receiver?.account_id || 'Onbekend' }}</p>

                <!-- Age with colors - only show second if real -->
                <div v-if="receiverAges.first" class="inline-block text-[13px] font-medium">
                  <span :class="['font-semibold', getAgeColorClass(receiver?.gender1)]">
                    {{ receiverAges.first }}
                  </span>
                  <template v-if="isReceiverGender2Real">
                    <span class="mx-0.5 text-white/40"> | </span>
                    <span :class="['font-semibold', getAgeColorClass(receiver?.gender2)]">
                      {{ receiverAges.second }}
                    </span>
                  </template>
                </div>

                <!-- Location -->
                <div v-if="receiver?.location" class="flex items-center gap-1 text-xs text-gray-400">
                  <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="h-3 w-3 opacity-70" />
                  <span>{{ receiver.location }}</span>
                  <span v-if="item.location_how_far" class="ml-1 text-gray-500">
                    {{ formatDistance(item.location_how_far) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- For like and validation: show primary and secondary profiles side by side -->
        <template v-else>
          <!-- Primary Profile (who did the action) -->
          <div class="flex flex-col gap-1.5">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{{ primaryProfile?.account_id || 'Iemand' }}</div>
            <div class="flex items-start gap-2.5">
              <img
                v-if="primaryPhotoUrl"
                :src="primaryPhotoUrl"
                :alt="primaryProfile?.account_id"
                class="h-[60px] w-[60px] shrink-0 rounded-lg border-2 border-purple-500/60 object-cover"
              />
              <div
                v-else
                class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg border-2 border-purple-500/60 bg-linear-to-br from-purple-500/15 to-purple-500/5"
              >
                <span class="text-xl font-semibold text-blue-400">{{ primaryProfile?.account_id?.charAt(0) || '?' }}</span>
              </div>
              <div class="flex flex-1 flex-col gap-1">
                <p class="m-0 text-sm font-semibold tracking-tight text-white">{{ primaryProfile?.account_id || 'Onbekend' }}</p>

                <!-- Age with colors - only show second if real -->
                <div v-if="primaryAges.first" class="inline-block text-[13px] font-medium">
                  <span :class="['font-semibold', getAgeColorClass(primaryProfile?.gender1)]">
                    {{ primaryAges.first }}
                  </span>
                  <template v-if="isPrimaryGender2Real">
                    <span class="mx-0.5 text-white/40"> | </span>
                    <span :class="['font-semibold', getAgeColorClass(primaryProfile?.gender2)]">
                      {{ primaryAges.second }}
                    </span>
                  </template>
                </div>

                <!-- Location -->
                <div v-if="primaryProfile?.location && primaryProfile.location !== ', USA'" class="flex items-center gap-1 text-xs text-gray-400">
                  <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="h-3 w-3 opacity-70" />
                  <span>{{ primaryProfile.location }}</span>
                </div>

                <!-- Stats -->
                <div class="mt-1 flex items-center gap-2.5">
                  <div v-if="primaryProfile?.photo_count" class="flex items-center gap-[3px] text-xs text-gray-400">
                    <img src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg" alt="Foto's" class="h-3.5 w-3.5 opacity-80" />
                    <span>{{ primaryProfile.photo_count }}</span>
                  </div>
                  <div v-if="primaryProfile?.likes_count" class="flex items-center gap-[3px] text-xs text-gray-400">
                    <img src="https://www.sdc.com/react/assets/like_grid_card.c46847a1.svg" alt="Likes" class="h-3.5 w-3.5 opacity-80" />
                    <span>{{ primaryProfile.likes_count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Secondary Profile (who received the action) -->
          <div class="flex flex-col gap-1.5">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{{ secondaryProfile?.account_id || 'Jij' }}</div>
            <div class="flex items-start gap-2.5">
              <img
                v-if="secondaryPhotoUrl"
                :src="secondaryPhotoUrl"
                :alt="secondaryProfile?.account_id"
                class="h-[60px] w-[60px] shrink-0 rounded-lg border-2 border-purple-500/60 object-cover"
              />
              <div
                v-else
                class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg border-2 border-purple-500/60 bg-linear-to-br from-purple-500/15 to-purple-500/5"
              >
                <span class="text-xl font-semibold text-blue-400">{{ secondaryProfile?.account_id?.charAt(0) || '?' }}</span>
              </div>
              <div class="flex flex-1 flex-col gap-1">
                <p class="m-0 text-sm font-semibold tracking-tight text-white">{{ secondaryProfile?.account_id || 'Jij' }}</p>

                <!-- Age with colors - only show second if real -->
                <div v-if="secondaryAges.first" class="inline-block text-[13px] font-medium">
                  <span :class="['font-semibold', getAgeColorClass(secondaryProfile?.gender1)]">
                    {{ secondaryAges.first }}
                  </span>
                  <template v-if="isSecondaryGender2Real">
                    <span class="mx-0.5 text-white/40"> | </span>
                    <span :class="['font-semibold', getAgeColorClass(secondaryProfile?.gender2)]">
                      {{ secondaryAges.second }}
                    </span>
                  </template>
                </div>

                <!-- Location -->
                <div v-if="secondaryProfile?.location" class="flex items-center gap-1 text-xs text-gray-400">
                  <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="h-3 w-3 opacity-70" />
                  <span>{{ secondaryProfile.location }}</span>
                  <span v-if="item.location_how_far && actionInfo.type !== 'validation'" class="ml-1 text-gray-500">
                    {{ formatDistance(item.location_how_far) }}
                  </span>
                </div>

                <!-- Stats -->
                <div class="mt-1 flex items-center gap-2.5">
                  <div v-if="secondaryProfile?.photo_count" class="flex items-center gap-[3px] text-xs text-gray-400">
                    <img src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg" alt="Foto's" class="h-3.5 w-3.5 opacity-80" />
                    <span>{{ secondaryProfile.photo_count }}</span>
                  </div>
                  <div v-if="secondaryProfile?.likes_count" class="flex items-center gap-[3px] text-xs text-gray-400">
                    <img src="https://www.sdc.com/react/assets/like_grid_card.c46847a1.svg" alt="Likes" class="h-3.5 w-3.5 opacity-80" />
                    <span>{{ secondaryProfile.likes_count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Validation Subject (for action 21) - shown below the grid -->
      <div v-if="actionInfo.type === 'validation' && actionInfo.subject" class="mt-2 border-t border-white/6 pt-2.5">
        <p class="mb-1.5 mt-0 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Bericht:</p>
        <p class="m-0 rounded-md border-l-2 border-l-blue-500/40 bg-white/3 px-2.5 py-2 text-[11px] italic leading-relaxed text-gray-200">
          {{ actionInfo.subject }}
        </p>
      </div>
    </div>
  </div>
</template>
