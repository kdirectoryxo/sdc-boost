<script setup lang="ts">
import { onMounted, ref } from 'vue';

import {
  extractFixedChatrooms,
  getChatroomList,
} from '@/lib/sdc-api/live-chatroom';
import type { ChatroomListFixedRoom, ChatroomListPersonalItem } from '@/lib/sdc-api-types';
import {
  CHATROOM_PERSONAL_IMAGE_URL,
  getOfficialChatroomCardImageUrl,
} from '@/lib/chatroom-card-assets';
import '@/components/hub/hub-skeleton.css';
import { Button } from '@/lib/view-router/ui/button';

const fixedRooms = ref<ChatroomListFixedRoom[]>([]);
const personalRooms = ref<ChatroomListPersonalItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function loadChatrooms() {
  loading.value = true;
  error.value = null;
  try {
    const res = await getChatroomList(0);
    fixedRooms.value = extractFixedChatrooms(res.info);
    personalRooms.value = res.info.personal_list ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load chatrooms';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadChatrooms();
});

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <div class="hub-chatrooms flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0c0d10]">
    <div class="h-full overflow-y-auto px-4 py-4">
      <div v-if="error" class="flex flex-col items-center gap-2 py-12 text-center">
        <p class="text-sm text-red-400">{{ error }}</p>
        <Button variant="outline" size="sm" @click="loadChatrooms">Retry</Button>
      </div>
      <div
        v-else-if="loading"
        class="chatroom-page-grid"
        aria-busy="true"
        aria-label="Loading chatrooms"
      >
        <div v-for="n in 12" :key="n" class="hub-skeleton-chatroom-card">
          <div class="mx-auto mb-2 h-4 w-[85%] rounded hub-skeleton-shimmer hub-skeleton-rounded" />
          <div class="mx-auto mb-3 h-3 w-20 rounded hub-skeleton-shimmer hub-skeleton-rounded" />
          <div
            class="mx-auto mb-2 flex max-h-[130px] w-[70%] items-center justify-center rounded-md hub-skeleton-shimmer"
            style="min-height: 100px"
          />
          <div class="mt-auto h-10 w-full rounded-md hub-skeleton-shimmer hub-skeleton-rounded-lg" />
        </div>
      </div>
      <div v-else class="chatroom-page-grid">
        <!-- Official rooms — same imagery as sdc.com/react -->
        <article
          v-for="room in fixedRooms"
          :key="room.id"
          class="chatroom-card chatroom-card--official flex flex-col overflow-hidden rounded-lg border border-white/[0.07] bg-[#16181c] shadow-sm"
        >
          <div class="chatroom-card__inner flex flex-1 flex-col bg-[#16181c] px-2 pb-2 pt-3">
            <p class="chatroom-title line-clamp-2 min-h-[2.5rem] text-center text-sm font-medium leading-tight text-white">
              {{ room.chat_name }}
            </p>
            <p class="chatroom-counter mt-1 text-center text-xs text-white/50">
              {{ room.total }} Leden
            </p>
            <div class="mt-2 flex flex-1 items-center justify-center py-1">
              <img
                :src="getOfficialChatroomCardImageUrl(room.id)"
                :alt="room.chat_name"
                class="chatroom-illus-official max-h-[130px] w-[70%] object-contain"
              />
            </div>
            <button
              type="button"
              class="btn-entree mt-2 w-full rounded-md border border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.05] py-2.5 text-center text-sm font-medium text-white/95 transition hover:from-white/[0.16] hover:to-white/[0.08]"
              @click="openExternal(room.url)"
            >
              Entree
            </button>
          </div>
        </article>

        <!-- Member rooms -->
        <article
          v-for="room in personalRooms"
          :key="room.chatroom_id"
          class="chatroom-card chatroom-card--personal flex flex-col overflow-hidden rounded-lg border border-white/[0.07] bg-[#16181c] shadow-sm"
        >
          <div class="chatroom-card__inner flex flex-1 flex-col bg-[#16181c] px-2 pb-2 pt-3">
            <p class="chatroom-title line-clamp-2 min-h-[2.5rem] text-center text-sm font-medium leading-tight text-white">
              {{ room.chat_name }}
            </p>
            <p class="chatroom-counter mt-1 text-center text-xs text-white/50">{{ room.total }} Leden</p>
            <p class="chatroom-counter mt-0.5 text-center text-xs text-white/40">{{ room.type_text }}</p>
            <p class="mt-1 text-center text-xs font-medium text-fuchsia-300/90">
              {{ room.account_id }}
            </p>
            <div class="mt-2 flex flex-1 items-center justify-center py-1">
              <img
                :src="CHATROOM_PERSONAL_IMAGE_URL"
                :alt="room.chat_name"
                class="h-[110px] w-[110px] object-contain"
              />
            </div>
            <button
              type="button"
              class="btn-entree btn-entree--personal mt-2 w-full rounded-md border border-fuchsia-500/25 bg-gradient-to-b from-fuchsia-600/35 to-fuchsia-900/25 py-2.5 text-center text-sm font-medium text-white transition hover:from-fuchsia-500/45 hover:to-fuchsia-900/35"
              @click="openExternal(room.url)"
            >
              Entree
            </button>
          </div>
        </article>
      </div>

      <p
        v-if="!loading && !error && !fixedRooms.length && !personalRooms.length"
        class="py-12 text-center text-sm text-white/45"
      >
        No chatrooms available.
      </p>
    </div>
  </div>
</template>

<style scoped>
.chatroom-page-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (min-width: 640px) {
  .chatroom-page-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
}

@media (min-width: 1024px) {
  .chatroom-page-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .chatroom-page-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
</style>
