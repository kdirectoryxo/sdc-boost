<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue';
import { X } from 'lucide-vue-next';
import { getSetting, setSetting } from '@/lib/sdc-db/settings';
import { Button } from '@/lib/view-router/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/lib/view-router/ui/dialog';
import { ScrollArea } from '@/lib/view-router/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  CHAT_NESTED_DIALOG_OVERLAY_CLASS,
  CHAT_NESTED_DIALOG_CONTENT_CLASS,
  CHAT_SUBDIALOG_OVERLAY_CLASS,
  CHAT_SUBDIALOG_CONTENT_CLASS,
} from '@/lib/chat-ui/nested-dialog-classes';

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

  let status: 'idle' | 'valid' | 'invalid' = validationStatus.value;
  if (status !== 'valid') {
    await testApiKey();
    status = validationStatus.value;
  }
  if (status !== 'valid') {
    return;
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

function onSettingsOpenChange(open: boolean) {
  if (!open) {
    handleClose();
  }
}

function onContextDialogOpenChange(open: boolean) {
  if (!open) {
    closeContextDialog();
  }
}

onMounted(async () => {
  if (props.modelValue) {
    await loadApiKey();
    await loadContext();
  }
});

</script>

<template>
  <Dialog :open="modelValue" @update:open="onSettingsOpenChange">
    <DialogContent
      :show-close-button="false"
      :overlay-class="CHAT_NESTED_DIALOG_OVERLAY_CLASS"
      :class="
        cn(
          CHAT_NESTED_DIALOG_CONTENT_CLASS,
          '!flex !min-w-[400px] !max-w-[500px] flex-col overflow-hidden rounded-lg border border-white/[0.06] bg-background p-0 shadow-2xl',
        )
      "
    >
      <DialogHeader class="flex-row items-center justify-between space-y-0 border-b border-white/[0.06] px-6 py-4 text-left">
        <DialogTitle class="text-lg font-semibold text-white">Chat Settings</DialogTitle>
        <Button variant="ghost" size="icon" title="Close" @click="handleClose">
          <X class="size-5 text-muted-foreground" />
        </Button>
      </DialogHeader>

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

      <DialogFooter class="border-t border-white/[0.06] px-6 py-4 sm:justify-end">
        <Button variant="ghost" size="sm" @click="handleClose">Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Dialog :open="contextDialogOpen" @update:open="onContextDialogOpenChange">
    <DialogContent
      :show-close-button="false"
      :overlay-class="CHAT_SUBDIALOG_OVERLAY_CLASS"
      :class="
        cn(
          CHAT_SUBDIALOG_CONTENT_CLASS,
          '!flex !h-[min(80vh,600px)] !max-h-[600px] !w-[90vw] !max-w-[800px] flex-col overflow-hidden rounded-lg border border-white/[0.06] bg-background p-0 shadow-2xl',
        )
      "
    >
      <DialogHeader class="flex-row items-center justify-between space-y-0 border-b border-white/[0.06] px-6 py-4 text-left">
        <DialogTitle class="text-lg font-semibold text-white">Edit Context / Preferences</DialogTitle>
        <Button variant="ghost" size="icon" title="Close" @click="closeContextDialog">
          <X class="size-5 text-muted-foreground" />
        </Button>
      </DialogHeader>

      <ScrollArea class="min-h-0 flex-1">
        <div class="flex flex-col gap-3 p-6">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-white">Additional Context / Preferences</span>
            <span class="text-xs text-muted-foreground">
              Add preferences or context that you don't want to show on your profile. This will help the AI provide more personalized responses.
            </span>
          </label>

          <textarea
            v-model="contextDialogText"
            placeholder="e.g., We prefer full-swap with active couples"
            class="min-h-[280px] w-full resize-none rounded-md border border-white/[0.06] bg-secondary py-3 px-4 text-sm text-white transition-all duration-200 focus:border-green-500 focus:bg-white/[0.08] focus:outline-none"
          />
        </div>
      </ScrollArea>

      <DialogFooter class="border-t border-white/[0.06] px-6 py-4 sm:justify-end">
        <Button variant="ghost" size="sm" @click="closeContextDialog">Cancel</Button>
        <Button size="sm" :disabled="savingContext" @click="saveContextFromDialog">
          {{ savingContext ? 'Saving...' : savedContextStatus ? 'Saved!' : 'Save' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
