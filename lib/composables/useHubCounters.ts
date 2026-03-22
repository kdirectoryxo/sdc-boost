import { onUnmounted, ref } from 'vue';

import { countersManager } from '@/lib/counters-manager';

/**
 * Hub shell messenger badge: always the **raw API** `messenger` value from the last
 * counters fetch (same as {@link ChatDialogModule} / {@link useChatWebSocket}).
 *
 * Do **not** use `counters.messenger` from {@link countersManager.getCounters} for
 * display — after refresh it is overwritten with `Math.max(api, sum of local unread)`
 * and can be much larger than the API’s `messenger` (e.g. 3 vs 99).
 * Do **not** use `chatroom` — that is unrelated public-chat activity.
 */
export function useHubCounters() {
  function readMessengerCount(): number {
    return countersManager.getRawApiMessengerCounter() ?? 0;
  }

  const messenger = ref<number>(readMessengerCount());

  const off = countersManager.onUpdate(() => {
    messenger.value = countersManager.getRawApiMessengerCounter() ?? 0;
  });
  onUnmounted(off);

  return { messenger };
}
