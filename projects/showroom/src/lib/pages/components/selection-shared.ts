/**
 * What the Checkbox and the Radio pages say identically, in one place.
 *
 * The two components already share `selection.types.ts` in the library -- one
 * box, one border, one focus ring, one hit-target rule, with only the corner
 * radius and the glyph written twice. Two showroom pages that re-typed that
 * list would be two chances for the sheets to disagree about a thing the code
 * cannot disagree about.
 *
 * The Toggle deliberately does NOT read from here: it shares `FormControlBase`
 * and the row-as-hit-target with those two, and nothing else. Its track is a
 * different shape with different tokens, and folding it in would suggest a
 * kinship the code does not have.
 */

import { computedOf, formatBox, orNotMeasured, rectOf } from './measure';

/** The tokens both selection controls consume, in the order the pages show them. */
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
 * The measured box.
 *
 * `declared`, `token` and `used` are three different answers to "how wide is
 * that border", and the page shows all three on purpose: they do not agree,
 * and the disagreement is the finding.
 */
export interface SelectionBox {
  /** `18 × 18 px`, off the rendered control. */
  readonly size: string;
  /** What the component wrote on the element: `var(--border-width-selection)`. */
  readonly declared: string;
  /** What that token resolves to -- a sub-pixel width. */
  readonly token: string;
  /** What the browser ended up painting, which is not the same thing. */
  readonly used: string;
}

/** The placeholder shown until the first render has something to measure. */
export const SELECTION_BOX: SelectionBox = {
  size: '…',
  declared: '…',
  token: '…',
  used: '…',
};

/**
 * Read the box off whichever of the two pages is rendering.
 *
 * Both sheets tag their measured sample `data-measure-box` and both want the
 * same four answers, so the read lives here rather than twice. The border is
 * asked for three ways deliberately -- see `SelectionBox`.
 */
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
