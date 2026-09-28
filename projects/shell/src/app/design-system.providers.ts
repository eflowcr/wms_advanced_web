import { computed, inject, type Provider, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  EWMS_DATE_PICKER_MESSAGES,
  EWMS_FILTER_BAR_MESSAGES,
  EWMS_FILTER_CHIPS_MESSAGES,
  EWMS_FORM_MESSAGES,
  EWMS_PAGINATION_MESSAGES,
  EWMS_FAVORITE_LABELS,
  EWMS_FAVORITES_STORE,
  EWMS_SELECT_MESSAGES,
  EWMS_SHORTCUT_HELP_MESSAGES,
  EWMS_SEARCH_BOX_MESSAGES,
  EWMS_SPLIT_BUTTON_MESSAGES,
  EWMS_SHORTCUT_MAP,
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  Favorites,
  InMemoryFavoritesStore,
  parseTableDate,
  type DatePickerMessages,
  type FavoriteLabelResolver,
  type FilterBarMessages,
  type FilterChipsMessages,
  type FormMessages,
  type PaginationMessages,
  type SelectMessages,
  type ShortcutHelpMessages,
  type SearchBoxMessages,
  type SplitButtonMessages,
  type TableFormatters,
  type TableMessages,
} from '@ewms/design-system';
import { catalogKeyFor } from '@ewms/showroom';
import { TranslocoService } from '@jsverse/transloco';
import { TranslocoLocaleService } from '@jsverse/transloco-locale';
import { menuEntryFor } from './layout/menu';
import { SHORTCUT_MAP } from './shortcuts.map';

/**
 * Llena una vez los tokens de textos y formatos del design system, que no habla
 * ningún idioma (ADR 0008). Diccionario repetido entre instancias: se provee acá;
 * etiqueta distinta en cada uso: sigue siendo input. Fechas y números por `transloco-locale`.
 */
export function provideEwmsDesignSystem(): Provider[] {
  return [
    {
      provide: EWMS_TABLE_MESSAGES,
      useFactory: tableMessages,
    },
    {
      provide: EWMS_TABLE_FORMATTERS,
      useFactory: tableFormatters,
    },
    {
      provide: EWMS_SELECT_MESSAGES,
      useFactory: selectMessages,
    },
    {
      provide: EWMS_FILTER_BAR_MESSAGES,
      useFactory: filterBarMessages,
    },
    {
      provide: EWMS_FILTER_CHIPS_MESSAGES,
      useFactory: filterChipsMessages,
    },
    {
      provide: EWMS_PAGINATION_MESSAGES,
      useFactory: paginationMessages,
    },
    {
      provide: EWMS_FORM_MESSAGES,
      useFactory: formMessages,
    },
    // El mapa es valor y las palabras son fábrica (DS-4): las teclas no cambian con
    // el idioma. El showroom provee su propio par para registrar `create` sin el shell.
    {
      provide: EWMS_SHORTCUT_MAP,
      useValue: SHORTCUT_MAP,
    },
    // Favoritos en memoria, sin almacenamiento del navegador (REQ-FE-DS4-002 v1.2,
    // decisión del usuario 2026-09-19). Con backend solo cambia esta línea (§12 del REQ).
    // Único lugar que provee el store: dos stores daban dos estrellas en desacuerdo.
    {
      provide: EWMS_FAVORITES_STORE,
      useClass: InMemoryFavoritesStore,
    },
    Favorites,
    {
      provide: EWMS_FAVORITE_LABELS,
      useFactory: favoriteLabels,
    },
    {
      provide: EWMS_SHORTCUT_HELP_MESSAGES,
      useFactory: shortcutHelpMessages,
    },
    {
      provide: EWMS_SPLIT_BUTTON_MESSAGES,
      useFactory: splitButtonMessages,
    },
    {
      provide: EWMS_SEARCH_BOX_MESSAGES,
      useFactory: searchBoxMessages,
    },
    {
      provide: EWMS_DATE_PICKER_MESSAGES,
      useFactory: datePickerMessages,
    },
  ];
}

/**
 * El idioma activo como signal. Quien lo lee al escribir un texto hace que el componente OnPush
 * que lo muestra, o el `computed` que copia el objeto de mensajes, siga un cambio de idioma: sin
 * esto la barra de la tabla quedaba en el idioma anterior hasta el próximo clic.
 */
function activeLanguage(): Signal<string> {
  const transloco = inject(TranslocoService);
  return toSignal(transloco.langChanges$, { initialValue: transloco.getActiveLang() });
}

/** `translate` que registra el idioma como dependencia de quien lo llama (ver arriba). */
function injectTranslator(): {
  translate: (key: string, params?: Record<string, unknown>) => string;
} {
  const transloco = inject(TranslocoService);
  const lang = activeLanguage();
  return {
    translate: (key, params) => {
      lang();
      return transloco.translate(key, params);
    },
  };
}

/**
 * Nombre del favorito al dibujarlo, por el mismo `menuEntryFor` de pestañas y migas
 * (REQ-FE-DS4-002 v1.3). Signals y no getters: el bloque es OnPush y solo `lang()`
 * lo repinta. Ruta desconocida: cadena vacía, y el bloque muestra la ruta.
 */
function favoriteLabels(): FavoriteLabelResolver {
  const transloco = inject(TranslocoService);
  const lang = activeLanguage();
  return {
    labelFor: (route) =>
      computed(() => {
        lang();
        // Una página del showroom se llama como en su catálogo: el menú solo sabe decir
        // «Sistema de diseño», y trece favoritos con el mismo nombre no son favoritos.
        const key = catalogKeyFor(route) ?? menuEntryFor(route)?.labelKey;
        return key === undefined ? '' : transloco.translate(key);
      }),
    iconFor: (route) => menuEntryFor(route)?.icon ?? null,
  };
}

/**
 * Claves literales, nunca concatenadas: transloco-keys-manager lee la fuente y la
 * compuerta 12 las daría por huérfanas. Ojo: escribir la forma interpolada incluso
 * en un comentario la hace reportar como clave faltante.
 */
function tableMessages(): TableMessages {
  const transloco = injectTranslator();
  return {
    get search() {
      return transloco.translate('ds.table.search');
    },
    get filterPlaceholder() {
      return transloco.translate('ds.table.filterPlaceholder');
    },
    get filterFrom() {
      return transloco.translate('ds.table.filterFrom');
    },
    get filterTo() {
      return transloco.translate('ds.table.filterTo');
    },
    get selectAll() {
      return transloco.translate('ds.table.selectAll');
    },
    get selectRow() {
      return transloco.translate('ds.table.selectRow');
    },
    get expand() {
      return transloco.translate('ds.table.expand');
    },
    get collapse() {
      return transloco.translate('ds.table.collapse');
    },
    get rowMenu() {
      return transloco.translate('ds.table.rowMenu');
    },
    get loadingChildren() {
      return transloco.translate('ds.table.loadingChildren');
    },
    get childrenFailed() {
      return transloco.translate('ds.table.childrenFailed');
    },
    get retry() {
      return transloco.translate('ds.table.retry');
    },
    get sortedAscending() {
      return transloco.translate('ds.table.sortedAscending');
    },
    get sortedDescending() {
      return transloco.translate('ds.table.sortedDescending');
    },
    filters: (active) => transloco.translate('ds.table.filters', { active }),
    get clearFilters() {
      return transloco.translate('ds.table.clearFilters');
    },
    get view() {
      return transloco.translate('ds.table.view');
    },
    get resetView() {
      return transloco.translate('ds.table.resetView');
    },
    get expandAll() {
      return transloco.translate('ds.table.expandAll');
    },
    get collapseAll() {
      return transloco.translate('ds.table.collapseAll');
    },
    get density() {
      return transloco.translate('ds.table.density');
    },
    get densityMd() {
      return transloco.translate('ds.table.densityMd');
    },
    get densitySm() {
      return transloco.translate('ds.table.densitySm');
    },
    get setAll() {
      return transloco.translate('ds.table.setAll');
    },
    get setNone() {
      return transloco.translate('ds.table.setNone');
    },
    setSummary: (column, chosen, total) =>
      chosen === total
        ? transloco.translate('ds.table.setSummaryAll', { column })
        : transloco.translate('ds.table.setSummary', { column, chosen, total }),
    get columns() {
      return transloco.translate('ds.table.columns');
    },
    resizeColumn: (column) => transloco.translate('ds.table.resizeColumn', { column }),
    moveEarlier: (column) => transloco.translate('ds.table.moveEarlier', { column }),
    moveLater: (column) => transloco.translate('ds.table.moveLater', { column }),
    columnMoved: (column, position, total) =>
      transloco.translate('ds.table.columnMoved', { column, position, total }),
    columnMenu: (column) => transloco.translate('ds.table.columnMenu', { column }),
    // Un getter por acción con la clave literal, por la regla de arriba.
    columnActions: {
      get sortAsc() {
        return transloco.translate('ds.table.columnActions.sortAsc');
      },
      get sortDesc() {
        return transloco.translate('ds.table.columnActions.sortDesc');
      },
      get sortClear() {
        return transloco.translate('ds.table.columnActions.sortClear');
      },
      get pinStart() {
        return transloco.translate('ds.table.columnActions.pinStart');
      },
      get pinEnd() {
        return transloco.translate('ds.table.columnActions.pinEnd');
      },
      get unpin() {
        return transloco.translate('ds.table.columnActions.unpin');
      },
      get fit() {
        return transloco.translate('ds.table.columnActions.fit');
      },
      get moveLeft() {
        return transloco.translate('ds.table.columnActions.moveLeft');
      },
      get moveRight() {
        return transloco.translate('ds.table.columnActions.moveRight');
      },
      get hide() {
        return transloco.translate('ds.table.columnActions.hide');
      },
    },
    sortPriority: (sorted, priority) =>
      transloco.translate('ds.table.sortPriority', { sorted, priority }),
    selectedCount: (count) => transloco.translate('ds.table.selectedCount', { count }),
    get clearSelection() {
      return transloco.translate('ds.table.clearSelection');
    },
    copied: (rows) => transloco.translate('ds.table.copied', { rows }),
    get loading() {
      return transloco.translate('ds.table.loading');
    },
    get loadFailed() {
      return transloco.translate('ds.table.loadFailed');
    },
    get noData() {
      return transloco.translate('ds.table.noData');
    },
    get noResults() {
      return transloco.translate('ds.table.noResults');
    },
    get noResultsHint() {
      return transloco.translate('ds.table.noResultsHint');
    },
    get export() {
      return transloco.translate('ds.table.export');
    },
    get exportSelected() {
      return transloco.translate('ds.table.exportSelected');
    },
    get copyAll() {
      return transloco.translate('ds.table.copyAll');
    },
    rowsShown: (shown, total) =>
      total === null
        ? transloco.translate('ds.table.rowsShown', { shown })
        : transloco.translate('ds.table.rowsShownOf', { shown, total }),
    // Una clave por combinación, literal: transloco-keys-manager lee la fuente (ver arriba).
    aggregate: (kind, column, scope) => {
      /** t(ds.table.sumSelected, ds.table.sumShown, ds.table.avgSelected, ds.table.avgShown, ds.table.countSelected, ds.table.countShown) */
      const keys = {
        sum: { selected: 'ds.table.sumSelected', shown: 'ds.table.sumShown' },
        avg: { selected: 'ds.table.avgSelected', shown: 'ds.table.avgShown' },
        count: { selected: 'ds.table.countSelected', shown: 'ds.table.countShown' },
      } as const;
      return transloco.translate(keys[kind][scope], { column });
    },
  };
}

/**
 * Un mensaje por `kind` de Signal Forms, con las claves literales (transloco-keys-manager lee la
 * fuente). Un validador del proyecto trae su texto en el `message` del error, que gana sobre esto.
 */
function formMessages(): FormMessages {
  const transloco = injectTranslator();
  const locale = inject(TranslocoLocaleService);
  const day = (limit: unknown): string =>
    limit instanceof Date ? locale.localizeDate(limit, undefined, DATE_LIMIT_FORMAT) : '';
  return {
    errors: {
      required: () => transloco.translate('ds.form.required'),
      minLength: (limit) => transloco.translate('ds.form.minLength', { length: limit }),
      maxLength: (limit) => transloco.translate('ds.form.maxLength', { length: limit }),
      min: (limit) => transloco.translate('ds.form.min', { min: limit }),
      max: (limit) => transloco.translate('ds.form.max', { max: limit }),
      minDate: (limit) => transloco.translate('ds.form.minDate', { date: day(limit) }),
      maxDate: (limit) => transloco.translate('ds.form.maxDate', { date: day(limit) }),
      pattern: () => transloco.translate('ds.form.pattern'),
      email: () => transloco.translate('ds.form.email'),
    },
    customError: () => transloco.translate('ds.form.custom'),
    errorSummary: (count) => transloco.translate('ds.form.errorSummary', { count }),
    get errorSummaryLabel() {
      return transloco.translate('ds.form.errorSummaryLabel');
    },
    get requiredLegend() {
      return transloco.translate('ds.form.requiredLegend');
    },
  };
}

function filterBarMessages(): FilterBarMessages {
  const transloco = injectTranslator();
  return {
    moreFilters: (active) => transloco.translate('ds.filterBar.moreFilters', { active }),
    get fewerFilters() {
      return transloco.translate('ds.filterBar.fewerFilters');
    },
  };
}

/** Los mismos chips en la barra de la tabla y en la de pantalla: un solo diccionario. */
function filterChipsMessages(): FilterChipsMessages {
  const transloco = injectTranslator();
  return {
    removeFilter: (column) => transloco.translate('ds.filterChips.removeFilter', { column }),
    get clearFilters() {
      return transloco.translate('ds.filterChips.clearFilters');
    },
  };
}

/** El paginador es suyo, no de la tabla: cards, logs y colas de picking también paginan. */
function paginationMessages(): PaginationMessages {
  const transloco = injectTranslator();
  return {
    get previousPage() {
      return transloco.translate('ds.pagination.previousPage');
    },
    get nextPage() {
      return transloco.translate('ds.pagination.nextPage');
    },
    pageOf: (page, pages) =>
      transloco.translate('ds.pagination.pageOf', { page: String(page), pages: String(pages) }),
    rowsTotal: (total) => transloco.translate('ds.pagination.rowsTotal', { total }),
  };
}

/**
 * Getters: `translate()` lee el idioma activo al llamarse, y con cadenas planas la
 * interfaz quedaría en el idioma del arranque.
 */
function selectMessages(): SelectMessages {
  const transloco = injectTranslator();
  return {
    get searching() {
      return transloco.translate('ds.select.searching');
    },
    get error() {
      return transloco.translate('ds.select.error');
    },
    get retry() {
      return transloco.translate('ds.select.retry');
    },
    get more() {
      return transloco.translate('ds.select.more');
    },
    noResults: (query) => transloco.translate('ds.select.noResults', { query }),
    results: (count, total) =>
      total === null
        ? transloco.translate('ds.select.results', { count })
        : transloco.translate('ds.select.resultsOf', { count, total }),
  };
}

/**
 * Solo las palabras del diálogo de ayuda; la lista sale de `SHORTCUT_MAP` (RFE-07).
 * Un atajo nuevo suma una línea al mapa y una etiqueta acá. Getters, como arriba.
 */
function shortcutHelpMessages(): ShortcutHelpMessages {
  const transloco = injectTranslator();
  return {
    get title() {
      return transloco.translate('shell.shortcuts.title');
    },
    get intro() {
      return transloco.translate('shell.shortcuts.intro');
    },
    get actionColumn() {
      return transloco.translate('shell.shortcuts.actionColumn');
    },
    get keyColumn() {
      return transloco.translate('shell.shortcuts.keyColumn');
    },
    get close() {
      return transloco.translate('shell.shortcuts.close');
    },
    get singleKeyLabel() {
      return transloco.translate('shell.shortcuts.singleKeyLabel');
    },
    get singleKeyHint() {
      return transloco.translate('shell.shortcuts.singleKeyHint');
    },
    get singleKeyOff() {
      return transloco.translate('shell.shortcuts.singleKeyOff');
    },
    // Un getter por acción con la clave literal, por la misma regla de la tabla.
    actions: {
      get search() {
        return transloco.translate('shell.shortcuts.actions.search');
      },
      get create() {
        return transloco.translate('shell.shortcuts.actions.create');
      },
      get save() {
        return transloco.translate('shell.shortcuts.actions.save');
      },
      get cancel() {
        return transloco.translate('shell.shortcuts.actions.cancel');
      },
      get filters() {
        return transloco.translate('shell.shortcuts.actions.filters');
      },
      get moveColumnLeft() {
        return transloco.translate('shell.shortcuts.actions.moveColumnLeft');
      },
      get moveColumnRight() {
        return transloco.translate('shell.shortcuts.actions.moveColumnRight');
      },
      get help() {
        return transloco.translate('shell.shortcuts.actions.help');
      },
    },
  };
}

function searchBoxMessages(): SearchBoxMessages {
  const transloco = injectTranslator();
  return {
    get submit() {
      return transloco.translate('ds.searchBox.submit');
    },
    get clear() {
      return transloco.translate('ds.searchBox.clear');
    },
  };
}

function splitButtonMessages(): SplitButtonMessages {
  const transloco = injectTranslator();
  return {
    get moreActions() {
      return transloco.translate('ds.splitButton.moreActions');
    },
  };
}

/** `locale` también es getter: el calendario sigue al idioma activo sin recargar. */
function datePickerMessages(): DatePickerMessages {
  const transloco = injectTranslator();
  const locale = inject(TranslocoLocaleService);
  const lang = activeLanguage();
  return {
    get chooseDate() {
      return transloco.translate('ds.datePicker.chooseDate');
    },
    get previousMonth() {
      return transloco.translate('ds.datePicker.previousMonth');
    },
    get nextMonth() {
      return transloco.translate('ds.datePicker.nextMonth');
    },
    get locale() {
      lang();
      return locale.getLocale();
    },
  };
}

/**
 * Día y mes con dos dígitos, 16/03/2026 y no 16/3/2026: en la tabla y en los límites de fecha del
 * formulario.
 */
const DATE_LIMIT_FORMAT = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;

function tableFormatters(): TableFormatters {
  const locale = inject(TranslocoLocaleService);
  const lang = activeLanguage();
  return {
    /**
     * Lo que no parsea vuelve tal cual, nunca «Invalid Date». `parseTableDate` y no
     * `new Date('2026-03-15')`, que es medianoche UTC e imprimía el 14 al oeste de UTC.
     */
    date: (value) => {
      lang();
      if (value === null || value === undefined || value === '') {
        return '';
      }
      const parsed = parseTableDate(value);
      // Día y mes con dos dígitos: en columna se leen alineados (16/03/2026).
      return parsed === null
        ? String(value)
        : locale.localizeDate(parsed, undefined, DATE_LIMIT_FORMAT);
    },
    number: (value) => {
      lang();
      if (value === null || value === undefined || value === '') {
        return '';
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? locale.localizeNumber(parsed, 'decimal') : String(value);
    },
  };
}
