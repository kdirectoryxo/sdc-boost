<script lang="ts" setup>
import type { DateValue } from '@internationalized/date';
import { DateFormatter, getLocalTimeZone, parseDate, today, toCalendarDate } from '@internationalized/date';
import { Calendar as CalendarIcon } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/lib/view-router/ui/dialog';
import { Button } from '@/lib/view-router/ui/button';
import { Label } from '@/lib/view-router/ui/label';
import { Input } from '@/lib/view-router/ui/input';
import { Checkbox } from '@/lib/view-router/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/lib/view-router/ui/radio-group';
import { Calendar } from '@/lib/view-router/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/lib/view-router/ui/popover';
import { cn } from '@/lib/utils';
import type { SpeedDatingV2Item } from '@/lib/sdc-api-types';
import { editSpeedDate, signupSpeedDate } from '@/lib/sdc-api/speed-dating';
import { getProfileV2 } from '@/lib/sdc-api/profile';
import { resolvePeopleApiMuid } from '@/lib/sdc-api/session-credentials';
import {
  buildSpeedDateInterests,
  formatDaysForApi,
  parseLocationParts,
  parseSpeedDateInterests,
} from '@/lib/speed-date-interests';

const props = defineProps<{
  modelValue: boolean;
  mode: 'create' | 'edit';
  /** Required when mode is edit */
  editIdSpeed?: number | null;
  /** Prefill from API row */
  initial?: SpeedDatingV2Item | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  success: [];
}>();

const submitting = ref(false);
const errorMsg = ref<string | null>(null);

const typeChoice = ref<0 | 1 | 2>(0);
const pickedDate = ref<DateValue | undefined>(today(getLocalTimeZone()));
const datePickerOpen = ref(false);
const defaultPlaceholder = today(getLocalTimeZone());
const tz = getLocalTimeZone();
const dateFormatter = new DateFormatter('nl-NL', { dateStyle: 'long' });
const locationRaw = ref('');
const details = ref('');
const couple = ref(false);
const woman = ref(false);
const man = ref(false);
const trans = ref(false);

const lat = ref(52.5755);
const lon = ref(6.6188);

function resetFromInitial() {
  errorMsg.value = null;
  const row = props.initial;
  if (props.mode === 'edit' && row) {
    typeChoice.value = (row.type === 1 || row.type === 2 ? row.type : 0) as 0 | 1 | 2;
    details.value = row.personal_text ?? '';
    locationRaw.value = row.location || '';
    const bits = parseSpeedDateInterests(row.interests);
    couple.value = bits.couple;
    woman.value = bits.woman;
    man.value = bits.man;
    trans.value = bits.trans;
    if (row.date_list) {
      const first = row.date_list.split('|')[0]?.trim() ?? '';
      const parsed = Date.parse(first);
      if (!Number.isNaN(parsed)) {
        const d = new Date(parsed);
        pickedDate.value = parseDate(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        );
      } else {
        pickedDate.value = today(tz);
      }
    } else {
      pickedDate.value = today(tz);
    }
    if (typeof row.lat === 'number') lat.value = row.lat;
    if (typeof row.lon === 'number') lon.value = row.lon;
  } else {
    typeChoice.value = 0;
    details.value = '';
    locationRaw.value = '';
    couple.value = false;
    woman.value = false;
    man.value = false;
    trans.value = false;
    pickedDate.value = today(tz);
  }
}

watch(
  () => [props.modelValue, props.mode, props.initial?.db_id] as const,
  () => {
    if (props.modelValue) {
      resetFromInitial();
      if (props.mode === 'create') {
        void hydrateCoordsFromProfile();
      }
    }
  }
);

async function hydrateCoordsFromProfile() {
  try {
    const id = await resolvePeopleApiMuid();
    const res = await getProfileV2(id);
    const u = res.info.profile_user;
    if (typeof u.lat === 'number') lat.value = u.lat;
    if (typeof u.lon === 'number') lon.value = u.lon;
    if (!locationRaw.value.trim() && u.location) {
      locationRaw.value = u.location;
    }
  } catch {
    /* keep defaults */
  }
}

function close() {
  emit('update:modelValue', false);
}

const detailsLen = computed(() => details.value.length);
const maxDetails = 250;

const dateButtonLabel = computed(() => {
  const v = pickedDate.value;
  if (!v) return 'Kies een datum';
  return dateFormatter.format(toCalendarDate(v).toDate(tz));
});

const interestsStr = computed(() =>
  buildSpeedDateInterests({
    couple: couple.value,
    woman: woman.value,
    man: man.value,
    trans: trans.value,
  })
);

async function submit() {
  errorMsg.value = null;
  const text = details.value.trim();
  if (text.length < 3) {
    errorMsg.value = 'Vul details in (minimaal een paar woorden).';
    return;
  }
  if (text.length > maxDetails) {
    errorMsg.value = `Maximaal ${maxDetails} tekens.`;
    return;
  }
  const loc = locationRaw.value.trim();
  if (!loc) {
    errorMsg.value = 'Vul een locatie in (Waar).';
    return;
  }
  if (!pickedDate.value) {
    errorMsg.value = 'Kies een datum.';
    return;
  }
  const d = toCalendarDate(pickedDate.value).toDate(tz);
  d.setHours(12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) {
    errorMsg.value = 'Ongeldige datum.';
    return;
  }
  const { country, state, city } = parseLocationParts(loc);
  const days = formatDaysForApi(d);

  submitting.value = true;
  try {
    if (props.mode === 'edit') {
      const id = props.editIdSpeed;
      if (id == null || id <= 0) {
        throw new Error('Geen speeddate-id voor bewerken. Vernieuw de lijst en probeer opnieuw.');
      }
      await editSpeedDate({
        id_speed: id,
        country,
        state,
        city,
        lat: lat.value,
        lon: lon.value,
        days,
        interests: interestsStr.value,
        personal_text: text,
        type: typeChoice.value,
      });
    } else {
      await signupSpeedDate({
        country,
        state,
        city,
        lat: lat.value,
        lon: lon.value,
        days,
        interests: interestsStr.value,
        personal_text: text,
        type: typeChoice.value,
      });
    }
    emit('success');
    close();
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Opslaan mislukt.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog :open="modelValue" @update:open="(o) => !o && close()">
    <DialogContent
      :show-close-button="true"
      :class="
        cn(
          'flex max-h-[min(96dvh,920px)] min-h-0 flex-col gap-0 overflow-hidden border border-white/[0.08] bg-[#141518] p-0 sm:max-w-lg'
        )
      "
    >
      <DialogHeader class="shrink-0 border-b border-white/[0.06] px-4 py-3 text-left">
        <DialogTitle class="text-base font-semibold text-white">
          {{ mode === 'edit' ? 'Speeddate bewerken' : 'Speeddate plaatsen' }}
        </DialogTitle>
        <DialogDescription class="text-xs leading-relaxed text-white/45">
          Max. één actieve speeddate; virtuele dates max. 1 dag. Geen externe contactgegevens in de
          tekst.
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 text-sm text-white/90 [scrollbar-gutter:stable]">
        <div class="space-y-4">

        <div v-if="errorMsg" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {{ errorMsg }}
        </div>

        <div class="space-y-2">
          <Label class="text-white/70">Type</Label>
          <RadioGroup v-model="typeChoice" class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <RadioGroupItem
                id="sd-type-0"
                :value="0"
                class="border-white/[0.12] bg-white/[0.04] text-primary data-[state=checked]:border-primary"
              />
              <Label for="sd-type-0" class="cursor-pointer font-normal text-white/90">Privé locatie</Label>
            </div>
            <div class="flex items-center gap-2">
              <RadioGroupItem
                id="sd-type-1"
                :value="1"
                class="border-white/[0.12] bg-white/[0.04] text-primary data-[state=checked]:border-primary"
              />
              <Label for="sd-type-1" class="cursor-pointer font-normal text-white/90">Openbare locatie</Label>
            </div>
            <div class="flex items-center gap-2">
              <RadioGroupItem
                id="sd-type-2"
                :value="2"
                class="border-white/[0.12] bg-white/[0.04] text-primary data-[state=checked]:border-primary"
              />
              <Label for="sd-type-2" class="cursor-pointer font-normal text-white/90">Virtuele date</Label>
            </div>
          </RadioGroup>
        </div>

        <div class="space-y-2">
          <Label class="text-white/70" for="sd-date">Wanneer</Label>
          <Popover v-model:open="datePickerOpen">
            <PopoverTrigger as-child>
              <Button
                id="sd-date"
                type="button"
                variant="outline"
                :class="
                  cn(
                    'w-full justify-start border-white/[0.08] bg-white/[0.04] text-left font-normal text-white hover:bg-white/[0.06]',
                    !pickedDate && 'text-white/40'
                  )
                "
              >
                <CalendarIcon class="mr-2 h-4 w-4 shrink-0 opacity-70" />
                {{ dateButtonLabel }}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" class="w-auto border border-white/[0.08] bg-[#1a1c1f] p-0 text-white shadow-xl">
              <Calendar
                v-model="pickedDate"
                locale="nl-NL"
                layout="month-and-year"
                :default-placeholder="defaultPlaceholder"
                initial-focus
                class="rounded-md border-0 bg-transparent text-white"
                @update:model-value="datePickerOpen = false"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div class="space-y-2">
          <Label class="text-white/70">Met</Label>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label class="flex cursor-pointer items-center gap-2">
              <Checkbox v-model="couple" />
              <span>Stel Vrouw/Man</span>
            </label>
            <label class="flex cursor-pointer items-center gap-2">
              <Checkbox v-model="woman" />
              <span>Vrouw</span>
            </label>
            <label class="flex cursor-pointer items-center gap-2">
              <Checkbox v-model="man" />
              <span>Man</span>
            </label>
            <label class="flex cursor-pointer items-center gap-2">
              <Checkbox v-model="trans" />
              <span>Transgender</span>
            </label>
          </div>
        </div>

        <div class="space-y-2">
          <Label class="text-white/70" for="sd-loc">Waar</Label>
          <Input
            id="sd-loc"
            v-model="locationRaw"
            placeholder="Stad, Provincie, NL"
            class="border-white/[0.08] bg-white/[0.04] text-white"
          />
        </div>

        <div class="space-y-2">
          <Label class="text-white/70" for="sd-details">Details</Label>
          <textarea
            id="sd-details"
            v-model="details"
            :maxlength="maxDetails"
            rows="5"
            placeholder="Beschrijf je speed date…"
            class="min-h-[120px] w-full resize-y rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p class="text-right text-xs text-white/40">{{ detailsLen }} / {{ maxDetails }}</p>
        </div>
        </div>
      </div>

      <DialogFooter class="shrink-0 border-t border-white/[0.06] px-4 py-3 sm:justify-end">
        <Button type="button" variant="ghost" @click="close">Annuleren</Button>
        <Button type="button" :disabled="submitting" @click="submit">
          {{ submitting ? 'Bezig…' : mode === 'edit' ? 'Opslaan' : 'Speeddate posten' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
