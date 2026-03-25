<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed, inject } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { UI_TELEPORT_TARGET } from "@/lib/ui/teleport-target"
import { X } from "lucide-vue-next"
import {
  DialogClose,
  DialogContent,
  DialogPortal,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"
import DialogOverlay from "./DialogOverlay.vue"

/**
 * Selectors for floating-UI surfaces that are teleported as portal siblings
 * but logically belong to the dialog.  Clicks inside these should NOT dismiss
 * the dialog.  Extend this list when new floating primitives are added.
 */
const FLOATING_UI_SELECTORS = [
  '[data-slot="popover-content"]',
  '[data-slot="select-content"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="combobox-content"]',
  '[data-slot="tooltip-content"]',
].join(', ')

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<DialogContentProps & { class?: HTMLAttributes["class"], showCloseButton?: boolean, overlayClass?: HTMLAttributes["class"], overlayStyle?: HTMLAttributes["style"] }>(), {
  showCloseButton: true,
})
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, "class", "overlayClass", "overlayStyle", "showCloseButton")

const forwarded = useForwardPropsEmits(delegatedProps, emits)

const teleportTarget = inject(UI_TELEPORT_TARGET, null)
/** Shadow DOM apps must teleport inside the shadow root or dialog content has no styles. */
const portalTo = computed(() => teleportTarget?.value ?? "body")

/**
 * Shadow-DOM fix for DismissableLayer's outside-click detection.
 *
 * Reka's `isLayerExist()` relies on `event.target.closest("[data-dismissable-layer]")`
 * to decide whether a click landed on a higher layer (e.g. a popover opened
 * from within the dialog).  In a shadow DOM the event target is retargeted to
 * the shadow host at `document` level, so `closest()` never finds anything
 * and the dialog always treats the click as "outside" → dismisses.
 *
 * We recover the real target via `composedPath()` (still valid because we run
 * synchronously during the original `pointerdown` handler) and prevent the
 * dismiss when the click landed inside a known floating-UI surface.
 */
function onPointerDownOutside(event: CustomEvent<{ originalEvent: PointerEvent }>) {
  const originalEvent = event.detail?.originalEvent
  if (!originalEvent) return

  const realTarget =
    (originalEvent.composedPath?.()[0] as Element | undefined) ?? originalEvent.target
  if (realTarget instanceof Element && realTarget.closest(FLOATING_UI_SELECTORS)) {
    event.preventDefault()
  }
}
</script>

<template>
  <DialogPortal :to="portalTo">
    <DialogOverlay :class="props.overlayClass" :style="props.overlayStyle" />
    <DialogContent
      data-slot="dialog-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'pointer-events-auto bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg',
          props.class,
        )"
      @pointer-down-outside="onPointerDownOutside"
    >
      <slot />

      <DialogClose
        v-if="showCloseButton"
        data-slot="dialog-close"
        class="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      >
        <X />
        <span class="sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
