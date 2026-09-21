// Común a Checkbox y Radio, que solo difieren en esquina y glifo. Un tamaño, sin la escala
// 32/40/48: una casilla acompaña una línea de texto, no un botón.

/** 18x18: 4.5 pasos de 4 px. */
export const SELECTION_BOX_SIZE_CLASS = 'size-4.5';

/** 1.5 px como estilo: Tailwind solo tiene anchos enteros y la compuerta 10 rechaza el crudo. */
export const SELECTION_BORDER_WIDTH = 'var(--border-width-selection)';

/** La fila entera, etiqueta incluida, es el blanco: un `<label>` que envuelve, sin for/id. */
export const SELECTION_ROW_CLASSES = 'inline-flex items-center gap-2 select-none';

/** Input nativo sin apariencia: conserva foco, teclado, rol y nombre sin reimplementarlos. */
export const SELECTION_CONTROL_BASE_CLASSES =
  'appearance-none shrink-0 border-solid outline-none ' +
  'focus-visible:shadow-(--focus-ring-shadow) ' +
  SELECTION_BOX_SIZE_CLASS;

/** `on` cubre marcado e indeterminado: mismo tratamiento, solo el glifo los distingue. */
export function selectionBoxClasses(on: boolean, disabled: boolean): string {
  if (disabled) {
    return on
      ? 'bg-(--color-text-disabled) border-(--color-text-disabled)'
      : 'bg-secondary border-(--color-border)';
  }
  return on
    ? 'bg-primary border-(--color-bg-primary)'
    : 'bg-surface border-(--color-border-strong) hover:border-(--color-bg-primary)';
}

export function selectionRowStateClasses(disabled: boolean): string {
  return disabled ? 'text-disabled cursor-not-allowed' : 'text-primary cursor-pointer';
}

/** Hermano encima de la caja (un input no tiene hijos); el puntero va al input de abajo. */
export const SELECTION_GLYPH_CLASSES =
  'absolute inset-0 flex items-center justify-center pointer-events-none text-on-primary';
