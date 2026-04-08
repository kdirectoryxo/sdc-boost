<script lang="ts" setup>
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
}

type LookingForIcon =
  | { type: 'couple-group'; icons: Array<{ icon: string; colorClass: string }> }
  | { type: 'single-female' | 'single-male'; icon: string; colorClass: string };

const props = defineProps<Props>();

const sender = computed(() => props.item.sender);
const receiver = computed(() => props.item.receiver);
const extraData = computed(() => props.item.extra_data);

const isPartyAnnouncement = computed(() => props.item.action === 100);
const isGroupJoin = computed(() => props.item.action === 18 || props.item.action === 38);
const isBlogPost = computed(() => props.item.action === 300);

const getGenderColorClass = (gender: number | undefined) =>
  gender === 1 ? 'text-[#ff60df]' : 'text-[#3a97fe]';

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

const parseAge = () => {
  if (!receiver.value?.age) {
    return { first: null, second: null };
  }

  const parts = receiver.value.age.split('|');

  return {
    first: parts[0]?.trim() || null,
    second: parts[1]?.trim() || null,
  };
};

const ages = computed(() => parseAge());

const isGender2Real = computed(() => {
  if (!ages.value.second) {
    return false;
  }

  const age = parseInt(ages.value.second, 10);
  return !Number.isNaN(age) && age >= 18 && age <= 100;
});

const formatDistance = (km: number | undefined) => {
  if (!km) {
    return '';
  }

  return `${km} km`;
};

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

const receiverInterests = computed(() => parseInterests(receiver.value?.summary_int || ''));

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

  if (!isGender2Real.value && receiverInterests.value.singleFemale) {
    icons.push({
      type: 'single-female',
      icon: 'fa6-solid:person',
      colorClass: 'text-[#ff60df]',
    });
  }

  if (!isGender2Real.value && receiverInterests.value.singleMale) {
    icons.push({
      type: 'single-male',
      icon: 'fa6-solid:person',
      colorClass: 'text-[#3a97fe]',
    });
  }

  return icons;
});

const blogContent = computed(() => {
  if (isPartyAnnouncement.value) {
    const subject = props.item.subject ? `<h3>${props.item.subject}</h3>` : '';
    return subject + (props.item.body || '');
  }

  if (isGroupJoin.value) {
    return '';
  }

  return extraData.value?.comment || props.item.body || '';
});

const groupImageUrl = computed(() => {
  if (isGroupJoin.value && extraData.value?.picture) {
    return `https://pictures.sdc.com/group/logo/${extraData.value.picture}`;
  }

  return null;
});

const groupCategory = computed(() => extraData.value?.category_name || '');
const groupAdmin = computed(() => extraData.value?.account_id || '');
const groupDescription = computed(
  () => extraData.value?.long_description || extraData.value?.short_description || '',
);
const groupLocation = computed(() => extraData.value?.location_comm || '');
const groupMemberCount = computed(() => extraData.value?.total_members || 0);
const groupCreatedDate = computed(() => extraData.value?.account_since || '');

const groupName = computed(() => {
  if (isGroupJoin.value && extraData.value?.clubname) {
    return extraData.value.clubname;
  }

  return extraData.value?.club_name || '';
});

const headerText = computed(() => {
  if (isPartyAnnouncement.value) {
    const accountId = receiver.value?.account_id || sender.value?.account_id || 'SDC';
    return `${accountId} heeft een party aankondiging geplaatst`;
  }

  if (isGroupJoin.value) {
    const accountId = sender.value?.account_id || receiver.value?.account_id || 'Iemand';
    return `${accountId} is lid geworden van ${groupName.value || 'een groep'}`;
  }

  return `${receiver.value?.account_id || 'Iemand'} heeft ${
    groupName.value ? `in ${groupName.value}` : 'een bericht'
  } geplaatst`;
});

const cardClasses = computed(() => [
  'group relative overflow-hidden rounded-[10px] border border-white/6 border-l-[3px] border-l-violet-500/40 transition-all duration-200 hover:border-white/10 hover:border-l-violet-500/60 hover:bg-white/[0.05]',
  props.index !== undefined && props.index % 2 === 0 ? 'bg-white/[0.025]' : 'bg-white/[0.035]',
]);

const headerClasses = computed(() => [
  'border-b border-white/6 bg-white/[0.02] px-3.5 py-2.5',
  isPartyAnnouncement.value
    ? 'border-b-violet-500/20 bg-linear-to-br from-violet-500/10 to-violet-500/5'
    : '',
]);

const blogContainerClasses = computed(() => [
  'relative max-h-[500px] overflow-x-hidden overflow-y-auto rounded-lg border border-violet-500/15 bg-linear-to-br from-violet-500/8 to-violet-500/3 p-3.5',
  isPartyAnnouncement.value ? 'shadow-[inset_0_1px_0_rgba(196,181,253,0.08)]' : '',
]);

const blogTextClasses = computed(() => [
  'break-words text-[13px] leading-[1.7] text-gray-200',
  '[&_*]:box-border [&_*]:max-w-full',
  '[&_h1]:my-3 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:leading-[1.4] [&_h1]:tracking-[-0.01em] [&_h1]:text-white',
  '[&_h2]:my-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:leading-[1.4] [&_h2]:tracking-[-0.01em] [&_h2]:text-white',
  '[&_h3]:my-3 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:leading-[1.4] [&_h3]:tracking-[-0.01em] [&_h3]:text-white',
  '[&_p]:mb-2.5 [&_p]:leading-[1.7] [&_p]:text-gray-200 [&_p:last-child]:mb-0',
  '[&_a]:text-violet-300 [&_a]:underline [&_a]:decoration-violet-300/60 [&_a]:underline-offset-2 [&_a]:transition-colors [&_a:hover]:text-violet-200',
  '[&_img]:my-3 [&_img]:block [&_img]:h-auto [&_img]:w-auto [&_img]:max-h-[300px] [&_img]:rounded-lg [&_img]:object-contain [&_img]:shadow-[0_2px_8px_rgba(0,0,0,0.2)]',
  '[&_a_img]:transition-all [&_a_img]:duration-200 [&_a:hover_img]:scale-[1.02] [&_a:hover_img]:shadow-[0_4px_12px_rgba(139,92,246,0.3)]',
  '[&_.img-swiper]:block [&_.img-swiper]:h-auto [&_.img-swiper]:w-auto [&_.img-swiper]:max-h-[280px] [&_.img-swiper]:rounded-lg [&_.img-swiper]:object-contain [&_.img-swiper]:shadow-[0_2px_6px_rgba(0,0,0,0.15)]',
  '[&_.img-responsive]:block [&_.img-responsive]:h-auto [&_.img-responsive]:w-auto [&_.img-responsive]:max-h-[280px] [&_.img-responsive]:rounded-lg [&_.img-responsive]:object-contain [&_.img-responsive]:shadow-[0_2px_6px_rgba(0,0,0,0.15)]',
  '[&_.swiper-lazy]:block [&_.swiper-lazy]:h-auto [&_.swiper-lazy]:w-auto [&_.swiper-lazy]:max-h-[280px] [&_.swiper-lazy]:rounded-lg [&_.swiper-lazy]:object-contain [&_.swiper-lazy]:shadow-[0_2px_6px_rgba(0,0,0,0.15)]',
  '[&_.img-visible]:block [&_.img-visible]:h-auto [&_.img-visible]:w-auto [&_.img-visible]:max-h-[280px] [&_.img-visible]:rounded-lg [&_.img-visible]:object-contain [&_.img-visible]:shadow-[0_2px_6px_rgba(0,0,0,0.15)]',
  '[&_.ql-align-center]:text-center [&_.ql-align-center_img]:mx-auto [&_.ql-align-center_.img-swiper]:mx-auto [&_.ql-align-center_.img-responsive]:mx-auto [&_.ql-align-center_.swiper-lazy]:mx-auto [&_.ql-align-center_.img-visible]:mx-auto',
  isPartyAnnouncement.value
    ? '[&_img]:mx-auto [&_img]:my-2 [&_img]:max-w-[280px] [&_img]:max-h-[280px] [&_.img-swiper]:mx-auto [&_.img-swiper]:my-2 [&_.img-swiper]:max-w-[280px] [&_.img-responsive]:mx-auto [&_.img-responsive]:my-2 [&_.img-responsive]:max-w-[280px] [&_.swiper-lazy]:mx-auto [&_.swiper-lazy]:my-2 [&_.swiper-lazy]:max-w-[280px] [&_.img-visible]:mx-auto [&_.img-visible]:my-2 [&_.img-visible]:max-w-[280px]'
    : '',
]);
</script>

<template>
  <div :class="cardClasses">
    <div :class="headerClasses">
      <div class="flex items-center justify-between gap-3">
        <p
          :class="[
            'min-w-0 flex-1 text-sm font-semibold leading-[1.4] tracking-[-0.01em] text-white',
            isPartyAnnouncement ? 'text-violet-100' : '',
          ]"
        >
          {{ headerText }}
        </p>
        <p class="shrink-0 text-xs font-medium text-gray-500">{{ item.timed }}</p>
      </div>
    </div>

    <div class="grid gap-3 px-3.5 py-3 md:grid-cols-2">
      <div class="flex flex-col gap-2.5">
        <div class="flex items-start gap-2.5">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            :alt="receiver?.account_id"
            class="h-[60px] w-[60px] shrink-0 rounded-lg border-2 border-violet-500/60 object-cover shadow-[0_2px_4px_rgba(0,0,0,0.1)]"
          />
          <div
            v-else
            class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg border-2 border-violet-500/60 bg-linear-to-br from-violet-500/15 to-violet-500/5"
          >
            <span class="text-[20px] font-semibold text-violet-400">
              {{ receiver?.account_id?.charAt(0) || '?' }}
            </span>
          </div>

          <div class="flex-1">
            <div class="mb-1 flex items-center justify-between gap-2">
              <p class="min-w-0 truncate text-sm font-semibold leading-[1.4] tracking-[-0.01em] text-white">
                {{ receiver?.account_id }}
              </p>

              <div class="ml-1.5 flex items-center gap-1">
                <img
                  v-if="receiver?.is_web_user"
                  src="https://www.sdc.com/react/assets/web_user_icon.d5f27f46.svg"
                  alt="is-web-user"
                  title="Web-gebruiker"
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity duration-200 hover:opacity-100"
                />
                <img
                  v-if="receiver?.is_app_user"
                  src="https://www.sdc.com/react/assets/mobile_user_icon.07eafea0.svg"
                  alt="is-app-user"
                  title="App-gebruiker"
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity duration-200 hover:opacity-100"
                />
                <img
                  v-if="receiver?.speed"
                  src="https://www.sdc.com/react/assets/speed_white.3176d40b.svg"
                  alt="is-speed-date"
                  title="Speed Date"
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity duration-200 hover:opacity-100"
                />
                <img
                  v-if="receiver?.online === 1"
                  src="https://www.sdc.com/react/assets/messenger_online_icon.0a87dd19.svg"
                  alt="user-is-online"
                  title="Chat nu"
                  class="h-3.5 w-3.5 cursor-pointer opacity-80 transition-opacity duration-200 hover:opacity-100"
                />
              </div>
            </div>

            <div
              v-if="ages.first || (ages.second && isGender2Real)"
              class="mt-1 text-[11px]"
            >
              <span
                v-if="ages.first"
                :class="['font-semibold', getGenderColorClass(receiver?.gender1)]"
              >
                {{ ages.first }}
              </span>
              <span
                v-if="ages.first && ages.second && isGender2Real"
                class="mx-[3px] text-white/40"
              >
                |
              </span>
              <span
                v-if="ages.second && isGender2Real"
                :class="['font-semibold', getGenderColorClass(receiver?.gender2)]"
              >
                {{ ages.second }}
              </span>
            </div>

            <div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <div
                v-if="receiver?.photo_count"
                class="flex items-center gap-[3px] text-xs text-gray-400"
              >
                <img
                  src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg"
                  alt="Foto's"
                  class="h-3.5 w-3.5 opacity-80"
                />
                <span>{{ receiver.photo_count }}</span>
              </div>
              <div
                v-if="receiver?.video_count"
                class="flex items-center gap-[3px] text-xs text-gray-400"
              >
                <img
                  src="https://www.sdc.com/react/assets/videos_white_icon.67fc13b6.svg"
                  alt="Video's"
                  class="h-3.5 w-3.5 opacity-80"
                />
                <span>{{ receiver.video_count }}</span>
              </div>
              <div
                v-if="receiver?.valid_count"
                class="flex items-center gap-[3px] text-xs text-gray-400"
              >
                <img
                  src="https://www.sdc.com/react/assets/validate_grid_card.d90f25d9.svg"
                  alt="Validaties"
                  class="h-3.5 w-3.5 opacity-80"
                />
                <span>{{ receiver.valid_count }}</span>
              </div>
              <div
                v-if="receiver?.likes_count"
                class="flex items-center gap-[3px] text-xs text-gray-400"
              >
                <img
                  src="https://www.sdc.com/react/assets/like_grid_card.c46847a1.svg"
                  alt="Likes"
                  class="h-3.5 w-3.5 opacity-80"
                />
                <span>{{ receiver.likes_count }}</span>
              </div>
            </div>

            <div v-if="receiverInterestsIcons.length > 0" class="mt-1.5">
              <p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-500">
                Interesses
              </p>
              <div class="flex items-center gap-[5px]">
                <template v-for="(interestItem, index) in receiverInterestsIcons" :key="index">
                  <div v-if="interestItem.type === 'couple-group'" class="flex items-center">
                    <Icon
                      v-for="(icon, iconIndex) in interestItem.icons"
                      :key="iconIndex"
                      :icon="icon.icon"
                      width="16"
                      height="16"
                      :class="[icon.colorClass, iconIndex === 1 ? '-ml-1.5' : '']"
                    />
                  </div>
                  <Icon
                    v-else-if="
                      interestItem.type === 'single-female' || interestItem.type === 'single-male'
                    "
                    :icon="interestItem.icon"
                    width="16"
                    height="16"
                    :class="interestItem.colorClass"
                  />
                </template>
              </div>
            </div>

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

      <div class="flex flex-col gap-2.5">
        <div
          v-if="isGroupJoin"
          class="relative min-h-[200px] rounded-lg border border-violet-500/15 bg-linear-to-br from-violet-500/8 to-violet-500/3 p-3"
        >
          <div class="mb-3 flex gap-3">
            <img
              v-if="groupImageUrl"
              :src="groupImageUrl"
              :alt="groupName"
              class="h-[60px] w-[60px] shrink-0 rounded-md border-2 border-violet-500/30 object-cover"
            />
            <div
              v-else
              class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-md border-2 border-violet-500/30 bg-linear-to-br from-violet-500/20 to-violet-500/10"
            >
              <span class="text-2xl font-semibold text-violet-400">
                {{ groupName?.charAt(0) || 'G' }}
              </span>
            </div>

            <div class="min-w-0 flex-1 pr-8">
              <p
                v-if="groupCategory"
                class="mb-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-500"
              >
                {{ groupCategory }}
              </p>
              <p class="mb-1.5 text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-white">
                {{ groupName }}
              </p>
              <div
                v-if="groupLocation"
                class="mb-1 flex items-center gap-1 text-[10px] text-gray-400"
              >
                <img
                  src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg"
                  alt="location"
                  class="h-3 w-3 opacity-70"
                />
                <span>{{ groupLocation }}</span>
              </div>
              <p v-if="groupAdmin" class="text-[10px] text-gray-400">
                door <span class="font-medium text-gray-300">{{ groupAdmin }}</span>
              </p>
            </div>
          </div>

          <div v-if="groupDescription" class="mt-3 border-t border-white/10 pt-3">
            <p
              class="overflow-hidden text-[11px] leading-[1.6] text-gray-300 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]"
            >
              {{ groupDescription }}
            </p>
          </div>

          <div class="mt-3 border-t border-white/10 pt-3">
            <div class="flex items-center gap-1 text-[10px] text-gray-400">
              <span v-if="groupCreatedDate">{{ groupCreatedDate }}</span>
              <span v-if="groupCreatedDate && groupMemberCount > 0" class="text-gray-500">|</span>
              <span v-if="groupMemberCount > 0">{{ groupMemberCount }} Leden</span>
            </div>
          </div>

          <div
            class="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-[5px] border border-violet-500/20 bg-violet-500/10"
          >
            <img
              src="https://www.sdc.com/react/assets/groups_blue_icon.56f59a0b.svg"
              alt="group"
              class="h-3.5 w-3.5 opacity-70"
            />
          </div>
        </div>

        <div v-else :class="blogContainerClasses">
          <div
            v-if="isPartyAnnouncement || isBlogPost"
            class="mb-3 inline-flex items-center rounded-md border border-violet-500/25 bg-violet-500/15 px-3 py-1.5"
          >
            <span class="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.05em] text-violet-400">
              <span v-if="isPartyAnnouncement">🎉 Party Aankondiging</span>
              <span v-else-if="isBlogPost">📝 Blog</span>
            </span>
          </div>

          <div
            v-if="groupName && isBlogPost"
            class="mb-3 flex items-center gap-2 border-b border-violet-500/20 pb-3"
          >
            <span class="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-500">
              Groep:
            </span>
            <span class="text-xs font-semibold tracking-[-0.01em] text-violet-400">
              {{ groupName }}
            </span>
          </div>

          <div :class="blogTextClasses" v-html="blogContent"></div>
        </div>
      </div>
    </div>
  </div>
</template>
