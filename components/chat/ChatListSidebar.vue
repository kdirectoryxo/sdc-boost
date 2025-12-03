<script lang="ts" setup>
import ChatListItem from '@/components/ChatListItem.vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import type { MessengerChatItem } from '@/lib/sdc-api-types';
import { getChatKey } from '@/lib/composables/chat/utils';

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
  isFilterDropdownOpen: boolean;
  hasActiveFilters: boolean;
  activeFilterCount: number;
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
  'update:isFilterDropdownOpen': [value: boolean];
  'chat-click': [chat: MessengerChatItem];
  'clear-filters': [];
  'clear-search': [];
}>();

function handleClearFilters() {
  emit('clear-filters');
  emit('update:isFilterDropdownOpen', false);
}
</script>

<template>
  <div class="w-[35%] border-r border-[#333] flex flex-col bg-[#0f0f0f]">
    <!-- Search Bar and Filter -->
    <div class="p-4 border-b border-[#333] shrink-0">
      <div class="flex items-center gap-2">
        <div class="relative flex-1 flex items-center gap-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2 focus-within:border-blue-500 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#666] shrink-0">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            :value="searchQuery"
            @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="Search chats..."
            class="flex-1 bg-transparent text-white placeholder-[#666] focus:outline-none min-w-0"
          />
          <button
            v-if="searchQuery.trim()"
            @click="emit('clear-search')"
            class="p-0.5 hover:bg-[#2a2a2a] rounded transition-colors shrink-0"
            title="Clear search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#999] hover:text-white">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <!-- Filter Button -->
        <Dropdown
          :model-value="isFilterDropdownOpen"
          @update:model-value="emit('update:isFilterDropdownOpen', $event)"
          placement="bottom"
          alignment="end"
          width="w-56"
          offset="mt-2"
        >
          <template #trigger="{ isOpen, toggle }">
            <button
              @click.stop="toggle"
              :class="[
                'p-2 rounded-lg border transition-colors relative',
                hasActiveFilters
                  ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                  : 'bg-[#1a1a1a] border-[#333] text-[#999] hover:border-[#444] hover:text-white'
              ]"
              title="Filter chats"
            >
              <!-- Filter icon -->
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              <!-- Cross icon for quick clear (shown when filters are active, positioned top-right) -->
              <button
                v-if="hasActiveFilters"
                @click.stop="handleClearFilters"
                class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center z-30 transition-colors"
                title="Clear all filters"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <!-- Active filter badge -->
              <span
                v-if="activeFilterCount > 0"
                class="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center z-20"
              >
                {{ activeFilterCount }}
              </span>
            </button>
          </template>
          <template #content="{ close }">
            <div class="p-2">
              <!-- Unread Filter -->
              <label class="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[#2a2a2a] cursor-pointer transition-colors group">
                <div class="relative flex items-center">
                  <input
                    type="checkbox"
                    :checked="filterUnread"
                    @change="emit('update:filterUnread', ($event.target as HTMLInputElement).checked)"
                    class="w-4 h-4 rounded border-2 border-[#555] bg-[#0f0f0f] text-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer appearance-none checked:bg-blue-500 checked:border-blue-500 transition-all duration-200"
                  />
                  <svg v-if="filterUnread" class="absolute left-0.5 w-3 h-3 text-white pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <span class="text-white text-sm select-none">Unread only</span>
              </label>
              
              <!-- Pinned Filter -->
              <label class="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[#2a2a2a] cursor-pointer transition-colors group">
                <div class="relative flex items-center">
                  <input
                    type="checkbox"
                    :checked="filterPinned"
                    @change="emit('update:filterPinned', ($event.target as HTMLInputElement).checked)"
                    class="w-4 h-4 rounded border-2 border-[#555] bg-[#0f0f0f] text-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer appearance-none checked:bg-blue-500 checked:border-blue-500 transition-all duration-200"
                  />
                  <svg v-if="filterPinned" class="absolute left-0.5 w-3 h-3 text-white pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <span class="text-white text-sm select-none">Pinned only</span>
              </label>
              
              <!-- Online Filter -->
              <label class="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[#2a2a2a] cursor-pointer transition-colors group">
                <div class="relative flex items-center">
                  <input
                    type="checkbox"
                    :checked="filterOnline"
                    @change="emit('update:filterOnline', ($event.target as HTMLInputElement).checked)"
                    class="w-4 h-4 rounded border-2 border-[#555] bg-[#0f0f0f] text-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer appearance-none checked:bg-blue-500 checked:border-blue-500 transition-all duration-200"
                  />
                  <svg v-if="filterOnline" class="absolute left-0.5 w-3 h-3 text-white pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <span class="text-white text-sm select-none">Online only</span>
              </label>
              
              <!-- Blocked Filter -->
              <label class="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[#2a2a2a] cursor-pointer transition-colors group">
                <div class="relative flex items-center">
                  <input
                    type="checkbox"
                    :checked="filterBlocked"
                    @change="emit('update:filterBlocked', ($event.target as HTMLInputElement).checked)"
                    class="w-4 h-4 rounded border-2 border-[#555] bg-[#0f0f0f] text-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer appearance-none checked:bg-blue-500 checked:border-blue-500 transition-all duration-200"
                  />
                  <svg v-if="filterBlocked" class="absolute left-0.5 w-3 h-3 text-white pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <span class="text-white text-sm select-none">Blocked only</span>
              </label>
              
              <!-- Last Message Filters -->
              <div class="border-t border-[#333] mt-2 pt-2">
                <div class="px-3 py-1 text-xs text-[#666] uppercase tracking-wide mb-1">Last Message</div>
                
                <label class="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[#2a2a2a] cursor-pointer transition-colors group">
                  <div class="relative flex items-center">
                    <input
                      type="checkbox"
                      :checked="filterLastMessageByMe"
                      @change="emit('update:filterLastMessageByMe', ($event.target as HTMLInputElement).checked)"
                      class="w-4 h-4 rounded border-2 border-[#555] bg-[#0f0f0f] text-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer appearance-none checked:bg-blue-500 checked:border-blue-500 transition-all duration-200"
                    />
                    <svg v-if="filterLastMessageByMe" class="absolute left-0.5 w-3 h-3 text-white pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <span class="text-white text-sm select-none">I sent last</span>
                </label>
                
                <label class="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[#2a2a2a] cursor-pointer transition-colors group">
                  <div class="relative flex items-center">
                    <input
                      type="checkbox"
                      :checked="filterLastMessageByOther"
                      @change="emit('update:filterLastMessageByOther', ($event.target as HTMLInputElement).checked)"
                      class="w-4 h-4 rounded border-2 border-[#555] bg-[#0f0f0f] text-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer appearance-none checked:bg-blue-500 checked:border-blue-500 transition-all duration-200"
                    />
                    <svg v-if="filterLastMessageByOther" class="absolute left-0.5 w-3 h-3 text-white pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <span class="text-white text-sm select-none">Other sent last</span>
                </label>
                
                <label class="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[#2a2a2a] cursor-pointer transition-colors group">
                  <div class="relative flex items-center">
                    <input
                      type="checkbox"
                      :checked="filterOnlyMyMessages"
                      @change="emit('update:filterOnlyMyMessages', ($event.target as HTMLInputElement).checked)"
                      class="w-4 h-4 rounded border-2 border-[#555] bg-[#0f0f0f] text-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer appearance-none checked:bg-blue-500 checked:border-blue-500 transition-all duration-200"
                    />
                    <svg v-if="filterOnlyMyMessages" class="absolute left-0.5 w-3 h-3 text-white pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <span class="text-white text-sm select-none">Only my messages</span>
                </label>
              </div>
              
              <!-- Clear Filters Button -->
              <div v-if="hasActiveFilters" class="border-t border-[#333] mt-2 pt-2">
                <button
                  @click="handleClearFilters; close()"
                  class="w-full px-3 py-2 text-sm text-[#999] hover:text-white hover:bg-[#2a2a2a] rounded transition-colors text-left"
                >
                  Clear filters
                </button>
              </div>
            </div>
          </template>
        </Dropdown>
      </div>
    </div>

    <!-- Chat List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="isLoading && filteredChats.length === 0" class="flex items-center justify-center h-full">
        <div class="flex flex-col items-center gap-4 px-6 max-w-sm">
          <div class="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div class="text-center">
            <div class="text-white text-lg font-semibold mb-2">Syncing your chats</div>
            <div class="text-[#999] text-sm">Please wait while we load your conversations...</div>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="flex items-center justify-center h-full">
        <div class="text-red-500">{{ error }}</div>
      </div>

      <div v-else-if="filteredChats.length === 0" class="flex items-center justify-center h-full">
        <div class="text-[#999]">No chats found</div>
      </div>

      <div v-else class="divide-y divide-[#333]">
        <ChatListItem
          v-for="chat in filteredChats"
          :key="getChatKey(chat)"
          :chat="chat"
          :selected="getChatKey(selectedChat) === getChatKey(chat)"
          :folder-name="getFolderName(chat.folder_id)"
          :is-typing="typingStates.get(String(chat.group_id)) || false"
          @click="emit('chat-click', chat)"
        />
      </div>
    </div>
  </div>
</template>

