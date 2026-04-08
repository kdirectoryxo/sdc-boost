<script lang="ts" setup>
import { computed, ref, watch, nextTick } from 'vue';
import ChatListItem from '@/components/ChatListItem.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/lib/view-router/ui/dropdown-menu';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { getChatKey } from '@/lib/composables/chat/utils';
import { getAllTags } from '@/lib/sdc-db/tags';
import { useSDCDatabaseStore } from '@/lib/sdc-db/store';
import { tagChangeTrigger } from '@/lib/sdc-db/tag-change-trigger';

interface Props {
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  filteredChats: MessengerChatItem[];
  selectedChat: MessengerChatItem | null;
  typingStates: Map<string, boolean>;
  filterUnread: boolean;
  filterPinned: boolean;
  filterOnline: boolean;
  filterLastMessageByMe: boolean;
  filterLastMessageByOther: boolean;
  filterOnlyMyMessages: boolean;
  filterBlocked: boolean;
  filterCouples: boolean;
  filterFemales: boolean;
  isFilterDropdownOpen: boolean;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  sortByOnline: 'asc' | 'desc' | null;
  sortByDistance: 'asc' | 'desc' | null;
  disablePinnedSort: boolean;
  isSortDropdownOpen: boolean;
  hasActiveSort: boolean;
  selectedTagIds: Set<number>;
  getFolderName: (folderId: number | undefined | null) => string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:searchQuery': [value: string];
  'update:filterUnread': [value: boolean];
  'update:filterPinned': [value: boolean];
  'update:filterOnline': [value: boolean];
  'update:filterLastMessageByMe': [value: boolean];
  'update:filterLastMessageByOther': [value: boolean];
  'update:filterOnlyMyMessages': [value: boolean];
  'update:filterBlocked': [value: boolean];
  'update:filterCouples': [value: boolean];
  'update:filterFemales': [value: boolean];
  'update:isFilterDropdownOpen': [value: boolean];
  'update:isSortDropdownOpen': [value: boolean];
  'toggle-sort-online': [];
  'toggle-sort-distance': [];
  'toggle-disable-pinned-sort': [];
  'toggle-tag-filter': [tagId: number];
  'chat-click': [chat: MessengerChatItem];
  'chat-open-tags': [chat: MessengerChatItem];
  'chat-open-folder-dialog': [chat: MessengerChatItem];
  'clear-filters': [];
  'clear-sort': [];
  'clear-search': [];
  'new-chat': [];
}>();

const { isReady: dbIsReady } = useSDCDatabaseStore();

const allTags = computed(() => {
  // Access tagChangeTrigger to make this computed reactive to tag changes
  const _trigger = tagChangeTrigger.value;
  
  if (!dbIsReady.value) return [];
  try {
    return getAllTags();
  } catch {
    return [];
  }
});

function handleClearFilters() {
  emit('clear-filters');
  emit('update:isFilterDropdownOpen', false);
}

function handleClearSort(e: Event) {
  e.stopPropagation();
  emit('clear-sort');
  emit('update:isSortDropdownOpen', false);
}

/**
 * Keeps the chat list scroll position when selecting a chat.
 * List reorders (e.g. after marking read) break the old "same first/last key" heuristic.
 * We capture scroll on pointerdown (before click handlers / DB updates) and restore after
 * selectedChat actually changes to a different conversation (ignore same-key object refresh).
 */
const chatListScrollEl = ref<HTMLElement | null>(null);
let pendingListScrollSnapshot: number | null = null;

function onChatListPointerDownCapture(e: PointerEvent) {
  if (e.button !== 0) return;
  const el = chatListScrollEl.value;
  if (!el?.contains(e.target as Node)) return;
  pendingListScrollSnapshot = el.scrollTop;
}

function applyListScrollTop(top: number): void {
  const el = chatListScrollEl.value;
  if (!el) return;
  el.scrollTop = top;
}

watch(
  () => props.selectedChat,
  async (newChat, oldChat) => {
    if (pendingListScrollSnapshot === null) return;

    if (!newChat) {
      pendingListScrollSnapshot = null;
      return;
    }

    // Same conversation, new object (e.g. chatList sync) — keep snapshot for the next update.
    if (oldChat && getChatKey(newChat) === getChatKey(oldChat)) {
      return;
    }

    const top = pendingListScrollSnapshot;
    pendingListScrollSnapshot = null;

    await nextTick();
    // Layout + focus in the message pane can run late; re-apply a few times.
    applyListScrollTop(top);
    requestAnimationFrame(() => {
      applyListScrollTop(top);
      requestAnimationFrame(() => {
        applyListScrollTop(top);
        setTimeout(() => applyListScrollTop(top), 0);
        setTimeout(() => applyListScrollTop(top), 50);
        setTimeout(() => applyListScrollTop(top), 150);
      });
    });
  },
  { flush: 'post' }
);
</script>

<template>
  <div class="w-[35%] border-r border-white/[0.06] flex flex-col bg-background">
    <!-- Search Bar and Filter -->
    <div class="p-3 border-b border-white/[0.06] shrink-0 relative z-10">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative flex items-center gap-1 bg-sidebar border border-white/[0.06] rounded-lg px-3 py-1.5 focus-within:border-blue-500 transition-colors min-w-0 flex-1 basis-[120px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white/40 shrink-0">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            :value="searchQuery"
            @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="Search..."
            class="flex-1 bg-transparent text-white text-sm placeholder-white/40 focus:outline-none min-w-0"
          />
          <button
            v-if="searchQuery.trim()"
            @click="emit('clear-search')"
            class="p-0.5 hover:bg-secondary rounded transition-colors shrink-0"
            title="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground hover:text-white">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <!-- Action Buttons -->
        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Plus Button - New Chat -->
          <button
            @click="emit('new-chat')" 
            class="p-1.5 rounded-md border bg-background border-white/[0.06] text-muted-foreground hover:border-white/[0.10] hover:text-white transition-colors"
            title="New chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <!-- Sort Button -->
          <DropdownMenu
            :open="isSortDropdownOpen"
            @update:open="emit('update:isSortDropdownOpen', $event)"
          >
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                @click.stop
                :class="[
                  'p-1.5 rounded-md border transition-colors relative outline-none',
                  hasActiveSort
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                    : 'bg-background border-white/[0.06] text-muted-foreground hover:border-white/[0.10] hover:text-white'
                ]"
                title="Sort chats"
              >
                <!-- Sort icon -->
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M7 12h10"></path>
                  <path d="M10 18h4"></path>
                </svg>
                <!-- Clear icon (top-right) -->
                <button
                  v-if="hasActiveSort"
                  @click.stop="handleClearSort"
                  class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center z-20 transition-colors"
                  title="Clear sort"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              :side-offset="8"
              class="w-56 max-h-[350px] border border-white/[0.06] bg-background p-0 shadow-lg z-[100]"
            >
            <div class="flex flex-col max-h-[350px]">
              <!-- Header with clear button -->
              <div class="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-sidebar sticky top-0 z-10">
                <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sort</span>
                <button
                  v-if="hasActiveSort"
                  @click="handleClearSort"
                  class="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              </div>
              
              <!-- Scrollable content -->
              <div class="overflow-y-auto flex-1 py-1">
                <!-- Sort by Online -->
                <div class="px-3 py-1.5 text-[10px] font-medium text-white/40 uppercase tracking-wider">Online Status</div>
                <div class="px-1">
                  <button
                    @click="emit('toggle-sort-online')"
                    :class="[
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                      sortByOnline !== null ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                    ]"
                  >
                    <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', sortByOnline !== null ? 'bg-blue-500' : 'bg-white/[0.06]']">
                      <svg v-if="sortByOnline !== null" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div class="flex items-center gap-2 flex-1">
                      <svg v-if="sortByOnline === 'asc'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                        <path d="M3 6h18"></path>
                        <path d="M7 12h10"></path>
                        <path d="M10 18h4"></path>
                      </svg>
                      <svg v-else-if="sortByOnline === 'desc'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                        <path d="M3 18h18"></path>
                        <path d="M7 12h10"></path>
                        <path d="M10 6h4"></path>
                      </svg>
                      <div class="w-3.5 h-3.5 rounded-full bg-green-500 opacity-60" v-else></div>
                      <span class="text-sm">
                        {{ sortByOnline === 'asc' ? 'Online first' : sortByOnline === 'desc' ? 'Offline first' : 'Online status' }}
                      </span>
                    </div>
                  </button>
                </div>
                
                <!-- Sort by Distance -->
                <div class="mt-1 pt-1 border-t border-white/[0.06]">
                  <div class="px-3 py-1.5 text-[10px] font-medium text-white/40 uppercase tracking-wider">Distance</div>
                  <div class="px-1">
                    <button
                      @click="emit('toggle-sort-distance')"
                      :class="[
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                        sortByDistance !== null ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                      ]"
                    >
                      <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', sortByDistance !== null ? 'bg-blue-500' : 'bg-white/[0.06]']">
                        <svg v-if="sortByDistance !== null" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <div class="flex items-center gap-2 flex-1">
                        <svg v-if="sortByDistance === 'asc'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                          <path d="M3 6h18"></path>
                          <path d="M7 12h10"></path>
                          <path d="M10 18h4"></path>
                        </svg>
                        <svg v-else-if="sortByDistance === 'desc'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                          <path d="M3 18h18"></path>
                          <path d="M7 12h10"></path>
                          <path d="M10 6h4"></path>
                        </svg>
                        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span class="text-sm">
                          {{ sortByDistance === 'asc' ? 'Closest first' : sortByDistance === 'desc' ? 'Farthest first' : 'Distance' }}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
                
                <!-- Pinned Sort Options -->
                <div class="mt-1 pt-1 border-t border-white/[0.06]">
                  <div class="px-3 py-1.5 text-[10px] font-medium text-white/40 uppercase tracking-wider">Options</div>
                  <div class="px-1">
                    <button
                      @click="emit('toggle-disable-pinned-sort')"
                      :class="[
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                        disablePinnedSort ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                      ]"
                    >
                      <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', disablePinnedSort ? 'bg-blue-500' : 'bg-white/[0.06]']">
                        <svg v-if="disablePinnedSort" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <div class="flex items-center gap-2 flex-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                          <path d="M12 17v5"></path>
                          <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path>
                        </svg>
                        <span class="text-sm">Ignore pinned order</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <!-- Filter Button -->
          <DropdownMenu
            :open="isFilterDropdownOpen"
            @update:open="emit('update:isFilterDropdownOpen', $event)"
          >
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                @click.stop
                :class="[
                  'p-1.5 rounded-md border transition-colors relative outline-none',
                  hasActiveFilters
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                    : 'bg-background border-white/[0.06] text-muted-foreground hover:border-white/[0.10] hover:text-white'
                ]"
                title="Filter chats"
              >
                <!-- Filter icon -->
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
                <!-- Active filter badge (top-left) -->
                <span
                  v-if="activeFilterCount > 0"
                  class="absolute -top-1.5 -left-1.5 min-w-[16px] h-[16px] px-0.5 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center z-20"
                >
                  {{ activeFilterCount }}
                </span>
                <!-- Clear icon (top-right) -->
                <button
                  v-if="hasActiveFilters"
                  @click.stop="handleClearFilters"
                  class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center z-20 transition-colors"
                  title="Clear filters"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              :side-offset="8"
              class="w-64 max-h-[450px] border border-white/[0.06] bg-background p-0 shadow-lg z-[100]"
            >
            <div class="flex flex-col max-h-[450px]">
              <!-- Header with clear button -->
              <div class="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-sidebar sticky top-0 z-10">
                <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filters</span>
                <button
                  v-if="hasActiveFilters"
                  @click="handleClearFilters"
                  class="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              </div>
              
              <!-- Scrollable content -->
              <div class="overflow-y-auto flex-1 py-1">
                <!-- Status Filters -->
                <div class="px-1">
                  <button
                    @click="emit('update:filterUnread', !filterUnread)"
                    :class="[
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                      filterUnread ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                    ]"
                  >
                    <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', filterUnread ? 'bg-blue-500' : 'bg-white/[0.06]']">
                      <svg v-if="filterUnread" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div class="flex items-center gap-2 flex-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
                      </svg>
                      <span class="text-sm">Unread</span>
                    </div>
                  </button>
                  
                  <button
                    @click="emit('update:filterPinned', !filterPinned)"
                    :class="[
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                      filterPinned ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                    ]"
                  >
                    <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', filterPinned ? 'bg-blue-500' : 'bg-white/[0.06]']">
                      <svg v-if="filterPinned" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div class="flex items-center gap-2 flex-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                        <path d="M12 17v5"></path>
                        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path>
                      </svg>
                      <span class="text-sm">Pinned</span>
                    </div>
                  </button>
                  
                  <button
                    @click="emit('update:filterOnline', !filterOnline)"
                    :class="[
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                      filterOnline ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                    ]"
                  >
                    <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', filterOnline ? 'bg-blue-500' : 'bg-white/[0.06]']">
                      <svg v-if="filterOnline" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div class="flex items-center gap-2 flex-1">
                      <div class="w-3.5 h-3.5 rounded-full bg-green-500 opacity-60"></div>
                      <span class="text-sm">Online</span>
                    </div>
                  </button>
                  
                  <button
                    @click="emit('update:filterBlocked', !filterBlocked)"
                    :class="[
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                      filterBlocked ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                    ]"
                  >
                    <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', filterBlocked ? 'bg-blue-500' : 'bg-white/[0.06]']">
                      <svg v-if="filterBlocked" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div class="flex items-center gap-2 flex-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="m4.9 4.9 14.2 14.2"></path>
                      </svg>
                      <span class="text-sm">Blocked</span>
                    </div>
                  </button>
                </div>
                
                <!-- Profile Type -->
                <div class="mt-1 pt-1 border-t border-white/[0.06]">
                  <div class="px-3 py-1.5 text-[10px] font-medium text-white/40 uppercase tracking-wider">Profile Type</div>
                  <div class="px-1">
                    <button
                      @click="emit('update:filterCouples', !filterCouples)"
                      :class="[
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                        filterCouples ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                      ]"
                    >
                      <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', filterCouples ? 'bg-blue-500' : 'bg-white/[0.06]']">
                        <svg v-if="filterCouples" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <div class="flex items-center gap-2 flex-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <span class="text-sm">Couples</span>
                      </div>
                    </button>
                    
                    <button
                      @click="emit('update:filterFemales', !filterFemales)"
                      :class="[
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                        filterFemales ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                      ]"
                    >
                      <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', filterFemales ? 'bg-blue-500' : 'bg-white/[0.06]']">
                        <svg v-if="filterFemales" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <div class="flex items-center gap-2 flex-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                          <circle cx="12" cy="8" r="5"></circle>
                          <path d="M12 13v8"></path>
                          <path d="M9 18h6"></path>
                        </svg>
                        <span class="text-sm">Females</span>
                      </div>
                    </button>
                  </div>
                </div>
                
                <!-- Message Filters -->
                <div class="mt-1 pt-1 border-t border-white/[0.06]">
                  <div class="px-3 py-1.5 text-[10px] font-medium text-white/40 uppercase tracking-wider">Last Message</div>
                  <div class="px-1">
                    <button
                      @click="emit('update:filterLastMessageByMe', !filterLastMessageByMe)"
                      :class="[
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                        filterLastMessageByMe ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                      ]"
                    >
                      <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', filterLastMessageByMe ? 'bg-blue-500' : 'bg-white/[0.06]']">
                        <svg v-if="filterLastMessageByMe" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <div class="flex items-center gap-2 flex-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                          <path d="m5 12 7-7 7 7"></path>
                          <path d="M12 19V5"></path>
                        </svg>
                        <span class="text-sm">Sent by me</span>
                      </div>
                    </button>
                    
                    <button
                      @click="emit('update:filterLastMessageByOther', !filterLastMessageByOther)"
                      :class="[
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                        filterLastMessageByOther ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                      ]"
                    >
                      <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', filterLastMessageByOther ? 'bg-blue-500' : 'bg-white/[0.06]']">
                        <svg v-if="filterLastMessageByOther" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <div class="flex items-center gap-2 flex-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                          <path d="m19 12-7 7-7-7"></path>
                          <path d="M12 5v14"></path>
                        </svg>
                        <span class="text-sm">Sent by them</span>
                      </div>
                    </button>
                    
                    <button
                      @click="emit('update:filterOnlyMyMessages', !filterOnlyMyMessages)"
                      :class="[
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all',
                        filterOnlyMyMessages ? 'bg-blue-500/15 text-blue-400' : 'text-foreground hover:bg-secondary'
                      ]"
                    >
                      <div :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', filterOnlyMyMessages ? 'bg-blue-500' : 'bg-white/[0.06]']">
                        <svg v-if="filterOnlyMyMessages" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <div class="flex items-center gap-2 flex-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span class="text-sm">Only my messages</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>

    <!-- Tag Filters -->
    <div v-if="dbIsReady && allTags.length > 0" class="px-4 py-2 border-b border-white/[0.06] bg-background overflow-x-auto shrink-0">
      <div class="flex gap-2">
        <button
          v-for="tag in allTags"
          :key="tag.id"
          @click="emit('toggle-tag-filter', tag.id)"
          :class="[
            'px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap shrink-0 border-2 focus:outline-none focus:ring-0',
            selectedTagIds.has(tag.id)
              ? ''
              : 'bg-transparent'
          ]"
          :style="selectedTagIds.has(tag.id) 
            ? { 
                color: tag.color, 
                borderColor: tag.color, 
                backgroundColor: tag.color + '20'
              } 
            : { 
                color: tag.color, 
                borderColor: 'rgba(255,255,255,0.06)'
              }"
        >
          {{ tag.text }}
        </button>
      </div>
    </div>

    <!-- Chat List -->
    <div
      ref="chatListScrollEl"
      class="flex-1 overflow-y-auto overscroll-y-contain relative z-0"
      @pointerdown.capture="onChatListPointerDownCapture"
    >
      <div v-if="isLoading && filteredChats.length === 0" class="flex items-center justify-center h-full">
        <div class="flex flex-col items-center gap-4 px-6 max-w-sm">
          <div class="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div class="text-center">
            <div class="text-white text-lg font-semibold mb-2">Syncing your chats</div>
            <div class="text-muted-foreground text-sm">Please wait while we load your conversations...</div>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="flex items-center justify-center h-full">
        <div class="text-red-500">{{ error }}</div>
      </div>

      <div v-else-if="filteredChats.length === 0" class="flex items-center justify-center h-full">
        <div class="text-muted-foreground">No chats found</div>
      </div>

      <div v-else class="divide-y divide-white/[0.06]">
        <ChatListItem
          v-for="chat in filteredChats"
          :key="getChatKey(chat)"
          :chat="chat"
          :selected="getChatKey(selectedChat) === getChatKey(chat)"
          :folder-name="getFolderName(chat.folder_id)"
          :is-typing="typingStates.get(String(chat.group_id)) || false"
          @click="emit('chat-click', chat)"
          @open-tags="emit('chat-open-tags', $event)"
          @open-folder-dialog="emit('chat-open-folder-dialog', $event)"
        />
      </div>
    </div>
  </div>
</template>

