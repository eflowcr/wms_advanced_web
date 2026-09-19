import { SEARCH_PAGE_SIZE, type SearchPage, type SearchSource } from '@ewms/design-system';
import { Observable, throwError, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import type { ExpedicionRow } from '../components/expediciones';

/**
 * The example screen's search source, over the shipments already on the
 * screen's table.
 *
 * ONE LIST BEHIND BOTH CONTROLS, and that is what makes the flows mean
 * anything: searching finds a shipment the table really holds, and saving one
 * changes what the next search returns. Two lists would have made every count
 * a count of a demo rather than of a flow.
 *
 * Synthetic throughout. No real data of any customer, ever (PLN-WMS-003 §6).
 *
 * The latency is small and real: 120 ms is enough for the searching state to
 * exist without making the click count a test of somebody's patience. The
 * search select's own sheet uses 400 ms because showing that state IS its
 * subject; here it is not.
 */
export class ExpedicionSource implements SearchSource<ExpedicionRow> {
  constructor(
    private readonly rows: () => readonly ExpedicionRow[],
    /** Flipped by the demo to show the error path. */
    private readonly failing: () => boolean,
  ) {}

  search(query: string, page: number): Observable<SearchPage<ExpedicionRow>> {
    return timer(120).pipe(
      switchMap(() =>
        this.failing()
          ? throwError(() => new Error('demo: the source refused'))
          : new Observable<SearchPage<ExpedicionRow>>((subscriber) => {
              subscriber.next(this.page(query, page));
              subscriber.complete();
            }),
      ),
    );
  }

  /** What the backend will do when it exists. The component never learns how. */
  private page(query: string, page: number): SearchPage<ExpedicionRow> {
    const needle = query.trim().toLowerCase();
    const matches = this.rows().filter(
      (row) =>
        row.codigo.toLowerCase().includes(needle) || row.cliente.toLowerCase().includes(needle),
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
