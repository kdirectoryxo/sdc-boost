<script lang="ts" setup>
import { ref, watch } from 'vue';
import { Search, X, ChevronRight } from 'lucide-vue-next';
import { searchGlobalV2 } from '@/lib/sdc-api';
import type { SearchGlobalV2Result } from '@/lib/sdc-api-types';
import { useDebounceFn } from '@vueuse/core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/lib/view-router/ui/dialog';
import { Button } from '@/lib/view-router/ui/button';
import { Input } from '@/lib/view-router/ui/input';
import { ScrollArea } from '@/lib/view-router/ui/scroll-area';
import { Spinner } from '@/lib/view-router/ui/spinner';
import { Avatar, AvatarImage, AvatarFallback } from '@/lib/view-router/ui/avatar';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/lib/view-router/ui/empty';
import { cn } from '@/lib/utils';
import {
  CHAT_NESTED_DIALOG_OVERLAY_CLASS,
  CHAT_NESTED_DIALOG_CONTENT_CLASS,
} from '@/lib/chat-ui/nested-dialog-classes';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  'start-chat': [dbId: number];
}>();

const searchQuery = ref('');
const searchResults = ref<SearchGlobalV2Result[]>([]);
const isSearching = ref(false);
const isStartingChat = ref(false);
const error = ref<string | null>(null);

const performSearch = useDebounceFn(async (query: string) => {
  if (!query.trim()) {
    searchResults.value = [];
    isSearching.value = false;
    return;
  }

  error.value = null;

  try {
    const response = await searchGlobalV2(query.trim(), 'PN', 0);

    let results: SearchGlobalV2Result[] = [];

    if (response.info.list && Array.isArray(response.info.list)) {
      results = response.info.list;
    } else if (response.info.data?.PN?.results) {
      results = response.info.data.PN.results;
    }

    searchResults.value = results;
  } catch (err) {
    console.error('[NewChatSearchDialog] Search failed:', err);
    error.value = err instanceof Error ? err.message : 'Failed to search users';
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}, 300);

watch(searchQuery, (newQuery) => {
  if (newQuery.trim()) {
    isSearching.value = true;
    error.value = null;
  } else {
    searchResults.value = [];
    isSearching.value = false;
    error.value = null;
  }
  performSearch(newQuery);
});

watch(
  () => props.visible,
  (newValue) => {
    if (!newValue) {
      searchQuery.value = '';
      searchResults.value = [];
      error.value = null;
    }
  },
  { immediate: true },
);

function handleClose() {
  emit('close');
}

function onOpenChange(open: boolean) {
  if (!open) {
    handleClose();
  }
}

async function handleSelectUser(user: SearchGlobalV2Result) {
  isStartingChat.value = true;
  error.value = null;

  try {
    emit('start-chat', user.db_id);
    handleClose();
  } catch (err) {
    console.error('[NewChatSearchDialog] Failed to start chat:', err);
    error.value = err instanceof Error ? err.message : 'Failed to start chat';
  } finally {
    isStartingChat.value = false;
  }
}

function getPhotoUrl(photo: string): string {
  if (!photo) return '';
  if (photo.startsWith('http')) return photo;
  return `https://pictures.sdc.com/photos/${photo}`;
}

function formatAge(age: string): string {
  if (!age) return '';
  const parts = age.split('|');
  return parts[0] || age;
}
</script>

<template>
  <Dialog :open="visible" @update:open="onOpenChange">
    <DialogContent
      :show-close-button="false"
      :overlay-class="CHAT_NESTED_DIALOG_OVERLAY_CLASS"
      :class="
        cn(
          CHAT_NESTED_DIALOG_CONTENT_CLASS,
          '!flex h-[min(80vh,600px)] !max-h-[600px] !w-[90vw] !max-w-md flex-col overflow-hidden rounded-lg border border-white/[0.06] bg-background p-0 shadow-2xl',
        )
      "
    >
      <DialogHeader class="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-white/[0.06] px-6 py-4 text-left">
        <DialogTitle class="text-xl font-semibold text-white">New Chat</DialogTitle>
        <Button variant="ghost" size="icon" title="Close" @click="handleClose">
          <X class="size-5 text-muted-foreground" />
        </Button>
      </DialogHeader>

      <div class="shrink-0 border-b border-white/[0.06] px-6 py-4">
        <div
          class="relative flex items-center gap-2 rounded-lg border border-white/[0.06] bg-sidebar px-4 py-2 transition-colors focus-within:border-blue-500"
        >
          <Search class="size-4 shrink-0 text-white/40" />
          <Input
            v-model="searchQuery"
            type="text"
            placeholder="Search by username..."
            class="border-0 bg-transparent px-0 text-white shadow-none placeholder:text-white/40 focus-visible:ring-0"
            autofocus
          />
          <Button
            v-if="searchQuery.trim()"
            variant="ghost"
            size="icon-sm"
            class="shrink-0"
            title="Clear search"
            @click="searchQuery = ''"
          >
            <X class="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <ScrollArea class="min-h-0 flex-1">
        <div class="relative min-h-[200px]">
          <div v-if="isSearching" class="flex min-h-[200px] flex-col items-center justify-center gap-4 py-12">
            <Spinner class="!size-10 text-blue-500" />
            <p class="text-sm text-muted-foreground">Searching...</p>
          </div>

          <div v-else-if="error" class="flex min-h-[200px] flex-col items-center justify-center px-6 py-12 text-center">
            <p class="mb-2 text-red-500">{{ error }}</p>
            <Button variant="link" class="text-blue-500" @click="error = null; performSearch(searchQuery)">
              Try again
            </Button>
          </div>

          <Empty v-else-if="!searchQuery.trim()" class="min-h-[200px] border-0">
            <EmptyHeader>
              <EmptyTitle>Type a username</EmptyTitle>
              <EmptyDescription>Search for people to start a new chat.</EmptyDescription>
            </EmptyHeader>
          </Empty>

          <Empty v-else-if="searchResults.length === 0" class="min-h-[200px] border-0">
            <EmptyHeader>
              <EmptyTitle>No users found</EmptyTitle>
              <EmptyDescription>Try a different search term.</EmptyDescription>
            </EmptyHeader>
          </Empty>

          <div v-else class="divide-y divide-white/[0.06]">
            <button
              v-for="user in searchResults"
              :key="user.db_id"
              type="button"
              :disabled="isStartingChat"
              class="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              @click="handleSelectUser(user)"
            >
              <div class="relative shrink-0">
                <Avatar class="size-12">
                  <AvatarImage :src="getPhotoUrl(user.primary_photo)" :alt="user.account_id" />
                  <AvatarFallback class="bg-muted text-xs text-white">
                    {{ user.account_id.slice(0, 2).toUpperCase() }}
                  </AvatarFallback>
                </Avatar>
                <div
                  v-if="user.online === 1"
                  class="absolute right-0 bottom-0 size-3 rounded-full border-2 border-background bg-green-500"
                />
              </div>

              <div class="min-w-0 flex-1">
                <div class="mb-1 flex items-center gap-2">
                  <span class="truncate font-medium text-white">{{ user.account_id }}</span>
                  <span
                    v-if="user.lifetime_status"
                    class="text-xs text-yellow-400"
                    title="Lifetime Member"
                    >⭐</span
                  >
                </div>
                <div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span v-if="formatAge(user.age)">{{ formatAge(user.age) }} jaar</span>
                  <span v-if="user.location">{{ user.location }}</span>
                </div>
              </div>

              <ChevronRight class="size-4 shrink-0 text-white/40" />
            </button>
          </div>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
