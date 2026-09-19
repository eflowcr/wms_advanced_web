import { firstValueFrom } from 'rxjs';
import {
  CATALOGUE,
  CatalogueSource,
  UncountedSource,
  type SearchPageOfArticle,
  type SourceBehaviour,
} from './search-catalogue';

/**
 * The demo's data source, tested on its own.
 *
 * IT IS DEMO CODE AND IT STILL GETS A SPEC, because it is the stand-in for the
 * catalogue endpoint: what it does -- filter, page, count, fail, take its time
 * -- is exactly what the backend will be asked to do, and the component's own
 * spec proves nothing about whether this half of the contract is honoured.
 */
describe('CatalogueSource', () => {
  let behaviour: SourceBehaviour;
  let queries: { query: string; page: number }[];
  let source: CatalogueSource;

  beforeEach(() => {
    vi.useFakeTimers();
    behaviour = 'normal';
    queries = [];
    source = new CatalogueSource(
      () => behaviour,
      (query, page) => queries.push({ query, page }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Subscribe, run the clock forward, and hand back what arrived. */
  async function ask(query: string, page = 0): Promise<SearchPageOfArticle> {
    const answer = firstValueFrom(source.search(query, page));
    await vi.advanceTimersByTimeAsync(7000);
    return answer;
  }

  it('is the same catalogue on every load, because it is seeded', () => {
    expect(CATALOGUE.length).toBe(340);
    expect(CATALOGUE[0]?.code).toBe('SKU-88000');
    expect(CATALOGUE[42]?.code).toBe('SKU-88042');
    // Same codes, same names, run after run: a capture has to be comparable.
    expect(CATALOGUE[42]?.name).toBe(CATALOGUE[42]?.name);
    expect(new Set(CATALOGUE.map((article) => article.code)).size).toBe(CATALOGUE.length);
  });

  it('records every query it is asked, which is what the page shows', async () => {
    await ask('caja', 1);
    expect(queries).toEqual([{ query: 'caja', page: 1 }]);
  });

  it('filters by code, by name and by family, ignoring case', async () => {
    const byCode = await ask('SKU-88042');
    expect(byCode.items.length).toBe(1);
    expect(byCode.items[0]?.code).toBe('SKU-88042');

    const byFamily = await ask('embalaje');
    expect(byFamily.items.length).toBeGreaterThan(0);
    for (const article of byFamily.items) {
      expect(article.family.toLowerCase()).toContain('embalaje');
    }
  });

  it('pages, and says whether there is more', async () => {
    const first = await ask('SKU', 0);
    expect(first.items.length).toBe(20);
    expect(first.page).toBe(0);
    expect(first.pageSize).toBe(20);
    expect(first.total).toBe(340);
    expect(first.hasMore).toBe(true);

    const last = await ask('SKU', 16);
    expect(last.items.length).toBe(20);
    expect(last.hasMore).toBe(false);
  });

  it('answers an empty page rather than failing when nothing matches', async () => {
    const answer = await ask('no-existe-este-articulo');
    expect(answer.items).toEqual([]);
    expect(answer.total).toBe(0);
    expect(answer.hasMore).toBe(false);
  });

  it('takes its time, so the searching state is something you can actually see', async () => {
    let landed = false;
    source.search('caja', 0).subscribe(() => {
      landed = true;
    });

    await vi.advanceTimersByTimeAsync(399);
    expect(landed).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(landed).toBe(true);
  });

  it('can be made to take longer than the timeout token allows', async () => {
    behaviour = 'slow';
    let landed = false;
    source.search('caja', 0).subscribe(() => {
      landed = true;
    });

    // Past the 5 s the component tolerates, and still nothing.
    await vi.advanceTimersByTimeAsync(5000);
    expect(landed).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(landed).toBe(true);
  });

  it('can be made to fail outright', async () => {
    behaviour = 'failing';
    let failed = false;
    source.search('caja', 0).subscribe({
      error: () => {
        failed = true;
      },
    });

    await vi.advanceTimersByTimeAsync(400);
    expect(failed).toBe(true);
  });
});

describe('UncountedSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers the same page with total null, which the contract allows', async () => {
    const inner = new CatalogueSource(
      () => 'normal',
      () => undefined,
    );
    const answer = firstValueFrom(new UncountedSource(inner).search('SKU', 0));
    await vi.advanceTimersByTimeAsync(400);

    const page = await answer;
    expect(page.total).toBeNull();
    // Everything else is untouched: a source that declines to count still
    // knows whether there is more.
    expect(page.items.length).toBe(20);
    expect(page.hasMore).toBe(true);
  });
});
