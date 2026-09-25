import { SEARCH_PAGE_SIZE, type SearchPage, type SearchSource } from '@ewms/design-system';
import { Observable, throwError, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ARTICLE_FAMILIES as FAMILIES, ARTICLE_SHAPES as SHAPES } from './select.fixtures';

/** Una página de artículos, con nombre para que la prueba diga qué espera. */
export type SearchPageOfArticle = SearchPage<Article>;

/** Artículo sintético: nunca datos reales de un cliente (PLN-WMS-003 §6). */
export interface Article {
  readonly code: string;
  readonly name: string;
  readonly family: string;
}

/**
 * Generador con semilla (xorshift32): el catálogo sale igual en cada carga para
 * que las capturas sean comparables entre corridas, como en expediciones.
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

/** 340 artículos sintéticos, idénticos en cada carga. */
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

/** Cómo se puede hacer fallar a propósito la fuente de la demo. */
export type SourceBehaviour =
  /** Responde tras una espera corta y verosímil. */
  | 'normal'
  /** Responde después de lo que permite el token de timeout. */
  | 'slow'
  /** Falla directamente. */
  | 'failing';

/**
 * Fuente de la demo en memoria con latencia simulada, sin MSW: servir su worker
 * lo mandaría a producción con fetch a un origen real (HG-02). Con backend, solo
 * cambia esta clase. Ver vault: 08-Sistema-de-Diseno/Componentes/Select.
 */
export class CatalogueSource implements SearchSource<Article> {
  constructor(
    private readonly behaviour: () => SourceBehaviour,
    /** Registra cada consulta para que la página muestre qué pidió. */
    private readonly onQuery: (query: string, page: number) => void,
  ) {}

  search(query: string, page: number): Observable<SearchPage<Article>> {
    this.onQuery(query, page);
    const behaviour = this.behaviour();

    // Sin latencia, el estado «buscando» no se vería nunca en la demo.
    const wait = behaviour === 'slow' ? 6000 : 400;

    return timer(wait).pipe(
      switchMap(() =>
        behaviour === 'failing'
          ? throwError(() => new Error('demo: source refused'))
          : new Observable<SearchPage<Article>>((subscriber) => {
              subscriber.next(this.page(query, page));
              subscriber.complete();
            }),
      ),
      map((result) => result),
    );
  }

  /** Filtrado y paginado que hará el backend; acá, para que el componente no los conozca. */
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
 * El mismo catálogo desde una fuente que no cuenta: total null es una respuesta
 * válida del contrato (RFE-02) y la página muestra que el componente la soporta.
 */
export class UncountedSource implements SearchSource<Article> {
  constructor(private readonly inner: CatalogueSource) {}

  search(query: string, page: number): Observable<SearchPage<Article>> {
    return this.inner.search(query, page).pipe(map((result) => ({ ...result, total: null })));
  }
}
