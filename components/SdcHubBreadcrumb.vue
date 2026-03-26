<script setup lang="ts">
import { computed } from 'vue';

import {
  buildSdcHubBreadcrumbs,
  type SdcHubBreadcrumbItem,
} from '@/lib/view-router/breadcrumbs';
import { getBoostViewRouterUrl, navigateBoostViewRouterPath } from '@/lib/view-router/routes';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/lib/view-router/ui/breadcrumb';

const props = defineProps<{
  boostPath: string;
  /** When on profile route, optional display name from loaded profile */
  profileTitle?: string | null;
}>();

const items = computed((): SdcHubBreadcrumbItem[] =>
  buildSdcHubBreadcrumbs(props.boostPath, {
    profileTitle: props.profileTitle ?? null,
  }),
);

function onCrumbClick(event: MouseEvent, to: string) {
  if (event.button !== 0) return;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateBoostViewRouterPath(to);
}
</script>

<template>
  <Breadcrumb class="min-w-0 flex-1">
    <BreadcrumbList class="text-sm text-white/70">
      <template v-for="(item, index) in items" :key="`${index}-${item.label}`">
        <BreadcrumbSeparator v-if="index > 0" class="[&>svg]:text-white/25" />
        <BreadcrumbItem class="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <BreadcrumbLink v-if="item.to" as-child>
            <a
              class="min-w-0 truncate transition-colors hover:text-white hover:underline underline-offset-2"
              :href="getBoostViewRouterUrl(item.to)"
              @click="onCrumbClick($event, item.to)"
            >
              {{ item.label }}
            </a>
          </BreadcrumbLink>
          <BreadcrumbPage v-else class="min-w-0 truncate font-medium text-white">
            {{ item.label }}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>
