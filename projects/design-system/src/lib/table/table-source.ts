import type { Observable } from 'rxjs';

/**
 * THE DATA CONTRACT OF `ewms-table`.
 *
 * Like `SearchSource<T>`, this is not an abstraction over an endpoint that
 * exists: it is the endpoint's specification, written first, so the table is
 * not built against a guess. The table knows nothing about HTTP -- no URL, no
 * status code, no transport. Moving from the in-memory source to a real
 * backend changes an implementation of this interface and nothing else.
 */
export interface TableSource<T> {
  load(query: TableQuery): Observable<TablePage<T>>;
}

/**
 * What one column's filter carries, AND THE SHAPE COMES FROM THE COLUMN'S
 * TYPE.
 *
 * A range written as text is a filter that cannot compare: "between 100 and
 * 900" as the string "100-900" forces every implementation to parse it, and
 * they will parse it differently. So a number column sends two numbers and a
 * date column sends two ISO dates, and the source is handed something it can
 * act on rather than something it has to interpret.
 */
export type TableFilterValue = string | NumberRange | DateRange;

/** `number`: either bound may be missing, which means "unbounded". */
export interface NumberRange {
  min?: number;
  max?: number;
}

/** `date`: ISO 8601, either bound may be missing. */
export interface DateRange {
  from?: string;
  to?: string;
}

/**
 * The two ranges are told apart by NAMED GUARDS rather than by an inline `in`.
 *
 * TypeScript will not narrow the negative branch of `'min' in f || 'max' in f`
 * -- which reads as if it should and quietly leaves the other side as the
 * whole union. A guard says what it means and narrows both ways.
 */
export function isNumberRange(filter: TableFilterValue): filter is NumberRange {
  return typeof filter !== 'string' && ('min' in filter || 'max' in filter);
}

export function isDateRange(filter: TableFilterValue): filter is DateRange {
  return typeof filter !== 'string' && ('from' in filter || 'to' in filter);
}

/** Everything the table is asking for, in one object. */
export interface TableQuery {
  /** The global quick filter. Empty string when there is none. */
  readonly search: string;
  /** Per column, keyed by the column's `key`. Absent key = no filter. */
  readonly filters: Readonly<Record<string, TableFilterValue>>;
  readonly sort: TableSort | null;
  /** Zero-based. */
  readonly page: number;
  readonly pageSize: number;
}

export interface TableSort {
  readonly key: string;
  readonly direction: 'asc' | 'desc';
}

/** One page of rows. */
export interface TablePage<T> {
  readonly rows: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  /**
   * How many rows match in total, or `null` when the source does not know.
   *
   * `null` IS A LEGITIMATE ANSWER, exactly as in `SearchPage`. A source that
   * counts rows on every keystroke is a source that pays for a count on every
   * keystroke, and plenty of real ones refuse to. **Without a total there is
   * no paginator** -- which is honest: a paginator with no last page is a
   * control that lies about how far it can go.
   */
  readonly total: number | null;
}

/** The empty query, which is what a table asks for before anyone touches it. */
export function emptyQuery(pageSize: number): TableQuery {
  return { search: '', filters: {}, sort: null, page: 0, pageSize };
}

/**
 * Read a top-level property of a row.
 *
 * `key` is a property NAME and not a path, on purpose: a path needs a parser,
 * a parser needs an error case, and the escape hatch for anything deeper is
 * already there and is better -- an `ewmsCell` template, where the consumer
 * writes ordinary Angular instead of a string mini-language.
 */
export function readCell<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}
