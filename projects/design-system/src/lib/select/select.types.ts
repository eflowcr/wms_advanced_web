import {
  LISTBOX_OPTION_BASE_CLASSES,
  LISTBOX_PANEL_CLASSES,
  LISTBOX_SELECTED_WEIGHT,
  listboxOptionClasses,
} from '../listbox/listbox.types';

/** `label` ya traducido (ADR 0008). `value` es `unknown`: estrecharlo obligaría a castear. */
export interface SelectOption {
  label: string;
  value: unknown;
}

/**
 * Alias de `listbox/`, compartido con search-select desde DS-3 (HG-04). Sin scroll virtual a
 * propósito: una lista de cientos es un `ewms-search-select`, que pagina.
 */
export const SELECT_PANEL_CLASSES = LISTBOX_PANEL_CLASSES;
export const SELECT_OPTION_BASE_CLASSES = LISTBOX_OPTION_BASE_CLASSES;
export const SELECT_SELECTED_WEIGHT = LISTBOX_SELECTED_WEIGHT;
export const selectOptionClasses = listboxOptionClasses;
