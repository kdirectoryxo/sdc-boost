<script setup lang="ts">
import { computed } from 'vue';
import { IconChevronRight } from '@tabler/icons-vue';

import {
  buildSdcHubBreadcrumbs,
  type SdcHubBreadcrumbItem,
} from '@/lib/view-router/breadcrumbs';
import { getBoostViewRouterUrl, navigateBoostViewRouterPath } from '@/lib/view-router/routes';

const props = defineProps<{
  boostPath: string;
  /** When on profile route, optional display name from loaded profile */
  profileTitle?: string | null;
}>();

const items = computed((): SdcHubBreadcrumbItem[] =>
  buildSdcHubBreadcrumbs(props.boostPath, {
    profileTitle: props.profileTitle ?? null,
  })
);

function onCrumbClick(event: MouseEvent, to: string) {
  if (event.button !== 0) return;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateBoostViewRouterPath(to);
}
</script>

<template>
  <nav class="min-w-0 flex-1" aria-label="Breadcrumb">
    <ol class="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
      <li
        v-for="(item, index) in items"
        :key="`${index}-${item.label}`"
        class="inline-flex min-w-0 max-w-full items-center gap-1.5"
      >
        <IconChevronRight
          v-if="index > 0"
          class="size-4 shrink-0 text-white/25"
          aria-hidden="true"
        />
        <a
          v-if="item.to"
          class="min-w-0 truncate text-white/70 transition-colors hover:text-white hover:underline underline-offset-2"
          :href="getBoostViewRouterUrl(item.to)"
          @click="onCrumbClick($event, item.to)"
        >
          {{ item.label }}
        </a>
        <span
          v-else
          class="min-w-0 truncate font-medium text-white"
          aria-current="page"
        >
          {{ item.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>
