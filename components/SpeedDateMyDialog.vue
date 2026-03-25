<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/lib/view-router/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/lib/view-router/ui/alert-dialog';
import { Button } from '@/lib/view-router/ui/button';
import { cn } from '@/lib/utils';
import type { SpeedDatingV2Item } from '@/lib/sdc-api-types';
import { deleteSpeedDate, getSpeedDatePostId } from '@/lib/sdc-api/speed-dating';
import { resolvePeopleApiMuid } from '@/lib/sdc-api/session-credentials';
import SpeedDateCreateDialog from '@/components/SpeedDateCreateDialog.vue';

const props = defineProps<{
  modelValue: boolean;
  items: SpeedDatingV2Item[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  changed: [];
}>();

const createOpen = ref(false);
const editMode = ref<'create' | 'edit'>('create');
const editId = ref<number | null>(null);
const editInitial = ref<SpeedDatingV2Item | null>(null);

const deleteConfirmOpen = ref(false);
const deleteTarget = ref<SpeedDatingV2Item | null>(null);
const deleting = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      createOpen.value = false;
      deleteConfirmOpen.value = false;
      deleteTarget.value = null;
    }
  }
);

function close() {
  emit('update:modelValue', false);
}

const hasRows = computed(() => props.items.length > 0);

function openEdit(row: SpeedDatingV2Item) {
  const id = getSpeedDatePostId(row);
  if (id == null) {
    window.alert(
      'Kan deze speeddate niet bewerken: ontbrekend id van de server. Vernieuw de pagina en probeer opnieuw.'
    );
    return;
  }
  editMode.value = 'edit';
  editId.value = id;
  editInitial.value = row;
  createOpen.value = true;
}

function confirmDelete(row: SpeedDatingV2Item) {
  deleteTarget.value = row;
  deleteConfirmOpen.value = true;
}

async function doDelete() {
  const row = deleteTarget.value;
  if (!row) return;
  deleting.value = true;
  try {
    const muid = await resolvePeopleApiMuid();
    const selfId = parseInt(muid, 10);
    if (Number.isNaN(selfId)) {
      throw new Error('Account-id ontbreekt.');
    }
    await deleteSpeedDate({ DB_ID: selfId, SDType: 0 });
    emit('changed');
    deleteConfirmOpen.value = false;
    deleteTarget.value = null;
    if (props.items.length <= 1) {
      close();
    }
  } catch (e) {
    window.alert(e instanceof Error ? e.message : 'Verwijderen mislukt.');
  } finally {
    deleting.value = false;
  }
}

function onCreateSuccess() {
  emit('changed');
  createOpen.value = false;
}
</script>

<template>
  <Dialog :open="modelValue" @update:open="(o) => !o && close()">
    <DialogContent
      :show-close-button="true"
      :class="cn('max-h-[min(85vh,560px)] overflow-y-auto border border-white/[0.08] bg-[#141518] p-0 sm:max-w-md')"
    >
      <DialogHeader class="border-b border-white/[0.06] px-4 py-3 text-left">
        <DialogTitle class="text-base font-semibold text-white">Mijn speeddates</DialogTitle>
        <DialogDescription class="text-sm text-white/50">
          Je geplaatste speeddates en bewerken of verwijderen.
        </DialogDescription>
      </DialogHeader>

      <div class="px-4 py-3">
        <p v-if="!hasRows" class="text-sm text-white/50">Geen eigen speeddates.</p>
        <ul v-else class="space-y-3">
          <li
            v-for="row in items"
            :key="row.db_id"
            class="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 text-sm"
          >
            <div class="font-medium text-white">{{ row.account_id }}</div>
            <div class="mt-1 line-clamp-2 text-xs text-white/60">{{ row.personal_text }}</div>
            <div class="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" @click="openEdit(row)">
                Bewerken
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                @click="confirmDelete(row)"
              >
                Verwijderen
              </Button>
            </div>
          </li>
        </ul>
      </div>

      <DialogFooter class="border-t border-white/[0.06] px-4 py-3 sm:justify-end">
        <Button type="button" variant="ghost" @click="close">Sluiten</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <SpeedDateCreateDialog
    :key="`${editId ?? 'new'}-${editInitial?.db_id ?? 0}`"
    v-model="createOpen"
    :mode="editMode"
    :edit-id-speed="editId"
    :initial="editInitial"
    @success="onCreateSuccess"
  />

  <AlertDialog v-model:open="deleteConfirmOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Speeddate verwijderen?</AlertDialogTitle>
        <AlertDialogDescription>
          Dit verwijdert je huidige speeddate-post. Dit kan niet ongedaan worden gemaakt.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="deleting">Annuleren</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          :disabled="deleting"
          @click="doDelete"
        >
          {{ deleting ? 'Bezig…' : 'Verwijderen' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
