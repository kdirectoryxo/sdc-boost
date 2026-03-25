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
  <article class="wcard" @click="open">
    <div class="wcard-poster">
      <img
        v-if="item.flyer"
        :src="item.flyer"
        :alt="item.title"
      />
      <div v-else class="wcard-poster-empty">
        <Icon icon="mdi:presentation-play" width="28" height="28" />
      </div>

      <!-- Live pill -->
      <span v-if="item.live" class="wcard-live-pill">
        <span class="wcard-live-dot" />
        LIVE
      </span>
    </div>

    <div class="wcard-body">
      <p class="wcard-title">{{ item.title }}</p>

      <p v-if="item.account_id" class="wcard-host">
        {{ item.account_id }}
      </p>

      <div class="wcard-meta">
        <span v-if="whenLabel" class="wcard-meta-item">
          <Icon icon="mdi:calendar-clock-outline" width="11" height="11" />
          {{ whenLabel }}
        </span>
        <span v-if="peopleCount != null" class="wcard-meta-item">
          <Icon icon="mdi:account-group-outline" width="11" height="11" />
          {{ peopleCount }}
        </span>
      </div>

      <p v-if="categoryLine" class="wcard-category">
        {{ categoryLine }}
      </p>

      <div v-if="audienceIcons.length" class="wcard-audience">
        <template v-for="(a, index) in audienceIcons" :key="index">
          <div v-if="a.type === 'couple-group'" class="wcard-couple">
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
  </article>
</template>

<style scoped>
.wcard {
  background: #1a1d21;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
}

.wcard:hover {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

/* Poster */
.wcard-poster {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #131517;
  overflow: hidden;
}

.wcard-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.wcard:hover .wcard-poster img {
  transform: scale(1.05);
}

.wcard-poster-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.15);
}

.wcard-live-pill {
  position: absolute;
  top: 6px;
  left: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px 2px 5px;
  background: rgba(239, 68, 68, 0.85);
  backdrop-filter: blur(6px);
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: white;
}

.wcard-live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: white;
  animation: live-blink 1.4s ease-in-out infinite;
}

@keyframes live-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

/* Body */
.wcard-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.wcard-title {
  font-size: 12px;
  font-weight: 600;
  color: white;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.wcard-host {
  font-size: 11px;
  font-weight: 500;
  color: #a78bfa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wcard-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.wcard-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #6b7280;
}

.wcard:hover .wcard-meta-item {
  color: #9ca3af;
}

.wcard-category {
  font-size: 10px;
  color: #6b7280;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.wcard-audience {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.wcard-couple {
  display: flex;
  align-items: center;
}
</style>
