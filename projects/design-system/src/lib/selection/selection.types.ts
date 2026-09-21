/**
 * Lo que comparten Checkbox y Radio: una caja de 18x18 con borde, un glifo que
 * aparece al encenderse y una etiqueta que es parte del blanco. Solo cambian el
 * radio de esquina y el glifo, así que solo eso se escribe dos veces.
 * NO usan la escala 32/40/48: una casilla no se dimensiona para alinearse con un
 * botón sino para ir al lado de una línea de texto, y hay un solo tamaño.
 */

/** 18x18. `size-*` es base 4 px, así que 4.5 pasos son 18 px. */
export const SELECTION_BOX_SIZE_CLASS = 'size-4.5';

/** El borde de 1.5 px, del token. Como estilo y no como utilidad: los anchos de
 * borde de Tailwind son píxeles enteros y un valor crudo lo rechaza la compuerta 10. */
export const SELECTION_BORDER_WIDTH = 'var(--border-width-selection)';

/**
 * La fila entera es el blanco, etiqueta incluida: eso compra un `<label>` que
 * envuelve al control nativo, sin JavaScript y sin un par for/id que mantener.
 * `cursor-pointer` va en la fila por lo mismo: la etiqueta no es adorno al lado
 * del control, ES parte del control.
 */
export const SELECTION_ROW_CLASSES = 'inline-flex items-center gap-2 select-none';

/**
 * El control nativo, estilado directo. `appearance-none` quita el widget de la
 * plataforma y deja una caja que pintamos, y sigue siendo un input de verdad:
 * foco real, barra espaciadora, rol y nombre del label que lo envuelve. El glifo
 * es un hermano encima con `pointer-events-none`, porque un input no tiene hijos.
 * La alternativa -esconder el input y pintar un span- es la misma imagen con cada
 * una de esas garantías reimplementada a mano.
 */
export const SELECTION_CONTROL_BASE_CLASSES =
  'appearance-none shrink-0 border-solid outline-none ' +
  'focus-visible:shadow-(--focus-ring-shadow) ' +
  SELECTION_BOX_SIZE_CLASS;

/**
 * Superficie y borde de la caja. `on` cubre Marcado E Indeterminado: la ficha les
 * da el mismo tratamiento y solo el glifo los distingue, que es también por qué
 * el estado no se puede leer del color y por qué `aria-checked` lleva `mixed`.
 * Deshabilitado va primero y no tiene hover.
 */
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

/** El texto y el puntero de la fila, que siguen al estado del control. */
export function selectionRowStateClasses(disabled: boolean): string {
  return disabled ? 'text-disabled cursor-not-allowed' : 'text-primary cursor-pointer';
}

/** El glifo encima de la caja: el tilde, el guion, el punto del radio. Nunca
 * interactivo: cada evento de puntero es del input de abajo. */
export const SELECTION_GLYPH_CLASSES =
  'absolute inset-0 flex items-center justify-center pointer-events-none text-on-primary';
