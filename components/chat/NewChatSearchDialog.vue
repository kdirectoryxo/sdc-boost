<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import { searchGlobalV2, startChat } from '@/lib/sdc-api';
import type { SearchGlobalV2Result } from '@/lib/sdc-api-types';
import { useDebounceFn } from '@vueuse/core';

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

// Debounce search to avoid excessive API calls
const performSearch = useDebounceFn(async (query: string) => {
  if (!query.trim()) {
    searchResults.value = [];
    isSearching.value = false;
    return;
  }

  error.value = null;

  try {
    const response = await searchGlobalV2(query.trim(), 'PN', 0);
    
    // Results are in info.list (new format) or info.data.PN.results (old format)
    let results: SearchGlobalV2Result[] = [];
    
    if (response.info.list && Array.isArray(response.info.list)) {
      // New format: results directly in list
      results = response.info.list;
    } else if (response.info.data?.PN?.results) {
      // Old format: results in data.PN.results
      results = response.info.data.PN.results;
    }
    
    // Return all results (no limit)
    searchResults.value = results;
  } catch (err) {
    console.error('[NewChatSearchDialog] Search failed:', err);
    error.value = err instanceof Error ? err.message : 'Failed to search users';
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}, 300);

// Watch search query and perform search
watch(searchQuery, (newQuery) => {
  if (newQuery.trim()) {
    // Set loading state immediately when user types
    isSearching.value = true;
    error.value = null;
  } else {
    // Clear results immediately when query is empty
    searchResults.value = [];
    isSearching.value = false;
    error.value = null;
  }
  performSearch(newQuery);
});

// Reset when dialog closes
watch(() => props.visible, (newValue) => {
  console.log('[NewChatSearchDialog] visible prop changed to:', newValue);
  if (!newValue) {
    searchQuery.value = '';
    searchResults.value = [];
    error.value = null;
  }
}, { immediate: true });

function handleClose() {
  emit('close');
}

async function handleSelectUser(user: SearchGlobalV2Result) {
  isStartingChat.value = true;
  error.value = null;

  try {
    // Emit event to parent to handle chat creation
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
  // Age format is "61|61" or similar
  const parts = age.split('|');
  return parts[0] || age;
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    style="pointer-events: auto; z-index: 10000000; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
    @click.self="handleClose"
  >
    <div
      class="w-[90vw] max-w-md h-[80vh] max-h-[600px] bg-background rounded-lg shadow-2xl flex flex-col overflow-hidden border border-white/[0.06]"
      @click.stop
    >
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
              <h2 class="text-xl font-semibold text-white">New Chat</h2>
              <button
                @click="handleClose"
                class="p-2 hover:bg-white/[0.08] rounded-md transition-colors"
                title="Close"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-muted-foreground hover:text-white"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- Search Input -->
            <div class="px-6 py-4 border-b border-white/[0.06] shrink-0">
              <div class="relative flex items-center gap-2 bg-sidebar border border-white/[0.06] rounded-lg px-4 py-2 focus-within:border-blue-500 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white/40 shrink-0">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search by username..."
                  class="flex-1 bg-transparent text-white placeholder-white/40 focus:outline-none min-w-0"
                  autofocus
                />
                <button
                  v-if="searchQuery.trim()"
                  @click="searchQuery = ''"
                  class="p-0.5 hover:bg-secondary rounded transition-colors shrink-0"
                  title="Clear search"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground hover:text-white">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Results -->
            <div class="flex-1 overflow-y-auto relative">
              <!-- Loading State -->
              <div v-if="isSearching" class="flex items-center justify-center h-full">
                <div class="flex flex-col items-center gap-4">
                  <div class="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <div class="text-muted-foreground text-sm">Searching...</div>
                </div>
              </div>

              <!-- Error State -->
              <div v-else-if="error" class="flex items-center justify-center h-full">
                <div class="text-center px-6">
                  <div class="text-red-500 mb-2">{{ error }}</div>
                  <button
                    @click="error = null; performSearch(searchQuery)"
                    class="text-blue-500 hover:text-blue-400 text-sm"
                  >
                    Try again
                  </button>
                </div>
              </div>

              <!-- Empty State (no search yet) -->
              <div v-else-if="!searchQuery.trim()" class="flex items-center justify-center h-full">
                <div class="text-center px-6">
                  <div class="text-muted-foreground text-sm">Type a username to search for people</div>
                </div>
              </div>

              <!-- No Results -->
              <div v-else-if="searchResults.length === 0 && !isSearching" class="flex items-center justify-center h-full">
                <div class="text-center px-6">
                  <div class="text-muted-foreground text-sm">No users found</div>
                </div>
              </div>

              <!-- Results List -->
              <div v-else class="divide-y divide-white/[0.06]">
                <button
                  v-for="user in searchResults"
                  :key="user.db_id"
                  @click="handleSelectUser(user)"
                  :disabled="isStartingChat"
                  class="w-full px-6 py-4 hover:bg-secondary transition-colors flex items-center gap-4 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <!-- Avatar -->
                  <div class="relative shrink-0">
                    <img
                      :src="getPhotoUrl(user.primary_photo)"
                      :alt="user.account_id"
                      class="w-12 h-12 rounded-full object-cover"
                    />
                    <!-- Online Indicator -->
                    <div
                      v-if="user.online === 1"
                      class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"
                    ></div>
                  </div>

                  <!-- User Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <div class="text-white font-medium truncate">{{ user.account_id }}</div>
                      <div v-if="user.lifetime_status" class="text-yellow-400 text-xs" title="Lifetime Member">⭐</div>
                    </div>
                    <div class="flex items-center gap-3 text-sm text-muted-foreground">
                      <span v-if="formatAge(user.age)">{{ formatAge(user.age) }} jaar</span>
                      <span v-if="user.location">{{ user.location }}</span>
                    </div>
                  </div>

                  <!-- Arrow -->
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-white/40 shrink-0"
                  >
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </div>
            </div>
    </div>
  </div>
</template>

