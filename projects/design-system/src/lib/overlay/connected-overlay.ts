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
 * El armado de overlay del CDK que comparte todo lo que flota junto a un gatillo:
 * el Tooltip y el panel del Select. Las posiciones y la estrategia no son lo
 * bastante obvias como para escribirlas dos veces, y la segunda copia siempre es
 * la que nadie prueba en el borde del viewport.
 * NO hace apariencia, portales, foco ni cierre: eso cambia por consumidor.
 * Necesita `.cdk-overlay-container { position: fixed }`, que llega con el CSS
 * prearmado del CDK: sin él las coordenadas se miden contra el documento en vez
 * del viewport y el panel aterriza al pie de la página.
 */

/** Centrado sobre el gatillo: lo que quiere un tooltip. */
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

/** Al ras del borde inicial del gatillo: lo que quiere un panel. Un desplegable
 * cuyo borde izquierdo no coincide con el del gatillo se lee mal puesto. */
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

/** La colocación preferida primero y su alternativa después. El CDK recorre la
 * lista y toma la primera que entra: ESO es el volteo, y no es un refinamiento -un
 * panel cortado por el borde de la ventana no sirve-. */
export const PANEL_POSITIONS: readonly ConnectedPosition[] = [BELOW_START, ABOVE_START];

export function createConnectedOverlay(
  injector: Injector,
  origin: HTMLElement,
  positions: readonly ConnectedPosition[],
  config: OverlayConfig = {},
): OverlayRef {
  const positionStrategy = createFlexibleConnectedPositionStrategy(injector, origin)
    .withPositions([...positions])
    // Dimensiones fijas y después empujar: el panel conserva su tamaño y se corre
    // hacia adentro en vez de quedar aplastado en un muñón con scroll.
    .withFlexibleDimensions(false)
    .withPush(true);

  return createOverlayRef(injector, {
    positionStrategy,
    // Sigue al gatillo mientras la página se desplaza en vez de soltarse: un panel
    // que se esfuma al primer scroll de un formulario largo es un reporte de bug.
    scrollStrategy: createRepositionScrollStrategy(injector),
    ...config,
  });
}

/** Lo que toma `createConnectedOverlay`: la preferida y después las alternativas. */
export type ConnectedPositionList = readonly ConnectedPosition[];
