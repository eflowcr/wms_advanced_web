import { inject, type Provider } from '@angular/core';
import {
  EWMS_SEARCH_SELECT_MESSAGES,
  EWMS_SHORTCUT_HELP_MESSAGES,
  EWMS_SHORTCUT_MAP,
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  parseTableDate,
  type SearchSelectMessages,
  type ShortcutHelpMessages,
  type TableFormatters,
  type TableMessages,
} from '@ewms/design-system';
import { TranslocoService } from '@jsverse/transloco';
import { TranslocoLocaleService } from '@jsverse/transloco-locale';
import { SHORTCUT_MAP } from './shortcuts.map';

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
    /*
     * The map is a plain value and the words are a factory, which is the whole
     * split DS-4 is built on: the KEYS are the same in every language and the
     * WORDS are not. The showroom provides its own pair for the same two
     * tokens, which is how a demo page can register `create` without importing
     * anything of the shell's.
     */
    {
      provide: EWMS_SHORTCUT_MAP,
      useValue: SHORTCUT_MAP,
    },
    {
      provide: EWMS_SHORTCUT_HELP_MESSAGES,
      useFactory: shortcutHelpMessages,
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

/**
 * The help dialog's words. The LIST of shortcuts is not here and must not be:
 * the dialog reads `SHORTCUT_MAP` for the keys, and what this provides is one
 * label per action. Adding a shortcut adds a line to the map and a label here;
 * the dialog changes by itself (RFE-07).
 *
 * Getters, for the same reason the table's are: `translate()` reads the active
 * language at the moment it is called, and a dialog built once with flat
 * strings would stay in whichever language loaded first.
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
    /*
     * One getter per action, keys written out, NOT built from the action name.
     * Same rule as the table's chrome and the same reason: the extractor reads
     * the source rather than running it, and a key assembled at runtime is a
     * key gate 12 reports as unused while a real missing one hides in the
     * noise.
     */
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
      get help() {
        return transloco.translate('shell.shortcuts.actions.help');
      },
    },
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
     *
     * THE PARSE IS `parseTableDate` AND NOT `new Date(...)`, and that is a
     * correctness fix rather than tidiness: `new Date('2026-03-15')` is UTC
     * midnight, so localising it printed the 14th everywhere west of UTC. The
     * showroom's implementation of this same token had the identical bug, which
     * is why the parse now lives in one place.
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
