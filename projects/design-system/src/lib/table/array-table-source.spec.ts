import { firstValueFrom } from 'rxjs';
import { ArrayTableSource, matchesFilter, sortRows } from './array-table-source';
import { emptyQuery, type TableQuery } from './table-source';

interface Row {
  readonly codigo: string;
  readonly cliente: string;
  readonly fecha: string;
  readonly bultos: number;
}

const ROWS: readonly Row[] = [
  { codigo: 'EXP-0001', cliente: 'Andes', fecha: '2026-01-15', bultos: 1200 },
  { codigo: 'EXP-0002', cliente: 'Valle', fecha: '2026-02-03', bultos: 900 },
  { codigo: 'EXP-0003', cliente: 'Norte', fecha: '2026-03-21', bultos: 40 },
  { codigo: 'EXP-0004', cliente: 'Ñandú', fecha: '2026-01-02', bultos: 0 },
];

function query(partial: Partial<TableQuery> = {}): TableQuery {
  return { ...emptyQuery(10), ...partial };
}

describe('ArrayTableSource', () => {
  const source = new ArrayTableSource(ROWS);

  it('returns everything, with the total, when nothing is asked of it', async () => {
    const page = await firstValueFrom(source.load(query()));
    expect(page.rows.length).toBe(4);
    expect(page.total).toBe(4);
    expect(page.page).toBe(0);
  });

  it('pages', async () => {
    const first = await firstValueFrom(source.load(query({ pageSize: 2 })));
    expect(first.rows.map((row) => row.codigo)).toEqual(['EXP-0001', 'EXP-0002']);

    const second = await firstValueFrom(source.load(query({ pageSize: 2, page: 1 })));
    expect(second.rows.map((row) => row.codigo)).toEqual(['EXP-0003', 'EXP-0004']);
    // The total is of the MATCH, not of the page: without it a paginator
    // cannot know there is a second page.
    expect(second.total).toBe(4);
  });

  it('searches every top-level property by default', async () => {
    const page = await firstValueFrom(source.load(query({ search: 'norte' })));
    expect(page.rows.map((row) => row.codigo)).toEqual(['EXP-0003']);
  });

  it('searches only the named properties when it is given some', async () => {
    const narrow = new ArrayTableSource(ROWS, ['codigo']);
    const page = await firstValueFrom(narrow.load(query({ search: 'norte' })));
    expect(page.rows).toEqual([]);
  });

  it('applies a per-column filter alongside the search', async () => {
    const page = await firstValueFrom(
      source.load(query({ search: 'EXP', filters: { cliente: 'val' } })),
    );
    expect(page.rows.map((row) => row.cliente)).toEqual(['Valle']);
  });
});

/**
 * The three filter shapes.
 *
 * They are tested through `matchesFilter` rather than through a source,
 * because what is being pinned down is THE CONTRACT -- the same three shapes
 * the backend will be asked to honour.
 */
describe('matchesFilter', () => {
  describe('text', () => {
    it('matches a substring, ignoring case', () => {
      expect(matchesFilter('Caja plegable', 'PLEG')).toBe(true);
      expect(matchesFilter('Caja plegable', 'film')).toBe(false);
    });

    it('matches everything when it is blank', () => {
      expect(matchesFilter('lo que sea', '   ')).toBe(true);
    });

    it('treats a missing value as the empty string rather than throwing', () => {
      expect(matchesFilter(undefined, 'algo')).toBe(false);
      expect(matchesFilter(null, '')).toBe(true);
    });
  });

  describe('number range', () => {
    it('honours both bounds', () => {
      expect(matchesFilter(50, { min: 10, max: 100 })).toBe(true);
      expect(matchesFilter(5, { min: 10, max: 100 })).toBe(false);
      expect(matchesFilter(500, { min: 10, max: 100 })).toBe(false);
    });

    it('A MISSING BOUND IS UNBOUNDED, NOT ZERO', () => {
      // "Up to 50" is a max with no min. Reading the empty box as 0 would
      // silently drop every row below it -- including the negative ones, which
      // is how an adjustment column starts lying.
      expect(matchesFilter(-40, { max: 50 })).toBe(true);
      expect(matchesFilter(0, { max: 50 })).toBe(true);
      expect(matchesFilter(9000, { min: 50 })).toBe(true);
    });

    it('excludes a row whose value is not a number at all', () => {
      // Keeping it would make "between 100 and 900" quietly include the rows
      // with no value.
      expect(matchesFilter('sin dato', { min: 100 })).toBe(false);
      expect(matchesFilter(null, { min: 100 })).toBe(false);
    });
  });

  describe('date range', () => {
    it('compares ISO strings, which sort by construction', () => {
      expect(matchesFilter('2026-02-03', { from: '2026-02-01', to: '2026-02-28' })).toBe(true);
      expect(matchesFilter('2026-03-03', { from: '2026-02-01', to: '2026-02-28' })).toBe(false);
    });

    it('honours one bound alone', () => {
      expect(matchesFilter('2026-05-01', { from: '2026-02-01' })).toBe(true);
      expect(matchesFilter('2026-01-01', { from: '2026-02-01' })).toBe(false);
    });

    it('excludes a row with no date', () => {
      expect(matchesFilter('', { from: '2026-01-01' })).toBe(false);
    });
  });

  it('an empty object is every bound cleared, which is no filter at all', () => {
    expect(matchesFilter('lo que sea', {})).toBe(true);
  });
});

describe('sortRows', () => {
  it('returns the rows untouched when there is no sort', () => {
    expect(sortRows(ROWS, query())).toBe(ROWS);
  });

  it('SORTS NUMBERS NUMERICALLY, not as the text somebody would see', () => {
    /*
     * This is the test the formatters exist for. A source that sorted by the
     * formatted string would put `1.200` before `900`, and nobody reports that
     * as a bug -- they just stop trusting the column.
     */
    const sorted = sortRows(ROWS, query({ sort: { key: 'bultos', direction: 'asc' } }));
    expect(sorted.map((row) => row.bultos)).toEqual([0, 40, 900, 1200]);
  });

  it('sorts descending too', () => {
    const sorted = sortRows(ROWS, query({ sort: { key: 'bultos', direction: 'desc' } }));
    expect(sorted.map((row) => row.bultos)).toEqual([1200, 900, 40, 0]);
  });

  it('sorts text by collation, so an accent is not a different letter', () => {
    const sorted = sortRows(ROWS, query({ sort: { key: 'cliente', direction: 'asc' } }));
    /*
     * `localeCompare` reads "Ñandú" as an N with a mark on it and compares the
     * base letters first, so it lands between "Andes" and "Norte". A codepoint
     * comparison would put it after "Valle" -- after Z, in fact -- which is
     * the kind of ordering that makes somebody conclude the column is broken.
     */
    expect(sorted.map((row) => row.cliente)).toEqual(['Andes', 'Ñandú', 'Norte', 'Valle']);
  });

  it('puts rows with nothing LAST in both directions', () => {
    const withGaps: readonly Partial<Row>[] = [
      { codigo: 'a', cliente: 'Zeta' },
      { codigo: 'b' },
      { codigo: 'c', cliente: 'Alfa' },
    ];

    const ascending = sortRows(withGaps, query({ sort: { key: 'cliente', direction: 'asc' } }));
    expect(ascending.map((row) => row.codigo)).toEqual(['c', 'a', 'b']);

    const descending = sortRows(withGaps, query({ sort: { key: 'cliente', direction: 'desc' } }));
    // Still last. Sorting the blanks to the top on the descending pass would
    // make the first screenful of a descending sort a screenful of nothing.
    expect(descending.map((row) => row.codigo)).toEqual(['a', 'c', 'b']);
  });

  it('leaves two empty values in their original order', () => {
    const rows = [{ codigo: 'a' }, { codigo: 'b' }];
    const sorted = sortRows(rows, query({ sort: { key: 'cliente', direction: 'asc' } }));
    expect(sorted.map((row) => row.codigo)).toEqual(['a', 'b']);
  });

  it('does not mutate what it was given', () => {
    const original = [...ROWS];
    sortRows(ROWS, query({ sort: { key: 'bultos', direction: 'desc' } }));
    expect(ROWS).toEqual(original);
  });
});
