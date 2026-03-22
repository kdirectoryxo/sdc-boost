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
const context = ref('');
const savedContext = ref('');
const loading = ref(true);
const saving = ref(false);
const saved = ref(false);
const savingContext = ref(false);
const savedContextStatus = ref(false);
const testing = ref(false);
const validationStatus = ref<'idle' | 'valid' | 'invalid'>('idle');
const validationError = ref<string>('');
const contextDialogOpen = ref(false);
const contextDialogText = ref('');

let escapeHandler: ((e: KeyboardEvent) => void) | null = null;
let contextDialogEscapeHandler: ((e: KeyboardEvent) => void) | null = null;

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

async function loadContext() {
  try {
    const contextValue = await getSetting('ai_chat_context');
    const contextStr = contextValue || '';
    context.value = contextStr;
    savedContext.value = contextStr;
  } catch (error) {
    console.error('Error loading context:', error);
    context.value = '';
    savedContext.value = '';
  }
}

async function saveContext() {
  if (savingContext.value) return;
  
  savingContext.value = true;
  savedContextStatus.value = false;
  
  try {
    await setSetting('ai_chat_context', context.value);
    savedContext.value = context.value;
    savedContextStatus.value = true;
    setTimeout(() => {
      savedContextStatus.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error saving context:', error);
  } finally {
    savingContext.value = false;
  }
}

function openContextDialog() {
  contextDialogText.value = context.value;
  contextDialogOpen.value = true;
}

function closeContextDialog() {
  contextDialogOpen.value = false;
  // Sync back to main context if user made changes
  context.value = contextDialogText.value;
}

async function saveContextFromDialog() {
  if (savingContext.value) return;
  
  savingContext.value = true;
  savedContextStatus.value = false;
  
  try {
    // Update main context with dialog text
    context.value = contextDialogText.value;
    await setSetting('ai_chat_context', contextDialogText.value);
    savedContext.value = contextDialogText.value;
    savedContextStatus.value = true;
    setTimeout(() => {
      savedContextStatus.value = false;
    }, 2000);
    // Close dialog after save
    setTimeout(() => {
      closeContextDialog();
    }, 500);
  } catch (error) {
    console.error('Error saving context:', error);
  } finally {
    savingContext.value = false;
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

// Load API key and context when dialog opens
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    await loadApiKey();
    await loadContext();
  }
}, { immediate: true });

// Close on Escape key
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !contextDialogOpen.value) {
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

// Handle escape key for context dialog
watch(() => contextDialogOpen.value, (isOpen) => {
  if (isOpen) {
    contextDialogEscapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextDialog();
      }
    };
    document.addEventListener('keydown', contextDialogEscapeHandler);
  } else {
    if (contextDialogEscapeHandler) {
      document.removeEventListener('keydown', contextDialogEscapeHandler);
      contextDialogEscapeHandler = null;
    }
  }
});

onMounted(async () => {
  if (props.modelValue) {
    await loadApiKey();
    await loadContext();
  }
});

onUnmounted(() => {
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
  }
  if (contextDialogEscapeHandler) {
    document.removeEventListener('keydown', contextDialogEscapeHandler);
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
      class="bg-background border border-white/[0.06] rounded-lg shadow-2xl min-w-[400px] max-w-[500px] overflow-hidden"
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <h3 class="text-lg font-semibold text-white">Chat Settings</h3>
        <button
          @click="handleClose"
          class="p-1 hover:bg-white/[0.08] rounded transition-colors"
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

      <!-- Content -->
      <div class="p-6">
        <div v-if="loading" class="text-center py-8 text-muted-foreground">
          Loading...
        </div>
        
        <div v-else class="flex flex-col gap-4">
          <!-- AI Configuration Section -->
          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-white">OpenRouter API Key</span>
              <span class="text-xs text-muted-foreground">
                Your API key is stored locally and never sent to any server except OpenRouter.
              </span>
            </label>
            
            <div class="flex items-center gap-2">
              <input
                v-model="apiKey"
                type="password"
                placeholder="sk-or-..."
                :class="[
                  'flex-1 py-2 px-3 bg-secondary border rounded-md text-white text-sm font-sans transition-all duration-200 focus:outline-none focus:bg-white/[0.08]',
                  validationStatus === 'valid' ? 'border-green-500' : validationStatus === 'invalid' ? 'border-red-500' : 'border-white/[0.06] focus:border-green-500'
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
                  hasApiKey() ? 'bg-green-500' : 'bg-white/40'
                ]"
              ></div>
              <span :class="hasApiKey() ? 'text-green-400' : 'text-muted-foreground'">
                {{ hasApiKey() ? 'API key configured' : 'No API key configured' }}
              </span>
            </div>
          </div>

          <!-- Context/Preferences Section -->
          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-white">Additional Context / Preferences</span>
              <span class="text-xs text-muted-foreground">
                Add preferences or context that you don't want to show on your profile. This will help the AI provide more personalized responses.
              </span>
            </label>
            
            <div class="flex flex-col gap-2">
              <div class="flex items-start gap-2">
                <textarea
                  v-model="context"
                  placeholder="e.g., We prefer full-swap with active couples"
                  rows="4"
                  class="flex-1 py-2 px-3 bg-secondary border border-white/[0.06] rounded-md text-white text-sm font-sans transition-all duration-200 focus:outline-none focus:bg-white/[0.08] focus:border-green-500 resize-y"
                ></textarea>
                <Button
                  @click="openContextDialog"
                  variant="secondary"
                  size="sm"
                  class="mt-0"
                  title="Open in larger editor"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                  </svg>
                </Button>
              </div>
              <div class="flex justify-end">
                <Button
                  @click="saveContext"
                  :disabled="savingContext"
                  variant="default"
                  size="sm"
                >
                  {{ savingContext ? 'Saving...' : savedContextStatus ? 'Saved!' : 'Save Context' }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-white/[0.06] flex justify-end">
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

  <!-- Context Dialog -->
  <div
    v-if="contextDialogOpen"
    class="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-[1000001]"
    style="pointer-events: auto; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
    @click.self="closeContextDialog"
  >
    <div
      class="bg-background border border-white/[0.06] rounded-lg shadow-2xl w-[90vw] max-w-[800px] h-[80vh] max-h-[600px] overflow-hidden flex flex-col"
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <h3 class="text-lg font-semibold text-white">Edit Context / Preferences</h3>
        <button
          @click="closeContextDialog"
          class="p-1 hover:bg-white/[0.08] rounded transition-colors"
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

      <!-- Content -->
      <div class="flex-1 p-6 overflow-hidden flex flex-col">
        <div class="flex flex-col gap-3 flex-1 overflow-hidden">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-white">Additional Context / Preferences</span>
            <span class="text-xs text-muted-foreground">
              Add preferences or context that you don't want to show on your profile. This will help the AI provide more personalized responses.
            </span>
          </label>
          
          <textarea
            v-model="contextDialogText"
            placeholder="e.g., We prefer full-swap with active couples"
            class="flex-1 w-full py-3 px-4 bg-secondary border border-white/[0.06] rounded-md text-white text-sm font-sans transition-all duration-200 focus:outline-none focus:bg-white/[0.08] focus:border-green-500 resize-none"
          ></textarea>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-2">
        <Button
          @click="closeContextDialog"
          variant="ghost"
          size="sm"
        >
          Cancel
        </Button>
        <Button
          @click="saveContextFromDialog"
          :disabled="savingContext"
          variant="default"
          size="sm"
        >
          {{ savingContext ? 'Saving...' : savedContextStatus ? 'Saved!' : 'Save' }}
        </Button>
      </div>
    </div>
  </div>
</template>
