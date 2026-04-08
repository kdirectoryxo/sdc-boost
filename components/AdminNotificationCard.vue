<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
}

const props = defineProps<Props>();

const getActionIcon = () => {
  switch (props.item.action) {
    case 2:
      return { icon: '📷', label: "Foto's" };
    case 3:
      return { icon: '🎥', label: "Video's" };
    case 21:
      return { icon: '🎉', label: "Party's & Events" };
    case 14:
      return { icon: '💳', label: 'Betaling ontvangen' };
    default:
      return { icon: '🔔', label: 'Melding' };
  }
};

const actionInfo = computed(() => getActionIcon());

const stripHtml = (text: string | undefined): string => {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').trim();
};

const getTitle = () => {
  if (props.item.action === 21) {
    if (props.item.extra_data?.title) {
      return props.item.extra_data.title;
    }
    if (props.item.subject && !props.item.subject.includes('//*')) {
      return stripHtml(props.item.subject);
    }
    if (props.item.body) {
      const match = props.item.body.match(/<b[^>]*>([^<]+)<\/b>/);
      if (match) return match[1];
    }
  }

  if (props.item.action === 14 && props.item.subject) {
    return stripHtml(props.item.subject);
  }

  return stripHtml(props.item.subject) || actionInfo.value.label;
};

const title = computed(() => getTitle());

const getBodyContent = () => {
  if (props.item.action === 21) {
    return props.item.body || '';
  }
  return props.item.body || props.item.subject || '';
};

const bodyContent = computed(() => getBodyContent());

const formatBody = (body: string | undefined) => {
  if (!body) return '';
  return body.replace(/<[^>]*>/g, '').trim();
};

const hasHtml = (text: string | undefined) => {
  if (!text) return false;
  return /<[^>]+>/.test(text);
};
</script>

<template>
  <div
    class="relative overflow-hidden rounded-[10px] border border-white/[0.06] border-l-[3px] border-l-blue-500/40 transition-all duration-200 ease-in-out hover:border-white/10 hover:border-l-blue-500/60 hover:bg-white/[0.05]"
    :class="
      props.index !== undefined
        ? props.index % 2 === 0
          ? 'bg-white/[0.025]'
          : 'bg-white/[0.035]'
        : 'bg-white/[0.03]'
    "
  >
    <div class="flex items-start gap-3 px-3.5 py-3">
      <div
        class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-lg"
      >
        {{ actionInfo.icon }}
      </div>

      <div class="min-w-0 flex-1">
        <div class="mb-1.5 flex items-center justify-between gap-2.5">
          <p class="flex-1 text-sm font-semibold tracking-tight text-white">
            {{ title }}
          </p>
          <p class="shrink-0 text-xs font-medium text-gray-500">
            {{ item.timed }}
          </p>
        </div>

        <div class="text-[13px] leading-relaxed text-gray-300">
          <div
            v-if="hasHtml(bodyContent)"
            v-html="bodyContent"
            class="[&_a]:text-blue-400 [&_a]:underline [&_a]:transition-colors [&_a:hover]:text-blue-300 [&_b]:font-semibold [&_b]:text-gray-200 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_p]:my-2"
          />
          <p v-else>{{ formatBody(bodyContent) }}</p>
        </div>

        <div
          v-if="item.action_status === 1"
          class="mt-2 inline-flex items-center gap-1 rounded border border-green-400/20 bg-green-400/10 px-2 py-1"
        >
          <span class="text-[10px] font-medium text-green-400">✓ Verwerkt</span>
        </div>
      </div>
    </div>
  </div>
</template>
