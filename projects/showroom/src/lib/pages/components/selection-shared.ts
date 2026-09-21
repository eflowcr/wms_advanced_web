/**
 * Lo que las fichas de Checkbox y Radio dicen igual, como comparten selection.types.ts.
 * El Toggle no lee de acá: su pista tiene otra forma y otros tokens.
 */

import { computedOf, formatBox, orNotMeasured, rectOf } from './measure';

/** Tokens de ambos controles de selección, en el orden en que los muestran las páginas. */
export const SELECTION_ANATOMY = [
  { part: 'Fondo sin marcar', token: '--color-surface' },
  { part: 'Borde sin marcar', token: '--color-border-strong' },
  { part: 'Fondo y borde al marcar, y borde en hover', token: '--color-bg-primary' },
  { part: 'Check, guion y punto interior', token: '--color-text-on-primary' },
  { part: 'Ancho del borde de la caja', token: '--border-width-selection' },
  { part: 'Fondo deshabilitado sin marcar', token: '--color-bg-secondary' },
  { part: 'Borde deshabilitado sin marcar', token: '--color-border' },
  { part: 'Fondo y borde deshabilitado al marcar, y texto de la fila', token: '--color-text-disabled' },
  { part: 'Anillo de foco (las dos bandas)', token: '--focus-ring-shadow' },
  { part: 'Color del anillo', token: '--color-focus-ring' },
] as const;

/**
 * Caja medida. declared, token y used son tres respuestas distintas al ancho del
 * borde; se muestran las tres porque no coinciden, y ese es el hallazgo.
 */
export interface SelectionBox {
  /** Tamaño medido sobre el control renderizado. */
  readonly size: string;
  /** Lo que el componente escribió en el elemento: var(--border-width-selection). */
  readonly declared: string;
  /** A qué resuelve ese token: un ancho subpíxel. */
  readonly token: string;
  /** Lo que el navegador terminó pintando, que no es lo mismo. */
  readonly used: string;
}

/** Marcador hasta que el primer render tenga algo que medir. */
export const SELECTION_BOX: SelectionBox = {
  size: '…',
  declared: '…',
  token: '…',
  used: '…',
};

/** Lee la caja marcada con data-measure-box en cualquiera de las dos páginas. Ver SelectionBox. */
export function readSelectionBox(root: ParentNode): SelectionBox {
  const input = root.querySelector<HTMLElement>('[data-measure-box] input');
  const rect = rectOf(root, '[data-measure-box] input');
  return {
    size: formatBox(rect),
    declared: orNotMeasured(input?.style.borderWidth),
    token: computedOf(input, '--border-width-selection'),
    used: computedOf(input, 'border-top-width'),
  };
}
