import { aggregateOf, totalsRows } from './table-totals';

const ROWS = [{ n: 3 }, { n: '7' }, { n: null }, { n: 'x' }, { n: 0 }];

describe('aggregateOf', () => {
  it('works on the raw value: sum, average, count, minimum and maximum', () => {
    expect(aggregateOf('sum', ROWS, 'n')).toBe(10);
    expect(aggregateOf('avg', ROWS, 'n')).toBeCloseTo(10 / 3);
    // `count` cuenta las filas con número, no todas.
    expect(aggregateOf('count', ROWS, 'n')).toBe(3);
    expect(aggregateOf('min', ROWS, 'n')).toBe(0);
    expect(aggregateOf('max', ROWS, 'n')).toBe(7);
  });

  it('with no numbers there is no average and no extreme: null, never zero', () => {
    const none = [{ n: null }, { n: '' }];
    expect(aggregateOf('avg', none, 'n')).toBeNull();
    expect(aggregateOf('min', none, 'n')).toBeNull();
    expect(aggregateOf('max', none, 'n')).toBeNull();
    expect(aggregateOf('sum', none, 'n')).toBe(0);
    expect(aggregateOf('count', none, 'n')).toBe(0);
  });
});

describe('totalsRows', () => {
  const page = [{}, {}];
  const base = { selected: [], matching: undefined, page, total: 2, filtered: false } as const;

  it('the selection first, whatever the source', () => {
    expect(totalsRows({ ...base, selected: [{}] })).toEqual({ scope: 'selected', count: 1, rows: [{}] });
  });

  it('everything filtered when the source has it in memory, and says if it was filtered', () => {
    const matching = [{}, {}, {}];
    expect(totalsRows({ ...base, matching })).toEqual({ scope: 'all', count: 3, rows: matching });
    expect(totalsRows({ ...base, matching, filtered: true }).scope).toBe('filtered');
  });

  it('a remote source: the whole set if the page holds it, the page if not, nothing if it does not count', () => {
    expect(totalsRows(base).scope).toBe('all');
    expect(totalsRows({ ...base, total: 40 })).toEqual({ scope: 'page', count: 2, rows: page });
    expect(totalsRows({ ...base, total: null })).toEqual({ scope: 'page', count: 2, rows: null });
  });
});
