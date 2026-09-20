import { SEARCH_PAGE_SIZE, type SearchPage, type SearchSource } from '@ewms/design-system';
import { Observable, throwError, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

/** One page of articles, named so a spec can say what it expects back. */
export type SearchPageOfArticle = SearchPage<Article>;

/** A synthetic article. No real data of any customer, ever (PLN-WMS-003 §6). */
export interface Article {
  readonly code: string;
  readonly name: string;
  readonly family: string;
}

const FAMILIES = [
  'Embalaje',
  'Film y flejes',
  'Etiquetas',
  'Repuestos',
  'Consumibles',
  'Higiene',
] as const;

const SHAPES = [
  'Caja plegable',
  'Caja americana',
  'Film estirable',
  'Fleje de poliéster',
  'Etiqueta térmica',
  'Separador de cartón',
  'Esquinero',
  'Bolsa de burbuja',
  'Cinta de embalar',
  'Palet de plástico',
] as const;

/**
 * A seeded generator, so the catalogue is the SAME on every load.
 *
 * Captures of this page have to be comparable between one run and the next,
 * and a `Math.random()` catalogue makes every screenshot a different page.
 * This is the same reason the expediciones demo of the Table is seeded.
 *
 * xorshift32 rather than anything cleverer: it is four lines, it has no state
 * to get wrong, and the only property needed here is "the same sequence every
 * time".
 */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return Math.abs(state) / 2 ** 31;
  };
}

/** 340 synthetic articles, identical on every load. */
export const CATALOGUE: readonly Article[] = buildCatalogue();

function buildCatalogue(): readonly Article[] {
  const random = seeded(20260918);
  const articles: Article[] = [];
  for (let index = 0; index < 340; index += 1) {
    const shape = SHAPES[Math.floor(random() * SHAPES.length)] ?? SHAPES[0];
    const family = FAMILIES[Math.floor(random() * FAMILIES.length)] ?? FAMILIES[0];
    const width = 20 + Math.floor(random() * 80);
    const height = 20 + Math.floor(random() * 60);
    articles.push({
      code: `SKU-${String(88000 + index)}`,
      name: `${shape} ${width}x${height}`,
      family,
    });
  }
  return articles;
}

/** How the demo source can be made to misbehave, on purpose. */
export type SourceBehaviour =
  /** Answers after a short, plausible wait. */
  | 'normal'
  /** Answers after longer than the timeout token allows. */
  | 'slow'
  /** Fails outright. */
  | 'failing';

/**
 * The demo's data source: IN MEMORY, WITH SIMULATED LATENCY.
 *
 * NOT MSW, AND THAT IS A REPORTED DEVIATION FROM THE REQ, NOT AN OVERSIGHT.
 * REQ-FE-DS3-001 §3 asks for the demo to be built on MSW. Building it that way
 * means the demo calls `fetch` at a URL and a service worker answers -- and to
 * work at all, `mockServiceWorker.js` has to be served from the shell's
 * `public/`, which `angular.json` copies WHOLE into the production build. The
 * page would then ship a service worker and, with no worker registered in
 * production, its `fetch` would leave for a real origin. That is a real HTTP
 * call from showroom code, which HG-02 forbids in as many words.
 *
 * This source satisfies every RFE the MSW version would: it is an
 * implementation of `SearchSource` and nothing else, it pages, it waits, it
 * fails on demand, and it knows nothing about the component. The day a
 * catalogue endpoint exists, what changes is this class and nothing else --
 * which is the portability claim the REQ actually cares about.
 *
 * The verdict is reported rather than settled: see the DS-3 report.
 */
export class CatalogueSource implements SearchSource<Article> {
  constructor(
    private readonly behaviour: () => SourceBehaviour,
    /** Every query, recorded, so the page can show what it asked for. */
    private readonly onQuery: (query: string, page: number) => void,
  ) {}

  search(query: string, page: number): Observable<SearchPage<Article>> {
    this.onQuery(query, page);
    const behaviour = this.behaviour();

    /*
     * The latency is simulated because a source that answers synchronously
     * would never show the searching state, and a demo where the spinner is
     * impossible to see is a demo of a component that does not have one.
     */
    const wait = behaviour === 'slow' ? 6000 : 400;

    return timer(wait).pipe(
      switchMap(() =>
        behaviour === 'failing'
          ? throwError(() => new Error('demo: the source refused'))
          : new Observable<SearchPage<Article>>((subscriber) => {
              subscriber.next(this.page(query, page));
              subscriber.complete();
            }),
      ),
      map((result) => result),
    );
  }

  /**
   * The filtering and the paging, which the BACKEND will do when it exists.
   * Written here so the component never learns how either one works.
   */
  private page(query: string, page: number): SearchPage<Article> {
    const needle = query.trim().toLowerCase();
    const matches = CATALOGUE.filter(
      (article) =>
        article.code.toLowerCase().includes(needle) ||
        article.name.toLowerCase().includes(needle) ||
        article.family.toLowerCase().includes(needle),
    );
    const from = page * SEARCH_PAGE_SIZE;
    const items = matches.slice(from, from + SEARCH_PAGE_SIZE);
    return {
      items,
      page,
      pageSize: SEARCH_PAGE_SIZE,
      total: matches.length,
      hasMore: from + items.length < matches.length,
    };
  }
}

/**
 * The same catalogue, from a source that declines to count.
 *
 * It exists because `total: null` is a legitimate answer in the contract
 * (RFE-02) and the component has to work with it -- and "has to work with it"
 * is a claim worth showing on the page rather than asserting in a comment.
 */
export class UncountedSource implements SearchSource<Article> {
  constructor(private readonly inner: CatalogueSource) {}

  search(query: string, page: number): Observable<SearchPage<Article>> {
    return this.inner.search(query, page).pipe(map((result) => ({ ...result, total: null })));
  }
}
