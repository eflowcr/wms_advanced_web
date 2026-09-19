import type { ConnectedPosition } from '@angular/cdk/overlay';
import { ABOVE, AFTER, BEFORE, BELOW } from '../overlay/connected-overlay';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Preferred placement first, its opposite second. The CDK walks the list and
 * takes the first one that fits, which is the automatic flip: a tooltip cut
 * off by the edge of the window is a useless tooltip.
 *
 * There is no offset between the control and the tooltip. A gap would be dead
 * space the pointer has to cross, and WCAG 2.2 1.4.13 requires the tooltip to
 * stay open while the pointer travels into it.
 */
export const TOOLTIP_POSITIONS: Readonly<Record<TooltipPosition, readonly ConnectedPosition[]>> = {
  top: [ABOVE, BELOW],
  bottom: [BELOW, ABOVE],
  left: [BEFORE, AFTER],
  right: [AFTER, BEFORE],
};

/**
 * Appearance, entirely from tokens: `--color-neutral-solid` behind
 * `--color-text-on-primary`, `--radius-sm`, `--shadow-md` and the `caption`
 * type scale. No raw value, so gate 10 reads this string like any other.
 */
export const TOOLTIP_CLASSES =
  'bg-neutral-solid text-on-primary rounded-sm shadow-md text-caption px-2 py-1 max-w-64';

/**
 * Delay before showing, in milliseconds.
 *
 * It exists so that sweeping the pointer across a toolbar does not fire five
 * tooltips on the way past. There is deliberately NO hide delay for focus loss
 * or Escape: those are explicit dismissals and must be immediate.
 */
export const TOOLTIP_SHOW_DELAY_MS = 150;

/**
 * Grace period between the pointer leaving the control and the tooltip
 * closing, in milliseconds.
 *
 * This is NOT a timed auto-dismiss -- an open tooltip under the pointer never
 * closes on its own. It is the window in which the pointer can travel from the
 * control onto the tooltip, which WCAG 2.2 1.4.13 ("Hoverable") requires.
 * Entering the tooltip cancels it.
 */
export const TOOLTIP_POINTER_GRACE_MS = 100;
