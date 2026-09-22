import { computed, inject, type Provider } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  EWMS_DATE_PICKER_MESSAGES,
  EWMS_FAVORITE_LABELS,
  EWMS_FAVORITES_STORE,
  EWMS_SELECT_MESSAGES,
  EWMS_SHORTCUT_HELP_MESSAGES,
  EWMS_SPLIT_BUTTON_MESSAGES,
  EWMS_SHORTCUT_MAP,
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  Favorites,
  InMemoryFavoritesStore,
  parseTableDate,
  type DatePickerMessages,
  type FavoriteLabelResolver,
  type SelectMessages,
  type ShortcutHelpMessages,
  type SplitButtonMessages,
  type TableFormatters,
  type TableMessages,
} from '@ewms/design-system';
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
      provide: EWMS_DATE_PICKER_MESSAGES,
      useFactory: datePickerMessages,
    },
  ];
}

/**
 * Nombre del favorito al dibujarlo, por el mismo `menuEntryFor` de pestañas y migas
 * (REQ-FE-DS4-002 v1.3). Signals y no getters: el bloque es OnPush y solo `lang()`
 * lo repinta. Ruta desconocida: cadena vacía, y el bloque muestra la ruta.
 */
function favoriteLabels(): FavoriteLabelResolver {
  const transloco = inject(TranslocoService);
  const lang = toSignal(transloco.langChanges$, { initialValue: transloco.getActiveLang() });
  return {
    labelFor: (route) =>
      computed(() => {
        lang();
        const entry = menuEntryFor(route);
        return entry === undefined ? '' : transloco.translate(entry.labelKey);
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
  const transloco = inject(TranslocoService);
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
    get previousPage() {
      return transloco.translate('ds.table.previousPage');
    },
    get nextPage() {
      return transloco.translate('ds.table.nextPage');
    },
    pageOf: (page, pages) =>
      transloco.translate('ds.table.pageOf', { page: String(page), pages: String(pages) }),
    rowsTotal: (total) => transloco.translate('ds.table.rowsTotal', { total }),
    filters: (active) => transloco.translate('ds.table.filters', { active }),
    get clearFilters() {
      return transloco.translate('ds.table.clearFilters');
    },
    removeFilter: (column) => transloco.translate('ds.table.removeFilter', { column }),
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
    selectedCount: (count) => transloco.translate('ds.table.selectedCount', { count }),
    get clearSelection() {
      return transloco.translate('ds.table.clearSelection');
    },
    copied: (rows) => transloco.translate('ds.table.copied', { rows }),
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
 * Getters: `translate()` lee el idioma activo al llamarse, y con cadenas planas la
 * interfaz quedaría en el idioma del arranque.
 */
function selectMessages(): SelectMessages {
  const transloco = inject(TranslocoService);
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
  const transloco = inject(TranslocoService);
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
      get help() {
        return transloco.translate('shell.shortcuts.actions.help');
      },
    },
  };
}

function splitButtonMessages(): SplitButtonMessages {
  const transloco = inject(TranslocoService);
  return {
    get moreActions() {
      return transloco.translate('ds.splitButton.moreActions');
    },
  };
}

/** `locale` también es getter: el calendario sigue al idioma activo sin recargar. */
function datePickerMessages(): DatePickerMessages {
  const transloco = inject(TranslocoService);
  const locale = inject(TranslocoLocaleService);
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
      return locale.getLocale();
    },
  };
}

function tableFormatters(): TableFormatters {
  const locale = inject(TranslocoLocaleService);
  return {
    /**
     * Lo que no parsea vuelve tal cual, nunca «Invalid Date». `parseTableDate` y no
     * `new Date('2026-03-15')`, que es medianoche UTC e imprimía el 14 al oeste de UTC.
     */
    date: (value) => {
      if (value === null || value === undefined || value === '') {
        return '';
      }
      const parsed = parseTableDate(value);
      return parsed === null ? String(value) : locale.localizeDate(parsed);
    },
    number: (value) => {
      if (value === null || value === undefined || value === '') {
        return '';
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? locale.localizeNumber(parsed, 'decimal') : String(value);
    },
  };
}
