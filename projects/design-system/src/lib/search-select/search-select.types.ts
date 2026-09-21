import { InjectionToken } from '@angular/core';

/** RFE-03: `empty` y `error` no se mezclan, o una caída parece un depósito vacío. */
export type SearchStatus =
  | 'idle'
  | 'searching'
  | 'ready'
  | 'empty'
  | 'error';

/** Tokens leídos en runtime (lib/tokens/read-token.ts). */
export const DELAY_SEARCH_INPUT_TOKEN = '--delay-search-input';
export const TIMEOUT_SEARCH_TOKEN = '--timeout-search';

// El umbral de escaneo vive en scan-detector (una copia aparte deriva); se reexporta
// para los importadores de siempre.
export { SCAN_MIN_KEYSTROKES, SCAN_THRESHOLD_TOKEN } from '../keyboard/scan-detector';

/** Spinner y nota de vacío: la geometría de un resultado para que la lista no salte. */
export const SEARCH_NOTE_CLASSES =
  'flex items-center gap-2 px-3 py-1.5 text-caption text-secondary';

/** «Cargar más» es una fila, no un botón: las flechas la alcanzan y el foco no sale del campo. */
export const SEARCH_MORE_CLASSES =
  'flex w-full items-center justify-center gap-2 px-3 py-1.5 cursor-pointer text-caption ' +
  'text-(color:--color-bg-primary)';

/**
 * Textos ya traducidos, provistos una vez por token y no por instancia (desde DS-3 lote C).
 * Ver vault: Nomenclatura de Componentes y Tokens.
 */
export interface SearchSelectMessages {
  readonly searching: string;
  /** RFE-03: recibe el texto buscado para mostrarlo. */
  readonly noResults: (query: string) => string;
  readonly error: string;
  readonly retry: string;
  readonly more: string;
  /** `total` puede ser null: RFE-02 lo admite. */
  readonly results: (count: number, total: number | null) => string;
}

export const EWMS_SEARCH_SELECT_MESSAGES = new InjectionToken<SearchSelectMessages>(
  'EWMS_SEARCH_SELECT_MESSAGES',
);
