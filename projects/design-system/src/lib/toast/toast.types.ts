import type { FeedbackVariant } from '../feedback/feedback.types';

/**
 * One message in the queue, as the outlet receives it.
 *
 * `id` is what the outlet tracks by and what `dismiss` takes. It is generated
 * by the service and never by a consumer: two screens that both invent "1"
 * would dismiss each other's messages.
 */
export interface Toast {
  readonly id: number;
  readonly variant: FeedbackVariant;
  /** Already translated by whoever called `show` (ADR 0008). */
  readonly message: string;
}

/** The token the service reads its default lifetime from. */
export const TOAST_DURATION_TOKEN = '--duration-toast';

/**
 * The floating stack.
 *
 * BOTTOM RIGHT, and the sheet does not say so -- it says "flotante" and
 * nothing else. Reported as a hallazgo rather than written into the sheet:
 * where the stack sits is a design decision, not something the code gets to
 * settle on its own. Bottom right is what this build uses meanwhile, because
 * it is the corner furthest from the content a WMS operator is reading and the
 * one that does not cover the header.
 *
 * `z-10` puts the stack over page content and UNDER the CDK's overlay
 * container, which sits far higher. A toast raised while a dialog is open is
 * therefore behind it -- deliberate: the dialog is modal, and a message
 * floating over a modal invites a click that the modal is there to prevent.
 */
export const TOAST_OUTLET_CLASSES =
  'fixed right-4 bottom-4 z-10 flex flex-col items-end gap-2 pointer-events-none';

/**
 * One toast: white surface, the elevation of a popover, and a 4 px leading
 * accent in the family's solid.
 *
 * `pointer-events-auto` undoes the container's `pointer-events-none`. The
 * container spans a corner of the viewport and must not swallow clicks meant
 * for the page under it; the toasts themselves are real content and take
 * their own.
 */
export const TOAST_CLASSES =
  'pointer-events-auto flex max-w-96 items-stretch overflow-hidden rounded-md border shadow-md';

/**
 * The padded part, inside the accent.
 *
 * The padding is here and NOT on the toast itself, so the 4 px bar reaches the
 * top and the bottom edge. On the outer box, `self-stretch` stretches a child
 * to the content box -- which excludes the padding -- and the accent came out
 * inset by twelve pixels at each end, which reads as a mistake rather than as
 * an accent.
 */
export const TOAST_BODY_CLASSES = 'flex min-w-0 items-center gap-2 px-4 py-3';
