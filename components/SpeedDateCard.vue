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
    class="sd-card"
    @click="handleClick"
  >
    <div class="sd-card-photo">
      <img
        :key="`${item.db_id}-${imageError}`"
        :src="displayImageUrl"
        :alt="item.account_id"
        @error="handleImageError"
      />
      <div v-if="item.online === 1" class="sd-card-online" />
      <div class="sd-card-badges">
        <div v-if="hasLifetimeStatus" class="sd-badge sd-badge-lifetime" title="Lifetime">
          <Icon icon="mdi:star" width="12" height="12" />
        </div>
        <div class="sd-badge sd-badge-speed" title="Speed Date">
          <Icon icon="mdi:lightning-bolt" width="12" height="12" />
        </div>
      </div>
      <div class="sd-type-pill">{{ typeLabel }}</div>
      <div v-if="item.is_app_user || item.is_web_user" class="sd-card-device">
        <Icon v-if="item.is_app_user" icon="mdi:cellphone" width="12" height="12" />
        <Icon v-if="item.is_web_user" icon="mdi:monitor" width="12" height="12" />
      </div>
    </div>

    <div class="sd-card-info" :style="{ borderTop: `3px solid ${profileTypeColor}` }">
      <div class="sd-card-row">
        <span class="sd-card-name">{{ item.account_id }}</span>
        <div v-if="lookingForIcons.length > 0" class="sd-card-looking-for">
          <template v-for="(lf, index) in lookingForIcons" :key="index">
            <div v-if="lf.type === 'couple-group'" class="sd-looking-couple">
              <Icon
                v-for="(ic, i) in lf.icons"
                :key="i"
                :icon="ic.icon"
                width="12"
                height="12"
                :style="{ color: ic.color, marginLeft: i === 1 ? '-8px' : '0' }"
              />
            </div>
            <Icon
              v-else
              :icon="lf.icon"
              width="12"
              height="12"
              :style="{ color: lf.color }"
            />
          </template>
        </div>
      </div>

      <div class="sd-card-row">
        <div class="sd-card-ages">
          <span v-if="ages.first" :style="{ color: getAgeColor(item.gender1) }">{{ ages.first }}</span>
          <span
            v-if="ages.first && ages.second && isGender2Real"
            class="sd-age-sep"
            >|</span
          >
          <span
            v-if="ages.second && isGender2Real"
            :style="{ color: getAgeColor(item.gender2) }"
            >{{ ages.second }}</span
          >
        </div>
        <span v-if="distanceText" class="sd-card-distance">{{ distanceText }}</span>
      </div>

      <div v-if="item.date_list" class="sd-date-line">{{ item.date_list }}</div>

      <div v-if="locationBlock.primary || locationBlock.secondary" class="sd-card-location">
        <Icon icon="mdi:map-marker-outline" width="10" height="10" class="sd-loc-icon" />
        <div class="sd-loc-text">
          <span>{{ locationBlock.primary }}</span>
          <span v-if="locationBlock.secondary" class="sd-loc-secondary">{{ locationBlock.secondary }}</span>
        </div>
      </div>

      <div v-if="messagePreview" class="sd-message">
        {{ messagePreview }}
      </div>

      <div
        v-if="item.photo_count || item.likes_count || item.valid_count"
        class="sd-card-stats"
      >
        <span v-if="item.photo_count" class="sd-stat">
          <Icon icon="mdi:image-outline" width="11" height="11" />
          {{ item.photo_count }}
        </span>
        <span v-if="item.likes_count" class="sd-stat">
          <Icon icon="mdi:heart-outline" width="11" height="11" />
          {{ item.likes_count }}
        </span>
        <span v-if="item.valid_count" class="sd-stat">
          <Icon icon="mdi:check-circle-outline" width="11" height="11" />
          {{ item.valid_count }}
        </span>
      </div>
    </div>
  </component>
</template>

<style scoped>
.sd-card {
  background: #1a1d21;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

a.sd-card {
  display: block;
  text-decoration: none;
  color: inherit;
  outline: none;
}

.sd-card:hover {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.sd-card-photo {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: #131517;
  overflow: hidden;
}

.sd-card-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.sd-card:hover .sd-card-photo img {
  transform: scale(1.05);
}

.sd-card-online {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 10px;
  height: 10px;
  background: #22c55e;
  border-radius: 50%;
  border: 2px solid #1a1d21;
}

.sd-card-badges {
  position: absolute;
  top: 6px;
  left: 6px;
  display: flex;
  gap: 4px;
}

.sd-badge {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  backdrop-filter: blur(8px);
}

.sd-badge-lifetime {
  background: rgba(234, 179, 8, 0.85);
}

.sd-badge-speed {
  background: rgba(139, 92, 246, 0.85);
}

.sd-type-pill {
  position: absolute;
  bottom: 6px;
  left: 6px;
  max-width: calc(100% - 12px);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 9px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  line-height: 1.2;
}

.sd-card-device {
  position: absolute;
  bottom: 6px;
  right: 6px;
  display: flex;
  gap: 3px;
  padding: 3px 5px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 4px;
}

.sd-card-info {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sd-card-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.sd-card-name {
  font-size: 12px;
  font-weight: 600;
  color: white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.sd-card-looking-for {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  flex-shrink: 0;
}

.sd-looking-couple {
  display: flex;
  align-items: center;
}

.sd-card-ages {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  font-weight: 600;
}

.sd-age-sep {
  color: rgba(255, 255, 255, 0.2);
  font-size: 11px;
}

.sd-card-distance {
  font-size: 9px;
  font-weight: 500;
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
}

.sd-date-line {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
}

.sd-card-location {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 10px;
  color: #6b7280;
}

.sd-loc-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: #4b5563;
}

.sd-loc-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sd-loc-text span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sd-loc-secondary {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.4);
  white-space: normal;
  line-height: 1.3;
}

.sd-message {
  font-size: 10px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.78);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sd-card-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.sd-stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #6b7280;
}
</style>
