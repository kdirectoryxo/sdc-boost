<script lang="ts" setup>
import { Icon } from '@iconify/vue';
import type { PeopleTabId } from '@/lib/view-router/routes';
import { Badge } from '@/lib/view-router/ui/badge';
import { Button } from '@/lib/view-router/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/lib/view-router/ui/dialog';
import { TooltipProvider } from '@/lib/view-router/ui/tooltip';
import { cn } from '@/lib/utils';

defineProps<{
  modelValue: boolean;
  activeTab: PeopleTabId;
  viewedCount: number;
}>();

const emit = defineEmits<{
  close: [];
  'tab-change': [tab: PeopleTabId];
}>();

function handleClose() {
  emit('close');
}

function onOpenChange(open: boolean) {
  if (!open) handleClose();
}

function handleTabChange(tab: PeopleTabId) {
  emit('tab-change', tab);
}
</script>

<template>
  <Dialog :open="modelValue" @update:open="onOpenChange">
    <DialogContent
      :show-close-button="false"
      :class="
        cn(
          'flex max-h-[min(95vh,900px)] min-h-0 w-[95vw] max-w-[95vw] flex-col gap-0 overflow-hidden border border-white/[0.06] bg-[#131517] p-0 shadow-2xl sm:max-h-[90vh] sm:w-[90vw] sm:max-w-[90vw]',
        )
      "
      :overlay-class="'bg-black/80 backdrop-blur-md'"
    >
      <DialogHeader
        class="flex shrink-0 flex-row flex-wrap items-center gap-2 border-b border-white/[0.06] bg-[#1a1d21] px-3 py-2.5 text-left sm:gap-4 sm:px-3.5"
      >
        <div class="flex min-w-0 items-center gap-2">
          <div
            class="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-600 text-white sm:size-7"
          >
            <Icon icon="mdi:account-group" width="16" height="16" />
          </div>
          <DialogTitle class="text-sm font-semibold tracking-tight text-white">People</DialogTitle>
        </div>

        <div
          class="ml-auto flex flex-wrap justify-end gap-0.5 rounded-lg bg-white/[0.04] p-0.5"
          role="tablist"
          aria-label="People tabs"
        >
          <Button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'viewed'"
            variant="ghost"
            size="sm"
            :class="
              cn(
                'h-8 gap-1.5 rounded-md px-3.5 text-[13px] font-medium text-muted-foreground hover:text-foreground',
                activeTab === 'viewed' && 'bg-white/[0.08] text-white shadow-none',
              )
            "
            @click="handleTabChange('viewed')"
          >
            Bekeken
            <Badge
              v-if="viewedCount > 0"
              variant="destructive"
              class="h-4 min-w-4 rounded-md px-1.5 text-[10px] font-semibold tabular-nums"
            >
              {{ viewedCount > 99 ? '99+' : viewedCount }}
            </Badge>
          </Button>
          <Button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'online'"
            variant="ghost"
            size="sm"
            :class="
              cn(
                'h-8 rounded-md px-3.5 text-[13px] font-medium text-muted-foreground hover:text-foreground',
                activeTab === 'online' && 'bg-white/[0.08] text-white shadow-none',
              )
            "
            @click="handleTabChange('online')"
          >
            Online
          </Button>
          <Button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'latest'"
            variant="ghost"
            size="sm"
            :class="
              cn(
                'h-8 rounded-md px-3.5 text-[13px] font-medium text-muted-foreground hover:text-foreground',
                activeTab === 'latest' && 'bg-white/[0.08] text-white shadow-none',
              )
            "
            @click="handleTabChange('latest')"
          >
            Nieuwe leden
          </Button>
          <Button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'featured'"
            variant="ghost"
            size="sm"
            :class="
              cn(
                'h-8 rounded-md px-3.5 text-[13px] font-medium text-muted-foreground hover:text-foreground',
                activeTab === 'featured' && 'bg-white/[0.08] text-white shadow-none',
              )
            "
            @click="handleTabChange('featured')"
          >
            Spotlight leden
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          class="size-8 shrink-0 text-muted-foreground hover:bg-white/[0.06] hover:text-white"
          aria-label="Close"
          @click="handleClose"
        >
          <Icon icon="mdi:close" width="18" height="18" />
        </Button>
      </DialogHeader>

      <DialogDescription class="sr-only">
        Bekijk bekeken, online, nieuwe en spotlight-leden. Wissel van lijst met de tabbladen hierboven.
      </DialogDescription>

      <TooltipProvider :delay-duration="200">
        <div class="min-h-0 flex-1 overflow-hidden">
          <slot />
        </div>
      </TooltipProvider>
    </DialogContent>
  </Dialog>
  <slot name="after" />
</template>
