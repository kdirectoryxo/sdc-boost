<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import type { MessengerGroupUser, MessengerGroupAdmin } from '@/lib/sdc-api-types';
import { getMessengerGroupInfo, getMessengerGroupChatDetails } from '@/lib/sdc-api/messenger';

interface Props {
  visible: boolean;
  groupId: string | null;
  stackLevel?: number;
  dialogId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  stackLevel: 0,
  dialogId: '',
});

const emit = defineEmits<{
  close: [];
  'open-profile': [userId: number];
}>();

const groupInfo = ref<{
  name: string;
  logo: string;
  muted: string;
  owner: number;
  participants: number;
  users: MessengerGroupUser[];
  admins: MessengerGroupAdmin[];
} | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Fetch group data when dialog opens
watch([() => props.visible, () => props.groupId], async ([visible, groupId]) => {
  if (visible && groupId) {
    await fetchGroupData(groupId);
  } else if (!visible) {
    // Reset state when closing
    groupInfo.value = null;
    error.value = null;
  }
}, { immediate: true });

async function fetchGroupData(groupId: string) {
  isLoading.value = true;
  error.value = null;
  
  try {
    // First, fetch group chat details to get target_db_id
    const chatDetailsResponse = await getMessengerGroupChatDetails(groupId, 0);
    
    if (chatDetailsResponse.info.code !== '200' && chatDetailsResponse.info.code !== 200) {
      error.value = chatDetailsResponse.info.message || 'Failed to load group chat details';
      isLoading.value = false;
      return;
    }
    
    // Extract target_db_id from chat details response
    const targetDbId = chatDetailsResponse.info.target_db_id;
    
    if (!targetDbId) {
      error.value = 'Failed to get target_db_id from group chat details';
      isLoading.value = false;
      return;
    }
    
    // Fetch group info using target_db_id as muid
    const infoResponse = await getMessengerGroupInfo(groupId, targetDbId);
    
    if (infoResponse.info.code === '200' || infoResponse.info.code === 200) {
      groupInfo.value = {
        name: infoResponse.info.name,
        logo: infoResponse.info.logo,
        muted: infoResponse.info.muted,
        owner: infoResponse.info.owner,
        participants: infoResponse.info.participants,
        users: infoResponse.info.users,
        admins: infoResponse.info.admins,
      };
    } else {
      error.value = infoResponse.info.message || 'Failed to load group info';
    }
    
    isLoading.value = false;
  } catch (err) {
    console.error('[GroupDialog] Failed to fetch group data:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load group data';
    isLoading.value = false;
  }
}

function handleClose() {
  emit('close');
}

function handleOpenProfile(userId: number) {
  emit('open-profile', userId);
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
    :style="{
      pointerEvents: 'auto',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      background: stackLevel > 0 ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      zIndex: 10000001 + (stackLevel * 10),
    }"
    @click.self="handleClose"
  >
        <div
          class="w-[80vw] max-w-6xl h-[90vh] bg-background rounded-lg shadow-2xl flex flex-col overflow-hidden border border-white/[0.06]"
          :style="{
            transform: stackLevel > 0 ? `scale(${1 - stackLevel * 0.05})` : 'scale(1)',
            transition: 'transform 0.2s ease',
          }"
          @click.stop
        >
          <!-- Header -->
          <div class="px-6 py-4 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
            <h2 class="text-xl font-semibold text-white">Group Info</h2>
            <button
              @click="handleClose"
              class="p-2 hover:bg-secondary rounded transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <div v-if="isLoading" class="flex items-center justify-center h-full">
              <div class="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>

            <div v-else-if="error" class="flex items-center justify-center h-full">
              <div class="text-red-500 text-center">
                <p class="text-lg font-semibold mb-2">Error</p>
                <p>{{ error }}</p>
              </div>
            </div>

            <div v-else-if="groupInfo" class="space-y-6">
              <!-- Group Header -->
              <div class="flex items-start gap-4">
                <img
                  v-if="groupInfo.logo"
                  :src="groupInfo.logo"
                  :alt="groupInfo.name"
                  class="w-20 h-20 rounded-lg object-cover"
                />
                <img
                  v-else
                  src="https://www.sdc.com/react/assets/group.8481d87a.svg"
                  :alt="groupInfo.name"
                  class="w-20 h-20 rounded-lg object-cover bg-white/[0.06] p-4"
                />
                <div class="flex-1">
                  <h3 class="text-2xl font-semibold text-white mb-2">{{ groupInfo.name }}</h3>
                  <p class="text-muted-foreground">{{ groupInfo.participants }} participants</p>
                  <p v-if="groupInfo.muted === '1'" class="text-yellow-400 text-sm mt-1">🔇 Muted</p>
                </div>
              </div>

              <!-- Admins Section -->
              <div v-if="groupInfo.admins.length > 0">
                <h4 class="text-lg font-semibold text-white mb-3">Admins</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    v-for="admin in groupInfo.admins"
                    :key="admin.db_id"
                    @click="handleOpenProfile(Number(admin.db_id))"
                    class="flex items-center gap-3 p-3 bg-background border border-white/[0.06] rounded-lg cursor-pointer hover:bg-secondary transition-colors"
                  >
                    <img
                      :src="`https://pictures.sdc.com/photos/${admin.primary_photo}`"
                      :alt="admin.account_id"
                      class="w-12 h-12 rounded-full object-cover"
                    />
                    <div class="flex-1 min-w-0">
                      <p class="font-semibold text-white truncate">{{ admin.account_id }}</p>
                      <p class="text-sm text-muted-foreground truncate">{{ admin.location }}</p>
                    </div>
                    <span v-if="admin.owner === 1" class="text-xs text-yellow-400">Owner</span>
                  </div>
                </div>
              </div>

              <!-- Members Section (using users from group info) -->
              <div v-if="groupInfo.users.length > 0">
                <h4 class="text-lg font-semibold text-white mb-3">Members</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    v-for="user in groupInfo.users"
                    :key="user.db_id"
                    @click="handleOpenProfile(Number(user.db_id))"
                    class="flex items-center gap-3 p-3 bg-background border border-white/[0.06] rounded-lg cursor-pointer hover:bg-secondary transition-colors"
                  >
                    <img
                      :src="`https://pictures.sdc.com/photos/${user.primary_photo}`"
                      :alt="user.account_id"
                      class="w-12 h-12 rounded-full object-cover"
                    />
                    <div class="flex-1 min-w-0">
                      <p class="font-semibold text-white truncate">{{ user.account_id }}</p>
                      <p class="text-sm text-muted-foreground truncate">{{ user.location }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
</template>

