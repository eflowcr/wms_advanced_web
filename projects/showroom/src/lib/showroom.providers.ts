import type { Provider } from '@angular/core';
import {
  EWMS_SEARCH_SELECT_MESSAGES,
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  type SearchSelectMessages,
  type TableFormatters,
  type TableMessages,
} from '@ewms/design-system';

/**
 * The showroom's own copy of what the shell provides from `core/i18n`.
 *
 * IT IS NOT A DUPLICATE OF THE SHELL'S, it is the showroom's. The catalogue is
 * Spanish only and exempt from i18n (gate 12), and it may not import
 * `@ewms/core` at all -- the boundary in eslint.config.js forbids it. So the
 * strings are literals and the formatters are the browser's own.
 *
 * Writing them here is also the honest test of the rule: if providing a
 * dictionary once were awkward, this file would be where it showed.
 */
export function provideShowroomDesignSystem(): Provider[] {
  return [
    { provide: EWMS_TABLE_MESSAGES, useValue: TABLE_MESSAGES },
    { provide: EWMS_TABLE_FORMATTERS, useValue: TABLE_FORMATTERS },
    { provide: EWMS_SEARCH_SELECT_MESSAGES, useValue: SEARCH_SELECT_MESSAGES },
  ];
}

export const TABLE_MESSAGES: TableMessages = {
  search: 'Buscar en la tabla',
  filterPlaceholder: 'Filtrar',
  filterFrom: 'Desde',
  filterTo: 'Hasta',
  selectAll: 'Seleccionar todas las filas visibles',
  selectRow: 'Seleccionar la fila',
  expand: 'Expandir la fila',
  collapse: 'Contraer la fila',
  rowMenu: 'Acciones de la fila',
  loadingChildren: 'Cargando las líneas…',
  childrenFailed: 'No se pudieron cargar las líneas.',
  retry: 'Reintentar',
  sortedAscending: 'Orden ascendente',
  sortedDescending: 'Orden descendente',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  pageOf: (page, pages) => `Página ${page} de ${pages}`,
  rowsTotal: (total) => (total === 1 ? '1 fila' : `${total} filas`),
};

/**
 * `Intl` directly, and not `transloco-locale`.
 *
 * The showroom cannot reach `@ewms/core`, and it does not need to: what the
 * table asks for is two functions that return strings. That is exactly the
 * portability the token buys -- the same component, in the same page, with a
 * different implementation behind the same interface.
 */
export const TABLE_FORMATTERS: TableFormatters = {
  date: (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime())
      ? String(value)
      : new Intl.DateTimeFormat('es').format(parsed);
  },
  number: (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? new Intl.NumberFormat('es').format(parsed) : String(value);
  },
};

export const SEARCH_SELECT_MESSAGES: SearchSelectMessages = {
  searching: 'Buscando…',
  noResults: (query) => `Sin resultados para «${query}»`,
  error: 'No se pudo consultar el catálogo.',
  retry: 'Reintentar',
  more: 'Ver más resultados',
  results: (count, total) =>
    total === null ? `${count} resultados` : `${count} de ${total} resultados`,
};
