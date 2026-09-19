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

/**
 * `YYYY-MM-DD`, and nothing else. Anchored, so `2026-03-15T08:00:00Z` is not
 * matched and keeps the path that is correct for it.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A raw cell value as a `Date`, or `null` when it is not one.
 *
 * WHY THIS EXISTS: `new Date('2026-03-15')` IS NOT THE DATE IT LOOKS LIKE.
 *
 * ECMAScript parses the date-only form as **UTC midnight**, and the date-time
 * form without a zone as **local**. So a shipment dated `2026-03-15`, rendered
 * through any formatter that works in local time, shows as the **14th** in
 * every timezone west of UTC -- and correctly everywhere else, which is why
 * the bug survives review and a CI that runs in UTC.
 *
 * It was found on the DS-4 example screen, in America/Costa_Rica (UTC-6),
 * where the whole table was quietly a day early. In a warehouse a shipment
 * date off by one is not cosmetic.
 *
 * The fix is to read the three numbers and build the date in LOCAL time, which
 * is what somebody writing `2026-03-15` in a row means: that calendar day, not
 * an instant. A value that carries a time and a zone is a real instant and
 * keeps the ordinary path.
 *
 * Lives here, beside the `TableFormatters` interface it serves, because there
 * are TWO implementations of that token -- the shell's, through
 * `transloco-locale`, and the showroom's, through `Intl` -- and both had the
 * same bug. Two copies of a parse is two chances to fix only one of them.
 */
export function parseTableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const text = String(value);
  const parts = DATE_ONLY.exec(text);
  if (parts !== null) {
    const [year, month, day] = [Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])];
    // Month is zero-based, and the three-argument form is local by definition.
    const parsed = new Date(year, month, day);
    /*
     * AND IT HAS TO BE THE DAY THAT WAS ASKED FOR. The three-argument
     * constructor rolls over without complaining -- `2026-02-30` becomes the
     * 2nd of March -- so a typo in a row would be drawn as a real date a few
     * days off. Reading the components back is what turns that into `null`,
     * which the formatter renders as the raw text: information, rather than a
     * confident wrong answer.
     */
    const matches =
      parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day;
    return matches ? parsed : null;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
