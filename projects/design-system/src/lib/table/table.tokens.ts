import { InjectionToken } from '@angular/core';

/**
 * TEXTS AND FORMATS ARE PROVIDED ONCE, NOT PER TABLE.
 *
 * The design system speaks no language (ADR 0008): every visible string
 * arrives already translated. That leaves open *how* it arrives, and the first
 * answer -- a required input per component -- does not scale. A screen with
 * six tables would write the same dictionary six times, and the seventh would
 * be written differently.
 *
 * So the library DEFINES the interfaces and the tokens and IMPLEMENTS NEITHER.
 * The shell provides them once, in its root configuration, out of `core/i18n`;
 * the showroom provides its own. Nothing here imports a translation library,
 * which is exactly what ADR 0008 protects: this asks for an interface, and
 * whoever implements it is above.
 *
 * The rule, and where the line is, is written in the Nomenclatura note: a
 * dictionary that repeats between instances goes in a token; a label that is
 * different at every use stays an input.
 */

/** Every string the table can put on screen, already translated. */
export interface TableMessages {
  /** Names the global quick-filter field. */
  readonly search: string;
  /** Placeholder of a column's text filter. */
  readonly filterPlaceholder: string;
  /** Names the "from" and "to" boxes of a range filter. */
  readonly filterFrom: string;
  readonly filterTo: string;
  /** Names the select-all checkbox in the header. */
  readonly selectAll: string;
  /** Names one row's checkbox. */
  readonly selectRow: string;
  /** Names the expand/collapse toggle of a parent row. */
  readonly expand: string;
  readonly collapse: string;
  /** Names the kebab that opens a row's menu. */
  readonly rowMenu: string;
  /** Shown in the loading row while lazy children are on their way. */
  readonly loadingChildren: string;
  /** Shown in the row that replaces children that failed to load. */
  readonly childrenFailed: string;
  /** The retry action of that row. */
  readonly retry: string;
  /** Announced when a sortable header takes a direction. */
  readonly sortedAscending: string;
  readonly sortedDescending: string;
  /** The paginator. `of` receives the page and the page count. */
  readonly previousPage: string;
  readonly nextPage: string;
  readonly pageOf: (page: number, pages: number) => string;
  readonly rowsTotal: (total: number) => string;
}

/**
 * How a raw value becomes text.
 *
 * TWO FUNCTIONS AND NOT A LOCALE, because a locale would mean the table
 * chooses a formatting library. It does not: it asks for the answer.
 *
 * Whatever these return is ONLY what is shown. Sorting and filtering never see
 * it -- they work on the raw value, which is why `[1200, 900]` sorts `900,
 * 1200` even though the screen says `1.200` and `900`.
 */
export interface TableFormatters {
  date: (value: unknown) => string;
  number: (value: unknown) => string;
}

export const EWMS_TABLE_MESSAGES = new InjectionToken<TableMessages>('EWMS_TABLE_MESSAGES');

export const EWMS_TABLE_FORMATTERS = new InjectionToken<TableFormatters>('EWMS_TABLE_FORMATTERS');
