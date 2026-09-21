import type { Observable } from 'rxjs';

/**
 * EL CONTRATO DE DATOS de `ewms-search-select` (REQ-FE-DS3-001 RFE-02). No es una
 * abstracción sobre un endpoint que existe: es la especificación del endpoint,
 * escrita antes que él, porque la API de catálogo del WMS todavía no existe y un
 * componente construido contra un contrato imaginado se reescribe el día que
 * llega el real.
 * EL COMPONENTE NO SABE NADA DE HTTP: pasar de la demo a un backend real cambia
 * una implementación de esta interfaz y nada más (§5 del REQ).
 */
export interface SearchSource<T> {
  /**
   * @param query El texto tal como se tipeó. NO lo normaliza el componente:
   *   recortar, plegar mayúsculas o quitar tildes son decisiones sobre los datos,
   *   y quien conoce los datos es la fuente.
   * @param page Base cero. Un texto nuevo siempre pide la página 0.
   */
  search(query: string, page: number): Observable<SearchPage<T>>;
}

/** Una página de resultados (REQ-FE-DS3-001 RFE-02). */
export interface SearchPage<T> {
  /** Los registros de esta página, en el orden en que se muestran. */
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  /**
   * Cuántos coinciden en total, o `null` si la fuente no lo sabe. `null` ES UNA
   * RESPUESTA LEGÍTIMA: una fuente que cuenta filas para contestar esto paga un
   * conteo por tecla, y muchas reales se niegan.
   */
  readonly total: number | null;
  /**
   * Si existe al menos una página más. EXPLÍCITO y no derivado de `total`,
   * justamente porque `total` puede ser null: derivarlo haría desaparecer «cargar
   * más» en toda fuente que no cuente.
   */
  readonly hasMore: boolean;
}

/** El tamaño de página que pide el componente, de RFE-02. */
export const SEARCH_PAGE_SIZE = 20;

/**
 * Cómo el componente convierte un registro en algo que se lee y algo contra lo que
 * comparar un escaneo. Un par de funciones y no un par de nombres de propiedad,
 * porque el valor de este control es el REGISTRO, y un nombre de propiedad forzaría
 * a un tipo envoltorio a todo consumidor sin un campo `label`.
 */
export interface SearchDisplay<T> {
  /** El texto que se ve en el panel y en el campo una vez elegido. */
  label: (item: T) => string;
  /**
   * El código que puede llevar un barcode. Se usa SOLO para decidir si un escaneo
   * identificó exactamente un registro; nunca se muestra. Opcional: una fuente sin
   * código simplemente nunca resuelve un escaneo sin abrir el panel.
   */
  code?: (item: T) => string;
}
