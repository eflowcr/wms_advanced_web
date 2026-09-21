import type { Observable } from 'rxjs';

/**
 * Contrato de datos de `ewms-search-select` (REQ-FE-DS3-001 RFE-02): la especificación del
 * endpoint de catálogo, escrita antes que él. Sin HTTP adentro. Ver vault: Search-Select.
 */
export interface SearchSource<T> {
  /**
   * @param query Tal como se tipeó: normalizar es decisión de la fuente, que conoce los datos.
   * @param page Base cero; un texto nuevo pide la 0.
   */
  search(query: string, page: number): Observable<SearchPage<T>>;
}

/** Una página de resultados (REQ-FE-DS3-001 RFE-02). */
export interface SearchPage<T> {
  /** En el orden en que se muestran. */
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  /** `null` es legítimo: contar filas cuesta un conteo por tecla y muchas fuentes se niegan. */
  readonly total: number | null;
  /** Explícito y no derivado de `total`, que puede ser null: si no, «cargar más» desaparece. */
  readonly hasMore: boolean;
}

/** RFE-02. */
export const SEARCH_PAGE_SIZE = 20;

/**
 * Funciones y no nombres de propiedad: el valor es el registro, y un nombre obligaría a
 * envolver todo tipo sin campo `label`.
 */
export interface SearchDisplay<T> {
  label: (item: T) => string;
  /** Solo decide si un escaneo identificó un registro; sin él, un escaneo siempre abre el panel. */
  code?: (item: T) => string;
}
