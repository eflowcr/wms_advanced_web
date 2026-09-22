// Aspecto y teclado de toda lista flotante, compartidos por Select y Search Select (HG-04
// de REQ-FE-DS3-001). Ver vault: Select.

/**
 * La altura máxima con scroll no es un tope de filas. El ancho completo es obligatorio: el
 * panel del CDK es flex y, sin él, la lista sale más angosta que el campo.
 */
export const LISTBOX_PANEL_CLASSES =
  'w-full bg-surface rounded-control shadow-md py-1 max-h-72 overflow-y-auto list-none p-0';

export const LISTBOX_OPTION_BASE_CLASSES =
  'flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer';

/** Seleccionada (el valor) y activa (el teclado, con el fondo del hover) son independientes. */
export function listboxOptionClasses(selected: boolean, active: boolean): string {
  const classes = [LISTBOX_OPTION_BASE_CLASSES];
  if (active) {
    classes.push('bg-ghost-hover');
  }
  if (selected) {
    classes.push('text-(--color-bg-primary)');
  }
  return classes.join(' ');
}

/** Como token: ADR 0009 borra el tema de Tailwind y una utilidad de peso compila a nada. */
export const LISTBOX_SELECTED_WEIGHT = 'var(--text-control-selected-weight)';

/**
 * Frena en los extremos, al revés que el grupo de cards: en una lista que se lee, llegar al
 * final es información. `from < 0` es «en ningún lado».
 */
export function moveActiveIndex(from: number, delta: number, count: number): number {
  if (count === 0) {
    return -1;
  }
  const next = from < 0 ? (delta > 0 ? 0 : count - 1) : from + delta;
  return Math.min(count - 1, Math.max(0, next));
}
