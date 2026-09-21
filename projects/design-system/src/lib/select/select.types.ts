import {
  LISTBOX_OPTION_BASE_CLASSES,
  LISTBOX_PANEL_CLASSES,
  LISTBOX_SELECTED_WEIGHT,
  listboxOptionClasses,
} from '../listbox/listbox.types';

/**
 * Una fila del panel. `label` es el texto que se lee, ya traducido (ADR 0008).
 * `value` es lo que recibe el formulario y es `unknown` a propósito: un id, un
 * código, un miembro de enum o un objeto entero son todos legítimos, y estrecharlo
 * acá empujaría a cada consumidor a un cast.
 */
export interface SelectOption {
  label: string;
  value: unknown;
}

/**
 * EL PANEL Y LAS FILAS VIVEN EN `listbox/`, y este archivo solo los nombra. Se
 * mudaron en DS-3 con la llegada de `ewms-search-select`, porque HG-04 prohíbe un
 * segundo panel o un segundo teclado. Del Select no cambió nada: estos son los
 * nombres que su plantilla y su spec ya usaban, que es lo que hizo demostrable la
 * extracción.
 * El scroll virtual para listas de más de cien opciones sigue ausente a propósito:
 * es una optimización sin consumidor, y la respuesta a una lista así de larga es
 * `ewms-search-select`, que pagina.
 */
export const SELECT_PANEL_CLASSES = LISTBOX_PANEL_CLASSES;
export const SELECT_OPTION_BASE_CLASSES = LISTBOX_OPTION_BASE_CLASSES;
export const SELECT_SELECTED_WEIGHT = LISTBOX_SELECTED_WEIGHT;
export const selectOptionClasses = listboxOptionClasses;
