import { Observable, of } from 'rxjs';
import {
  isDateRange,
  isNumberRange,
  readCell,
  type TableFilterValue,
  type TablePage,
  type TableQuery,
  type TableSource,
} from './table-source';

/**
 * A `TableSource` over an array in memory.
 *
 * IT SHIPS FROM THE LIBRARY, unlike the search select's demo source, and the
 * difference is who it is for. A demo source is demo code. This one is what a
 * screen uses when its data already fits in memory -- a settings table, a
 * picking list for one order, anything the backend hands over whole -- and
 * every such screen would otherwise write the same filtering and paging again,
 * slightly differently.
 *
 * It is also the reference implementation of the contract: when the catalogue
 * endpoint arrives, this is what its behaviour is compared against.
 *
 *
 * FILTERING AND SORTING WORK ON THE RAW VALUE, NEVER ON THE FORMATTED TEXT.
 *
 * That is the whole reason the formatters live in the table and not here.
 * Sorting `[1200, 900]` by their formatted strings puts `1.200` before `900`,
 * which is wrong in a way nobody reports as a bug -- they just stop trusting
 * the column.
 */
export class ArrayTableSource<T> implements TableSource<T> {
  constructor(
    private readonly rows: readonly T[],
    /**
     * Which properties the global quick filter looks at. Empty = all the
     * top-level ones, which is the useful default for a table whose columns
     * are the object's own fields.
     */
    private readonly searchable: readonly string[] = [],
  ) {}

  load(query: TableQuery): Observable<TablePage<T>> {
    const matched = this.rows.filter(
      (row) => this.matchesSearch(row, query.search) && this.matchesFilters(row, query.filters),
    );
    const sorted = sortRows(matched, query);
    const from = query.page * query.pageSize;

    return of({
      rows: sorted.slice(from, from + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: sorted.length,
    });
  }

  private matchesSearch(row: T, search: string): boolean {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return true;
    }
    const keys = this.searchable.length > 0 ? this.searchable : Object.keys(row as object);
    return keys.some((key) => String(readCell(row, key) ?? '').toLowerCase().includes(needle));
  }

  private matchesFilters(row: T, filters: Readonly<Record<string, TableFilterValue>>): boolean {
    return Object.entries(filters).every(([key, filter]) =>
      matchesFilter(readCell(row, key), filter),
    );
  }
}

/**
 * One cell against one filter. Exported so the Table's own spec can pin the
 * three shapes down without building a source around them.
 */
export function matchesFilter(value: unknown, filter: TableFilterValue): boolean {
  if (typeof filter === 'string') {
    return (
      filter.trim() === '' ||
      String(value ?? '')
        .toLowerCase()
        .includes(filter.trim().toLowerCase())
    );
  }

  if (isNumberRange(filter)) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      // A row whose value is not a number cannot be inside a numeric range.
      // Keeping it would make "between 100 and 900" quietly include the rows
      // with no value at all.
      return false;
    }
    return (
      (filter.min === undefined || number >= filter.min) &&
      (filter.max === undefined || number <= filter.max)
    );
  }

  if (isDateRange(filter)) {
    /*
     * Dates compare as ISO 8601 STRINGS, which is exact rather than lazy: the
     * format sorts lexicographically by construction, so `'2026-03-04' >=
     * '2026-03-01'` is the same answer a Date comparison gives, without a parse
     * that can silently produce Invalid Date on a value from a source that
     * happens to use another shape.
     */
    const text = String(value ?? '');
    if (text === '') {
      return false;
    }
    return (
      (filter.from === undefined || text >= filter.from) &&
      (filter.to === undefined || text <= filter.to)
    );
  }

  // An empty object is every bound cleared, which is no filter at all.
  return true;
}

/**
 * Sort by the raw value, with a stable order and nothing-last.
 *
 * NOTHING GOES LAST IN BOTH DIRECTIONS, which is not what a naive comparison
 * does. Rows with no value are not "smaller": they are absent, and burying
 * them at the bottom is what every spreadsheet does because it is what people
 * expect. Sorting them to the top on the descending pass would make the first
 * screenful of a descending sort a screenful of blanks.
 */
export function sortRows<T>(rows: readonly T[], query: TableQuery): readonly T[] {
  const sort = query.sort;
  if (!sort) {
    return rows;
  }
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = readCell(a, sort.key);
    const right = readCell(b, sort.key);
    const missing = compareMissing(left, right);
    return missing !== null ? missing : factor * compareValues(left, right);
  });
}

/** `null` when both sides have a value; otherwise the nothing-last answer. */
function compareMissing(left: unknown, right: unknown): number | null {
  const leftEmpty = left === null || left === undefined || left === '';
  const rightEmpty = right === null || right === undefined || right === '';
  if (leftEmpty && rightEmpty) {
    return 0;
  }
  if (leftEmpty) {
    return 1;
  }
  if (rightEmpty) {
    return -1;
  }
  return null;
}

/**
 * Numbers numerically, everything else as text.
 *
 * `localeCompare` and not `<`, so that "Ñandú" lands where a Spanish reader
 * looks for it rather than after "Z".
 */
function compareValues(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}
