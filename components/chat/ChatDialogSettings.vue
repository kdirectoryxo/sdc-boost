<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { getSetting, setSetting } from '@/lib/sdc-db/settings';
import Button from '@/components/ui/Button.vue';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const apiKey = ref('');
const savedApiKey = ref('');
const loading = ref(true);
const saving = ref(false);
const saved = ref(false);
const testing = ref(false);
const validationStatus = ref<'idle' | 'valid' | 'invalid'>('idle');
const validationError = ref<string>('');

let escapeHandler: ((e: KeyboardEvent) => void) | null = null;

function handleClose() {
  validationStatus.value = 'idle';
  validationError.value = '';
  emit('update:modelValue', false);
}
 
async function loadApiKey() {
  try {
    loading.value = true;
    const key = await getSetting('openrouter_api_key');
    const keyValue = key || '';
    apiKey.value = keyValue;
    savedApiKey.value = keyValue;
    validationStatus.value = 'idle';
    validationError.value = '';
  } catch (error) {
    console.error('Error loading API key:', error);
    apiKey.value = '';
    savedApiKey.value = '';
    validationStatus.value = 'idle';
    validationError.value = '';
  } finally {
    loading.value = false;
  }
}

async function testApiKey() {
  if (testing.value || !apiKey.value.trim()) return;
  
  testing.value = true;
  validationStatus.value = 'idle';
  validationError.value = '';
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.value.trim()}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      validationStatus.value = 'valid';
      validationError.value = '';
    } else {
      const errorData = await response.json().catch(() => ({}));
      validationStatus.value = 'invalid';
      validationError.value = errorData.error?.message || `API key validation failed (${response.status})`;
    }
  } catch (error) {
    validationStatus.value = 'invalid';
    validationError.value = error instanceof Error ? error.message : 'Failed to validate API key';
  } finally {
    testing.value = false;
  }
}

async function saveApiKey() {
  if (saving.value) return;
  
  // Validate before saving if not already validated
  if (validationStatus.value !== 'valid') {
    await testApiKey();
    if (validationStatus.value !== 'valid') {
      return; // Don't save if validation failed
    }
  }
  
  saving.value = true;
  saved.value = false;
  
  try {
    await setSetting('openrouter_api_key', apiKey.value);
    savedApiKey.value = apiKey.value;
    saved.value = true;
    validationStatus.value = 'idle'; // Reset validation status after save
    setTimeout(() => {
      saved.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error saving API key:', error);
  } finally {
    saving.value = false;
  }
}

const hasApiKey = () => {
  return savedApiKey.value.trim().length > 0;
};

// Load API key when dialog opens
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    await loadApiKey();
  }
}, { immediate: true });

// Close on Escape key
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', escapeHandler);
  } else {
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
      escapeHandler = null;
    }
  }
});

onMounted(async () => {
  if (props.modelValue) {
    await loadApiKey();
  }
});

onUnmounted(() => {
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
  }
});
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-[1000000]"
    style="pointer-events: auto; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
    @click.self="handleClose"
  >
    <div
      class="bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl min-w-[400px] max-w-[500px] overflow-hidden"
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-[#333]">
        <h3 class="text-lg font-semibold text-white">Chat Settings</h3>
        <button
          @click="handleClose"
          class="p-1 hover:bg-[#333] rounded transition-colors"
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
            class="text-[#999] hover:text-white"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6">
        <div v-if="loading" class="text-center py-8 text-[#999]">
          Loading...
        </div>
        
        <div v-else class="flex flex-col gap-4">
          <!-- AI Configuration Section -->
          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-white">OpenRouter API Key</span>
              <span class="text-xs text-[#999]">
                Your API key is stored locally and never sent to any server except OpenRouter.
              </span>
            </label>
            
            <div class="flex items-center gap-2">
              <input
                v-model="apiKey"
                type="password"
                placeholder="sk-or-..."
                :class="[
                  'flex-1 py-2 px-3 bg-[#2a2a2a] border rounded-md text-white text-sm font-sans transition-all duration-200 focus:outline-none focus:bg-[#333]',
                  validationStatus === 'valid' ? 'border-green-500' : validationStatus === 'invalid' ? 'border-red-500' : 'border-[#333] focus:border-green-500'
                ]"
                @input="validationStatus = 'idle'; validationError = ''"
              />
              <Button
                @click="testApiKey"
                :disabled="testing || !apiKey.trim()"
                variant="secondary"
                size="sm"
              >
                {{ testing ? 'Testing...' : 'Test' }}
              </Button>
              <Button
                @click="saveApiKey"
                :disabled="saving || testing"
                variant="default"
                size="sm"
              >
                {{ saving ? 'Saving...' : saved ? 'Saved!' : 'Save' }}
              </Button>
            </div>

            <!-- Validation Status -->
            <div v-if="validationStatus !== 'idle'" class="flex items-center gap-2 text-xs">
              <div
                :class="[
                  'w-2 h-2 rounded-full',
                  validationStatus === 'valid' ? 'bg-green-500' : 'bg-red-500'
                ]"
              ></div>
              <span :class="validationStatus === 'valid' ? 'text-green-400' : 'text-red-400'">
                {{ validationStatus === 'valid' ? 'API key is valid' : validationError || 'API key is invalid' }}
              </span>
            </div>

            <!-- Saved Status Indicator -->
            <div v-else class="flex items-center gap-2 text-xs">
              <div
                :class="[
                  'w-2 h-2 rounded-full',
                  hasApiKey() ? 'bg-green-500' : 'bg-[#666]'
                ]"
              ></div>
              <span :class="hasApiKey() ? 'text-green-400' : 'text-[#999]'">
                {{ hasApiKey() ? 'API key configured' : 'No API key configured' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-[#333] flex justify-end">
        <Button
          @click="handleClose"
          variant="ghost"
          size="sm"
        >
          Close
        </Button>
      </div>
    </div>
  </div>
</template>
