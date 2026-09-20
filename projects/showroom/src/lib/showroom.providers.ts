import { inject, signal, type Provider } from '@angular/core';
import {
  EWMS_FAVORITE_LABELS,
  EWMS_SEARCH_SELECT_MESSAGES,
  EWMS_SHORTCUT_HELP_MESSAGES,
  EWMS_SHORTCUT_MAP,
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  parseTableDate,
  type FavoriteLabelResolver,
  type SearchSelectMessages,
  type ShortcutHelpMessages,
  type TableFormatters,
  type TableMessages,
} from '@ewms/design-system';
import { CATALOG } from './catalog';
import { SHOWROOM_SHORTCUT_MAP } from './shortcuts.map';

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
    { provide: EWMS_SHORTCUT_MAP, useValue: SHOWROOM_SHORTCUT_MAP },
    { provide: EWMS_SHORTCUT_HELP_MESSAGES, useValue: SHORTCUT_HELP_MESSAGES },

    /*
     * THE NAMES OF THE CATALOGUE'S ROUTES, AND NOT THE STORE.
     *
     * `EWMS_FAVORITES_STORE` and `Favorites` are NOT provided here, on purpose:
     * the catalogue renders inside the application and reads the application's
     * one list by injection. Providing the store a second time gave a page two
     * stars and two lists that disagreed. WORDS may be provided twice -- that
     * is what every other line of this file is -- and state may not.
     */
    { provide: EWMS_FAVORITE_LABELS, useFactory: favoriteLabels },
  ];
}

/**
 * What a favourite is called IN THE SIDEBAR OF THE CATALOGUE.
 *
 * A catalogue page by the name of its entry in `catalog.ts`, so the block reads
 * like the list underneath it. Anything else is a screen of the application's,
 * and the application knows what it is called: the question goes up to the
 * resolver provided above this one (`skipSelf`), which is how «Artículos»
 * marked in the shell has a name down here and not a bare path. Alone -- in a
 * unit test, with nothing above -- it resolves to nothing and the block shows
 * the route, which is the behaviour the library promises.
 */
function favoriteLabels(): FavoriteLabelResolver {
  const parent = inject(EWMS_FAVORITE_LABELS, { skipSelf: true, optional: true });
  const entries = CATALOG.flatMap((section) => section.entries);
  const nameOf = (route: string) => entries.find((entry) => entry.route === route)?.name;
  return {
    labelFor: (route) => {
      const name = nameOf(route);
      return name === undefined
        ? (parent?.labelFor(route) ?? signal('').asReadonly())
        : signal(name).asReadonly();
    },
    iconFor: (route) => (nameOf(route) === undefined ? (parent?.iconFor(route) ?? null) : null),
  };
}

/**
 * Plain literals, not getters.
 *
 * The shell's copy uses getters because `translate()` reads the ACTIVE
 * language and the switcher can change it under an object built once. The
 * showroom is Spanish only and exempt from i18n (gate 12), so there is no
 * language to change and nothing to defer.
 *
 * The LIST of shortcuts is not here. The dialog reads it from
 * `SHOWROOM_SHORTCUT_MAP`; what this provides is one label per action.
 */
export const SHORTCUT_HELP_MESSAGES: ShortcutHelpMessages = {
  title: 'Atajos de teclado',
  intro: 'Funcionan en todo el showroom. Dentro de un campo de texto no se disparan, salvo Esc.',
  actionColumn: 'Acción',
  keyColumn: 'Tecla',
  close: 'Cerrar',
  singleKeyLabel: 'Atajos de una sola tecla',
  singleKeyHint:
    'Los atajos de una sola tecla pueden dispararse solos con entrada por voz o con un pulsador. ' +
    'Apagarlos no afecta a los que llevan Alt o Ctrl. La preferencia dura lo que dure esta pestaña.',
  singleKeyOff: '(apagado)',
  actions: {
    search: 'Llevar el foco al campo de búsqueda',
    create: 'Crear un registro nuevo',
    save: 'Guardar el formulario activo',
    cancel: 'Cancelar lo que esté en curso, o cerrar lo que esté abierto',
    help: 'Abrir esta lista',
  },
};

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
  /**
   * `parseTableDate` and not `new Date(...)`. The two are not equivalent for
   * the shape a row actually carries: `new Date('2026-03-15')` is UTC
   * midnight, and formatting that in local time printed the 14th in every
   * timezone west of UTC. The shell's implementation of this token had the
   * same bug; the parse is shared now so a fix cannot land in only one.
   */
  date: (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const parsed = parseTableDate(value);
    return parsed === null ? String(value) : new Intl.DateTimeFormat('es').format(parsed);
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
