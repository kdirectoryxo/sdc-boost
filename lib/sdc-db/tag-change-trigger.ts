/**
 * Tag change trigger for reactivity
 * Increments a counter when tags change to trigger reactive updates
 */

import { ref } from 'vue';

export const tagChangeTrigger = ref(0);

/**
 * Trigger a tag change (increments counter to trigger reactivity)
 */
export function triggerTagChange(): void {
  tagChangeTrigger.value++;
}
