import { InjectionToken } from '@angular/core';
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
 * Hasta 7 opciones no busca: escribir para elegir entre tres estados es un paso de más.
 * Decisión del usuario (2026-09-21). Ver vault: Select.
 */
export const SELECT_SEARCH_THRESHOLD = 7;

/** `true` y `false` fuerzan; `auto` busca con `source` o con más de SELECT_SEARCH_THRESHOLD. */
export type SelectSearchable = 'auto' | boolean;

/** Typeahead de la lista corta: una pausa más larga empieza una palabra nueva. */
export const SELECT_TYPEAHEAD_RESET_MS = 500;

/** RFE-03: `empty` y `error` no se mezclan, o una caída parece un depósito vacío. */
export type SearchStatus = 'idle' | 'searching' | 'ready' | 'empty' | 'error';

/** Tokens leídos en runtime (lib/tokens/read-token.ts). */
export const DELAY_SEARCH_INPUT_TOKEN = '--delay-search-input';
export const TIMEOUT_SEARCH_TOKEN = '--timeout-search';

// El umbral de escaneo vive en scan-detector (una copia aparte deriva); se reexporta.
export { SCAN_MIN_KEYSTROKES, SCAN_THRESHOLD_TOKEN } from '../keyboard/scan-detector';

/** Sin scroll virtual a propósito: una lista de cientos va con `source`, que pagina. */
export const SELECT_PANEL_CLASSES = LISTBOX_PANEL_CLASSES;
export const SELECT_OPTION_BASE_CLASSES = LISTBOX_OPTION_BASE_CLASSES;
export const SELECT_SELECTED_WEIGHT = LISTBOX_SELECTED_WEIGHT;
export const selectOptionClasses = listboxOptionClasses;

/** Spinner y nota de vacío: la geometría de un resultado para que la lista no salte. */
export const SEARCH_NOTE_CLASSES = 'flex items-center gap-2 px-3 py-1.5 text-caption text-secondary';

/** «Cargar más» es una fila, no un botón: las flechas la alcanzan y el foco no sale del campo. */
export const SEARCH_MORE_CLASSES =
  'flex w-full items-center justify-center gap-2 px-3 py-1.5 cursor-pointer text-caption ' +
  'text-(color:--color-bg-primary)';

/** Textos ya traducidos, provistos una vez por token. Solo los usa el modo que busca. */
export interface SelectMessages {
  readonly searching: string;
  /** RFE-03: recibe el texto buscado para mostrarlo. */
  readonly noResults: (query: string) => string;
  readonly error: string;
  readonly retry: string;
  readonly more: string;
  /** `total` puede ser null: RFE-02 lo admite. */
  readonly results: (count: number, total: number | null) => string;
}

export const EWMS_SELECT_MESSAGES = new InjectionToken<SelectMessages>('EWMS_SELECT_MESSAGES');

/** Sin proveedor la lista corta no pierde nada; el modo que busca queda sin palabras. */
export const NO_SELECT_MESSAGES: SelectMessages = {
  searching: '',
  noResults: () => '',
  error: '',
  retry: '',
  more: '',
  results: () => '',
};
