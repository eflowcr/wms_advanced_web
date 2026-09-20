/**
 * Lo que comparte toda lista flotante: cómo se ve y cómo la mueven las flechas.
 * Extraído en DS-3 por HG-04 de REQ-FE-DS3-001, que prohíbe un segundo overlay o
 * un segundo teclado junto a `ewms-select`: así el Select y el Search Select no
 * pueden derivar en qué es una fila activa ni en si la lista da la vuelta.
 */

/**
 * El panel flotante. `--shadow-md` es el nivel de desplegable de la escala de
 * elevación, y `max-h-72` con scroll evita que una lista larga se salga por
 * abajo: NO es un tope de cuántas filas se pueden pasar.
 * `w-full` carga peso: la hoja del CDK hace de `.cdk-overlay-pane` un contenedor
 * flex, y un item flex se dimensiona por su contenido, así que sin esto la lista
 * sale más angosta que el campo.
 */
export const LISTBOX_PANEL_CLASSES =
  'w-full bg-surface rounded-control shadow-md py-1 max-h-72 overflow-y-auto list-none p-0';

export const LISTBOX_OPTION_BASE_CLASSES =
  'flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer';

/**
 * Las dos cosas que puede ser una fila, y son independientes. SELECCIONADA es
 * «este es el valor actual»; ACTIVA es «acá está el teclado», con el mismo fondo
 * que produce el ratón, para que una lista movida con flechas se vea igual que
 * una bajo el puntero. Una fila suele ser las dos.
 */
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

/** El peso de la fila elegida, leído como token: ADR 0009 borra el tema de
 * Tailwind, así que una utilidad de font-weight compila a nada. */
export const LISTBOX_SELECTED_WEIGHT = 'var(--text-control-selected-weight)';

/**
 * Adónde va el teclado. FRENA EN LOS EXTREMOS EN VEZ DE DAR LA VUELTA, al revés
 * que el grupo de cards y a propósito: un panel es una lista que se está leyendo
 * y llegar al final es información, mientras que un grupo de radios es un
 * conjunto cerrado de cuatro cosas. `from < 0` es «todavía en ningún lado».
 */
export function moveActiveIndex(from: number, delta: number, count: number): number {
  if (count === 0) {
    return -1;
  }
  const next = from < 0 ? (delta > 0 ? 0 : count - 1) : from + delta;
  return Math.min(count - 1, Math.max(0, next));
}
