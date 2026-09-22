import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, type Observable } from 'rxjs';
import { catchError, map, switchMap, tap, timeout } from 'rxjs/operators';
import type { SearchPage } from './search-source';
import type { SearchStatus, SelectMessages } from './select.types';

export interface SearchRequest {
  readonly query: string;
  readonly page: number;
  readonly append: boolean;
  /** Vino de una ráfaga de escáner: resuelve sin abrir el panel si puede. */
  readonly scan: boolean;
}

/** Lo que el campo le presta al motor: de dónde buscar y qué hacer al empezar y al llegar. */
export interface SelectSearchHost {
  search(query: string, page: number): Observable<SearchPage<unknown>>;
  /** `null`: sin límite (memoria, o sin token de timeout). */
  timeoutMs(): number | null;
  started(request: SearchRequest): void;
  arrived(request: SearchRequest): void;
  failed(): void;
}

/**
 * El motor de consultas del Select, sin DOM: páginas, estados y reintento (REQ-FE-DS3-001
 * RFE-01 a RFE-05). Interno; se crea en el contexto de inyección del componente.
 */
export class SelectSearch {
  readonly rows = signal<readonly unknown[]>([]);
  readonly status = signal<SearchStatus>('idle');
  readonly hasMore = signal(false);
  readonly total = signal<number | null>(null);
  /** Para el mensaje «sin resultados para X». */
  readonly searchedText = signal('');

  /** RFE-04: el reintento repite esta petición tal cual. */
  private last: SearchRequest | null = null;
  private readonly requests = new Subject<SearchRequest>();

  constructor(private readonly host: SelectSearchHost) {
    // `switchMap` cancela la consulta en vuelo; si no, una respuesta lenta de otro texto
    // pinta resultados viejos sobre frescos (PACQ-01.2).
    this.requests
      .pipe(
        tap((request) => this.start(request)),
        switchMap((request) => this.run(request)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  find(query: string, scan = false): void {
    this.requests.next({ query, page: 0, append: false, scan });
  }

  /** RFE-05: la página siguiente se agrega, nunca reemplaza. */
  more(): void {
    if (this.last && this.hasMore()) {
      this.requests.next({ ...this.last, page: this.last.page + 1, append: true, scan: false });
    }
  }

  /** RFE-04: mismo texto y misma página. */
  retry(): void {
    if (this.last) {
      this.requests.next({ ...this.last, scan: false });
    }
  }

  /** RFE-08: lo que dice la región viva en cada estado. */
  announce(words: SelectMessages): string {
    switch (this.status()) {
      case 'searching':
        return words.searching;
      case 'empty':
        return words.noResults(this.searchedText());
      case 'error':
        return words.error;
      case 'ready':
        return words.results(this.rows().length, this.total());
      case 'idle':
        return '';
    }
  }

  /** RFE-03: vaciar la caja no busca. */
  clear(): void {
    this.status.set('idle');
    this.rows.set([]);
    this.hasMore.set(false);
  }

  private start(request: SearchRequest): void {
    this.last = request;
    this.searchedText.set(request.query);
    this.status.set('searching');
    if (!request.append) {
      // Todo: un `hasMore` viejo ofrecía la página 2 de otra búsqueda (PACQ-04.2).
      this.rows.set([]);
      this.hasMore.set(false);
      this.total.set(null);
    }
    this.host.started(request);
  }

  /** Nunca emite error: uno que escape mata la suscripción y el campo ya no busca más. */
  private run(request: SearchRequest) {
    const query = this.host.search(request.query, request.page);
    const waited = this.host.timeoutMs();
    return (waited === null ? query : query.pipe(timeout({ first: waited }))).pipe(
      map((page) => {
        this.rows.update((current) => (request.append ? [...current, ...page.items] : page.items));
        this.hasMore.set(page.hasMore);
        this.total.set(page.total);
        this.status.set(this.rows().length === 0 ? 'empty' : 'ready');
        this.host.arrived(request);
        return page;
      }),
      // RFE-02: un timeout es error del servicio, no «sin resultados».
      catchError(() => {
        this.status.set('error');
        this.host.failed();
        return EMPTY;
      }),
    );
  }
}
