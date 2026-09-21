import type { ConnectedPosition } from '@angular/cdk/overlay';
import { ABOVE, AFTER, BEFORE, BELOW } from '../overlay/connected-overlay';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * La colocación preferida primero y su opuesta después: el CDK toma la primera que
 * entra, y eso es el volteo automático. No hay separación entre el control y el
 * tooltip: un hueco sería espacio muerto que el puntero tiene que cruzar, y WCAG
 * 2.2 1.4.13 exige que siga abierto mientras viaja hacia él.
 */
export const TOOLTIP_POSITIONS: Readonly<Record<TooltipPosition, readonly ConnectedPosition[]>> = {
  top: [ABOVE, BELOW],
  bottom: [BELOW, ABOVE],
  left: [BEFORE, AFTER],
  right: [AFTER, BEFORE],
};

/** Apariencia, entera desde tokens: `--color-neutral-solid` bajo
 * `--color-text-on-primary`, `--radius-sm`, `--shadow-md` y la escala `caption`. */
export const TOOLTIP_CLASSES =
  'bg-neutral-solid text-on-primary rounded-sm shadow-md text-caption px-2 py-1 max-w-64';

/** Espera antes de mostrar, en milisegundos: existe para que pasar el puntero por
 * una barra de herramientas no dispare cinco tooltips de paso. NO hay espera para
 * ocultar por pérdida de foco ni por Escape: esos son descartes explícitos. */
export const TOOLTIP_SHOW_DELAY_MS = 150;

/**
 * Gracia entre que el puntero sale del control y el tooltip cierra, en
 * milisegundos. NO es un cierre por tiempo -uno abierto bajo el puntero no cierra
 * nunca-: es la ventana en la que el puntero puede viajar del control al tooltip,
 * que es lo que exige «Hoverable» de WCAG 2.2 1.4.13. Entrar en él la cancela.
 */
export const TOOLTIP_POINTER_GRACE_MS = 100;
