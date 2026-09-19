import { inject, type Provider } from '@angular/core';
import {
  EWMS_SEARCH_SELECT_MESSAGES,
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  type SearchSelectMessages,
  type TableFormatters,
  type TableMessages,
} from '@ewms/design-system';
import { TranslocoService } from '@jsverse/transloco';
import { TranslocoLocaleService } from '@jsverse/transloco-locale';

/**
 * WHERE THE DESIGN SYSTEM'S TEXTS AND FORMATS ACTUALLY COME FROM.
 *
 * The library defines the interfaces and the tokens and implements neither: it
 * speaks no language and imports no i18n library (ADR 0008). This file is the
 * other half -- it is in the shell, it may import Transloco, and it fills the
 * tokens once for the whole application.
 *
 * That is the rule written in the Nomenclatura note, seen from the side that
 * does the work: a dictionary that repeats between instances is provided once;
 * a label that differs at every use stays an input.
 *
 * Dates and numbers go through `transloco-locale`, which is what the ICU
 * helper in `core/i18n` already tells everyone to use. The table never learns
 * what a locale is: it asks for the answer.
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
      provide: EWMS_SEARCH_SELECT_MESSAGES,
      useFactory: searchSelectMessages,
    },
  ];
}

/**
 * KEYS WRITTEN OUT LITERALLY, never built by concatenation.
 *
 * A one-line helper that interpolated the last segment of the key would be
 * three lines shorter and invisible to transloco-keys-manager, which reads the
 * source rather than running it: gate 12 would then report every one of these
 * as a key nobody uses, and a real missing key would be lost in the noise.
 * Same rule the language switcher follows.
 *
 * Writing the interpolated form even inside THIS COMMENT was enough to make
 * the extractor report it as a missing key, which is a fair demonstration of
 * the point.
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
  };
}

/**
 * Getters and not plain values, so a language switch is picked up.
 *
 * `translate()` reads the ACTIVE language at the moment it is called. Building
 * the object with flat strings would freeze every table's chrome in whatever
 * language was loaded when the application started -- and the switcher would
 * change the page around them while their own words stayed put.
 */
function searchSelectMessages(): SearchSelectMessages {
  const transloco = inject(TranslocoService);
  return {
    get searching() {
      return transloco.translate('ds.searchSelect.searching');
    },
    get error() {
      return transloco.translate('ds.searchSelect.error');
    },
    get retry() {
      return transloco.translate('ds.searchSelect.retry');
    },
    get more() {
      return transloco.translate('ds.searchSelect.more');
    },
    noResults: (query) => transloco.translate('ds.searchSelect.noResults', { query }),
    results: (count, total) =>
      total === null
        ? transloco.translate('ds.searchSelect.results', { count })
        : transloco.translate('ds.searchSelect.resultsOf', { count, total }),
  };
}

function tableFormatters(): TableFormatters {
  const locale = inject(TranslocoLocaleService);
  return {
    /**
     * An unparseable value comes back as itself rather than as "Invalid Date".
     *
     * A table shows whatever the source handed over, and a source is allowed
     * to have a gap or a value in a shape nobody expected. Printing the raw
     * text is information; printing "Invalid Date" is the table blaming the
     * data in English.
     */
    date: (value) => {
      if (value === null || value === undefined || value === '') {
        return '';
      }
      const parsed = new Date(String(value));
      return Number.isNaN(parsed.getTime()) ? String(value) : locale.localizeDate(parsed);
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
