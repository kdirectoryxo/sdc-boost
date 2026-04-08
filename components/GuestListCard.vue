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
const party = computed(() => props.item.party);

const photoUrl = computed(() => {
  if (receiver.value?.primary_photo) {
    if (receiver.value.primary_photo.startsWith('http')) {
      return receiver.value.primary_photo;
    }
    return `https://pictures.sdc.com/photos/${receiver.value.primary_photo}`;
  }
  return null;
});

const partyPhotoUrl = computed(() => {
  if (party.value?.primary_photo) {
    if (party.value.primary_photo.startsWith('http')) {
      return party.value.primary_photo;
    }
    return `https://pictures.sdc.com/photos/${party.value.primary_photo}`;
  }
  return null;
});

// Parse age string (format: "38|48" or similar)
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
// Gender2 is not real if age is > 100, undefined, or < 18
const isGender2Real = computed(() => {
  if (!ages.value.second) return false;
  const age = parseInt(ages.value.second, 10);
  return !isNaN(age) && age >= 18 && age <= 100;
});

// Get age color based on gender (1 = female = pink, 0 = male = blue)
const getAgeColor = (gender: number | undefined) => {
  return gender === 1 ? 'rgb(255, 96, 223)' : 'rgb(58, 151, 254)';
};

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

const receiverInterests = computed(() => {
  const interestsStr = receiver.value?.summary_int || '';
  return parseInterests(interestsStr);
});

const partyInterests = computed(() => {
  // Party interests are determined by filter_couple, filter_female, filter_male, filter_trans
  return {
    coupleMaleFemale: party.value?.filter_couple === 1,
    singleFemale: party.value?.filter_female === 1,
    singleMale: party.value?.filter_male === 1,
    transgender: party.value?.filter_trans === 1,
  };
});

// Get receiver interests icons
type LookingForIcon = 
  | { type: 'couple-group'; icons: Array<{ icon: string; color: string }> }
  | { type: 'single-female' | 'single-male' | 'transgender'; icon: string; color: string };

const receiverInterestsIcons = computed((): LookingForIcon[] => {
  const icons: LookingForIcon[] = [];
  
  if (receiverInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#3a97fe' }, // Blue for male
        { icon: 'fa6-solid:person', color: '#ff60df' }, // Pink for female
      ],
    });
  }
  
  if (receiverInterests.value.singleFemale) {
    icons.push({
      type: 'single-female',
      icon: 'fa6-solid:person',
      color: '#ff60df', // Pink
    });
  }
  
  if (receiverInterests.value.singleMale) {
    icons.push({
      type: 'single-male',
      icon: 'fa6-solid:person',
      color: '#3a97fe', // Blue
    });
  }
  
  return icons;
});

// Get party welcome interests icons
const partyInterestsIcons = computed((): LookingForIcon[] => {
  const icons: LookingForIcon[] = [];
  
  if (partyInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple-group',
      icons: [
        { icon: 'fa6-solid:person', color: '#3a97fe' }, // Blue for male
        { icon: 'fa6-solid:person', color: '#ff60df' }, // Pink for female
      ],
    });
  }
  
  if (partyInterests.value.singleFemale) {
    icons.push({
      type: 'single-female',
      icon: 'fa6-solid:person',
      color: '#ff60df', // Pink
    });
  }
  
  if (partyInterests.value.singleMale) {
    icons.push({
      type: 'single-male',
      icon: 'fa6-solid:person',
      color: '#3a97fe', // Blue
    });
  }
  
  if (partyInterests.value.transgender) {
    icons.push({
      type: 'transgender',
      icon: 'fa6-solid:person',
      color: '#9ca3af', // Gray for transgender
    });
  }
  
  return icons;
});

const handleRemoveFromGuestList = () => {
  // TODO: Implement API call to remove from guest list
  console.log('Remove from guest list', party.value?.agenda_id);
};
</script>

<template>
  <div
    :class="[
      'relative overflow-hidden rounded-[10px] border border-white/6 border-l-[3px] border-l-[rgba(255,241,165,0.4)] transition-all duration-200 ease-in-out',
      props.index !== undefined && props.index % 2 === 0 ? 'bg-white/2.5' : 'bg-white/3.5',
      'hover:bg-white/5 hover:border-white/10 hover:border-l-[rgba(255,241,165,0.6)]',
    ]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-white/6 bg-white/2 px-3.5 py-2.5">
      <p class="text-sm font-semibold tracking-tight text-white">
        Lid is toegevoegd aan een gastenlijst
      </p>
      <p class="text-xs font-medium text-gray-500">{{ item.timed }}</p>
    </div>

    <!-- Content -->
    <div class="grid grid-cols-1 gap-2.5 p-2.5 px-3 md:grid-cols-2">
      <!-- Left: Member Profile -->
      <div class="flex flex-col gap-2">
        <div class="flex items-start gap-2.5">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            :alt="receiver?.account_id"
            class="h-[60px] w-[60px] shrink-0 rounded-lg border-2 border-[rgba(255,241,165,0.6)] object-cover"
          />
          <div
            v-else
            class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg border-2 border-[rgba(255,241,165,0.6)] bg-linear-to-br from-[rgba(255,241,165,0.15)] to-[rgba(255,241,165,0.05)]"
          >
            <span class="text-xl font-semibold text-amber-400">{{ receiver?.account_id?.charAt(0) || '?' }}</span>
          </div>
          <div class="flex flex-1 flex-col gap-1">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold tracking-tight text-white">{{ receiver?.account_id }}</p>
              <div class="flex items-center gap-1">
                <img 
                  v-if="receiver?.is_web_user" 
                  src="https://www.sdc.com/react/assets/web_user_icon.d5f27f46.svg" 
                  alt="is-web-user" 
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity duration-200 ease-in-out hover:opacity-100"
                  title="Web-gebruiker"
                />
                <img 
                  v-if="receiver?.online === 1" 
                  src="https://www.sdc.com/react/assets/messenger_online_icon.0a87dd19.svg" 
                  alt="user-is-online" 
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity duration-200 ease-in-out hover:opacity-100"
                  title="Chat nu"
                />
              </div>
            </div>
            
            <!-- Age with colors - only show second if real -->
            <div v-if="ages.first" class="inline-block text-[11px] font-medium">
              <span 
                class="font-semibold"
                :style="{ color: getAgeColor(receiver?.gender1) }"
              >
                {{ ages.first }}
              </span>
              <template v-if="isGender2Real">
                <span class="mx-[3px] text-white/40"> | </span>
                <span 
                  class="font-semibold"
                  :style="{ color: getAgeColor(receiver?.gender2) }"
                >
                  {{ ages.second }}
                </span>
              </template>
            </div>

            <!-- Stats with icons -->
            <div class="mt-1 flex items-center gap-2.5">
              <div v-if="receiver?.photo_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg" alt="Foto's" class="h-3.5 w-3.5 opacity-80" />
                <span>{{ receiver.photo_count }}</span>
              </div>
              <div v-if="receiver?.likes_count" class="flex items-center gap-0.5 text-xs text-gray-400">
                <img src="https://www.sdc.com/react/assets/like_grid_card.c46847a1.svg" alt="Likes" class="h-3.5 w-3.5 opacity-80" />
                <span>{{ receiver.likes_count }}</span>
              </div>
            </div>

            <!-- Interests -->
            <div v-if="receiverInterestsIcons.length > 0" class="flex items-center gap-2">
              <p class="m-0 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Interesses</p>
              <div class="flex items-center gap-[5px]">
                <template v-for="(item, index) in receiverInterestsIcons" :key="index">
                  <!-- Couple group: display horizontally with overlapping -->
                  <div v-if="item.type === 'couple-group'" class="flex items-center">
                    <Icon 
                      v-for="(icon, i) in item.icons" 
                      :key="i"
                      :icon="icon.icon"
                      width="16"
                      height="16"
                      :class="i === 1 ? '-ml-[6px]' : ''"
                      :style="{ color: icon.color }"
                    />
                  </div>
                  <!-- Single icons: render normally -->
                  <Icon 
                    v-else-if="item.type === 'single-female' || item.type === 'single-male'"
                    :icon="item.icon"
                    width="16"
                    height="16"
                    :style="{ color: item.color }"
                  />
                </template>
              </div>
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

      <!-- Right: Party Event -->
      <div class="flex flex-col gap-2">
        <div class="relative min-h-[120px] rounded-md border border-blue-500/15 bg-linear-to-br from-blue-500/8 to-blue-500/3 p-2.5">
          <div class="flex flex-col gap-1">
            <p class="m-0 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{{ party?.event_type === 1 ? 'Publieke Party' : 'Privé Party' }}</p>
            <p class="m-0 text-sm font-semibold leading-snug tracking-tight text-white">{{ party?.title }}</p>
            <p class="m-0 text-[10px] text-gray-400">
              door <span class="wrap-break-word text-[10px] font-medium text-amber-400">{{ party?.accountid }}</span>
            </p>
            <p class="m-0 text-[10px] font-medium text-gray-400">{{ party?.date_str }}</p>
            
            <!-- Welcome Interests -->
            <div v-if="partyInterestsIcons.length > 0" class="mt-1.5 flex items-center gap-1.5 border-t border-white/6 pt-1.5">
              <p class="m-0 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Welkom</p>
              <div class="flex items-center gap-[5px]">
                <template v-for="(item, index) in partyInterestsIcons" :key="index">
                  <!-- Couple group: display horizontally with overlapping -->
                  <div v-if="item.type === 'couple-group'" class="flex items-center">
                    <Icon 
                      v-for="(icon, i) in item.icons" 
                      :key="i"
                      :icon="icon.icon"
                      width="16"
                      height="16"
                      :class="i === 1 ? '-ml-[6px]' : ''"
                      :style="{ color: icon.color }"
                    />
                  </div>
                  <!-- Single icons: render normally -->
                  <Icon 
                    v-else-if="item.type === 'single-female' || item.type === 'single-male' || item.type === 'transgender'"
                    :icon="item.icon"
                    width="16"
                    height="16"
                    :style="{ color: item.color }"
                  />
                </template>
              </div>
            </div>

            <!-- Location and Distance -->
            <div v-if="party?.location" class="mt-1.5 flex items-center justify-between border-t border-white/6 pt-1.5">
              <div class="flex items-center gap-1 text-[10px] text-gray-400">
                <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="h-3 w-3 opacity-70" />
                <span>{{ party.location }}</span>
              </div>
              <span v-if="party?.distance" class="text-[10px] font-medium text-gray-500">
                {{ formatDistance(party.distance) }}
              </span>
            </div>

            <!-- Remove Button -->
            <!-- <div class="mt-1.5 border-t border-white/6 pt-1.5">
              <button
                type="button"
                class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[5px] border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-400 transition-all duration-200 ease-in-out hover:border-red-500/30 hover:bg-red-500/[0.15] hover:text-red-300"
                @click="handleRemoveFromGuestList"
              >
                <img src="https://www.sdc.com/react/assets/remove_white_icon.f1e5b75d.svg" alt="remove_me_from_guest_list" class="h-3 w-3" />
                <span>verwijder mij</span>
              </button>
            </div> -->
          </div>
          
          <!-- Party Icon -->
          <div class="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded border border-blue-500/25 bg-blue-500/15">
            <img src="https://www.sdc.com/react/assets/parties_blue_icon.2df43137.svg" alt="party" class="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
