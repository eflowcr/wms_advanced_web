import {
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
  type ConnectedPosition,
  type OverlayConfig,
  type OverlayRef,
} from '@angular/cdk/overlay';
import type { Injector } from '@angular/core';

/**
 * The CDK overlay setup shared by everything in this library that floats next
 * to a trigger: the Tooltip (PR 1) and the Select's panel (this one).
 *
 * The positions and the strategy are the whole of it, and they are not
 * obvious enough to write twice. Two copies would drift on the flip
 * behaviour, and the second copy is always the one nobody tests at the edge
 * of the viewport.
 *
 * WHAT THIS DOES NOT DO: appearance, portals, focus, or closing. Those differ
 * per consumer and belong to the consumer.
 *
 * Requires `.cdk-overlay-container { position: fixed }`, which arrives with
 * `@angular/cdk/overlay-prebuilt.css` in the shell's styles.css. Without it
 * the computed coordinates are measured against the document instead of the
 * viewport and the panel lands at the foot of the page.
 */

/** Centred on the trigger -- what a tooltip wants. */
export const ABOVE: ConnectedPosition = {
  originX: 'center',
  originY: 'top',
  overlayX: 'center',
  overlayY: 'bottom',
};
export const BELOW: ConnectedPosition = {
  originX: 'center',
  originY: 'bottom',
  overlayX: 'center',
  overlayY: 'top',
};
export const BEFORE: ConnectedPosition = {
  originX: 'start',
  originY: 'center',
  overlayX: 'end',
  overlayY: 'center',
};
export const AFTER: ConnectedPosition = {
  originX: 'end',
  originY: 'center',
  overlayX: 'start',
  overlayY: 'center',
};

/**
 * Flush with the trigger's leading edge -- what a panel wants. A dropdown
 * whose left edge does not line up with its trigger's reads as misplaced,
 * however well centred it is.
 */
export const BELOW_START: ConnectedPosition = {
  originX: 'start',
  originY: 'bottom',
  overlayX: 'start',
  overlayY: 'top',
};
export const ABOVE_START: ConnectedPosition = {
  originX: 'start',
  originY: 'top',
  overlayX: 'start',
  overlayY: 'bottom',
};

/**
 * Preferred placement first, its fallback second.
 *
 * The CDK walks the list and takes the first that fits: that IS the flip. A
 * panel or a tooltip cut off by the edge of the window is useless, so the
 * fallback is not a refinement.
 */
export const PANEL_POSITIONS: readonly ConnectedPosition[] = [BELOW_START, ABOVE_START];

export function createConnectedOverlay(
  injector: Injector,
  origin: HTMLElement,
  positions: readonly ConnectedPosition[],
  config: OverlayConfig = {},
): OverlayRef {
  const positionStrategy = createFlexibleConnectedPositionStrategy(injector, origin)
    .withPositions([...positions])
    // Fixed dimensions, then push: the panel keeps its size and is nudged back
    // inside the viewport rather than being squeezed into a scrollable stub.
    .withFlexibleDimensions(false)
    .withPush(true);

  return createOverlayRef(injector, {
    positionStrategy,
    // Follow the trigger while the page scrolls instead of detaching. A panel
    // that vanishes on the first scroll of a long form is a bug report.
    scrollStrategy: createRepositionScrollStrategy(injector),
    ...config,
  });
}

/** What `createConnectedOverlay` takes: the preferred placement, then fallbacks. */
export type ConnectedPositionList = readonly ConnectedPosition[];
