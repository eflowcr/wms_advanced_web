/**
 * Lo que las fichas de Checkbox y Radio dicen igual, como comparten selection.types.ts.
 * El Toggle no lee de acá: su pista tiene otra forma y otros tokens.
 */

import { computedOf, formatBox, orNotMeasured, rectOf } from './measure';

/**
 * Tokens de ambos controles de selección, en el orden en que los muestran las páginas.
 * `part` es la clave del texto: la traduce la celda de cada página.
 * t(showroom.common.selection.anatomy.uncheckedBackground,
 *   showroom.common.selection.anatomy.uncheckedBorder,
 *   showroom.common.selection.anatomy.checkedFill, showroom.common.selection.anatomy.glyph,
 *   showroom.common.selection.anatomy.borderWidth,
 *   showroom.common.selection.anatomy.disabledBackground,
 *   showroom.common.selection.anatomy.disabledBorder,
 *   showroom.common.selection.anatomy.disabledChecked,
 *   showroom.common.selection.anatomy.focusRing,
 *   showroom.common.selection.anatomy.focusRingColour)
 */
export const SELECTION_ANATOMY = [
  { part: 'showroom.common.selection.anatomy.uncheckedBackground', token: '--color-surface' },
  { part: 'showroom.common.selection.anatomy.uncheckedBorder', token: '--color-border-strong' },
  { part: 'showroom.common.selection.anatomy.checkedFill', token: '--color-bg-primary' },
  { part: 'showroom.common.selection.anatomy.glyph', token: '--color-text-on-primary' },
  { part: 'showroom.common.selection.anatomy.borderWidth', token: '--border-width-selection' },
  { part: 'showroom.common.selection.anatomy.disabledBackground', token: '--color-bg-secondary' },
  { part: 'showroom.common.selection.anatomy.disabledBorder', token: '--color-border' },
  { part: 'showroom.common.selection.anatomy.disabledChecked', token: '--color-text-disabled' },
  { part: 'showroom.common.selection.anatomy.focusRing', token: '--focus-ring-shadow' },
  { part: 'showroom.common.selection.anatomy.focusRingColour', token: '--color-focus-ring' },
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
