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
 * Overlay común a Tooltip, Select y Search Select; apariencia, foco y cierre son de cada uno.
 * Requiere el CSS prearmado del CDK (contenedor fijo): sin él, el panel cae al pie de la página.
 */

/** Centradas: para un tooltip. */
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

/** Al ras del borde inicial: para un panel, que desalineado se lee mal puesto. */
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

/** El CDK toma la primera que entra: ese es el volteo. */
export const PANEL_POSITIONS: readonly ConnectedPosition[] = [BELOW_START, ABOVE_START];

export function createConnectedOverlay(
  injector: Injector,
  origin: HTMLElement,
  positions: readonly ConnectedPosition[],
  config: OverlayConfig = {},
): OverlayRef {
  const positionStrategy = createFlexibleConnectedPositionStrategy(injector, origin)
    .withPositions([...positions])
    // Tamaño fijo y empuje: se corre hacia adentro en vez de aplastarse.
    .withFlexibleDimensions(false)
    .withPush(true);

  return createOverlayRef(injector, {
    positionStrategy,
    // Sigue al gatillo al desplazarse, en vez de soltarse.
    scrollStrategy: createRepositionScrollStrategy(injector),
    ...config,
  });
}

/** La preferida y después las alternativas. */
export type ConnectedPositionList = readonly ConnectedPosition[];
