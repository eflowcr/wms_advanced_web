import { SEARCH_PAGE_SIZE, type SearchPage, type SearchSource } from '@ewms/design-system';
import { Observable, throwError, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import type { ShipmentRow } from '../components/shipments';

/**
 * Fuente de búsqueda de la pantalla ejemplo, sobre las mismas filas de la tabla: buscar encuentra
 * lo que la tabla tiene y guardar cambia la próxima búsqueda. Datos sintéticos (PLN-WMS-003 §6).
 */
// 120 ms: alcanza para que exista el estado «buscando» sin volver el conteo una prueba de
// paciencia. La ficha del selector usa 400 ms porque ese estado es su tema.
export class ShipmentSource implements SearchSource<ShipmentRow> {
  constructor(
    private readonly rows: () => readonly ShipmentRow[],
    /** La demo lo invierte para mostrar el camino de error. */
    private readonly failing: () => boolean,
  ) {}

  search(query: string, page: number): Observable<SearchPage<ShipmentRow>> {
    return timer(120).pipe(
      switchMap(() =>
        this.failing()
          ? throwError(() => new Error('demo: the source refused'))
          : new Observable<SearchPage<ShipmentRow>>((subscriber) => {
              subscriber.next(this.page(query, page));
              subscriber.complete();
            }),
      ),
    );
  }

  /** Lo que hará el backend cuando exista; el componente nunca sabe cómo. */
  private page(query: string, page: number): SearchPage<ShipmentRow> {
    const needle = query.trim().toLowerCase();
    const matches = this.rows().filter(
      (row) =>
        row.code.toLowerCase().includes(needle) || row.customer.toLowerCase().includes(needle),
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
