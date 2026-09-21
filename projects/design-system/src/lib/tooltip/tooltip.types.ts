import type { ConnectedPosition } from '@angular/cdk/overlay';
import { ABOVE, AFTER, BEFORE, BELOW } from '../overlay/connected-overlay';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Preferida y opuesta: el CDK toma la primera que entra (volteo automático). Sin separación,
 * porque WCAG 2.2 1.4.13 exige que siga abierto mientras el puntero viaja hacia él.
 */
export const TOOLTIP_POSITIONS: Readonly<Record<TooltipPosition, readonly ConnectedPosition[]>> = {
  top: [ABOVE, BELOW],
  bottom: [BELOW, ABOVE],
  left: [BEFORE, AFTER],
  right: [AFTER, BEFORE],
};

export const TOOLTIP_CLASSES =
  'bg-neutral-solid text-on-primary rounded-sm shadow-md text-caption px-2 py-1 max-w-64';

/** Ms: cruzar una barra de herramientas no dispara cinco tooltips. Foco y Escape no esperan. */
export const TOOLTIP_SHOW_DELAY_MS = 150;

/** Ms para viajar del control al panel («Hoverable», WCAG 2.2 1.4.13); no es un cierre por tiempo. */
export const TOOLTIP_POINTER_GRACE_MS = 100;
