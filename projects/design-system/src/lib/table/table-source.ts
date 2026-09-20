import type { Observable } from 'rxjs';

/**
 * EL CONTRATO DE DATOS de `ewms-table`. Como `SearchSource<T>`, es la
 * especificación del endpoint escrita antes que él: la tabla no sabe nada de
 * HTTP, y pasar a un backend real cambia una implementación y nada más.
 */
export interface TableSource<T> {
  load(query: TableQuery): Observable<TablePage<T>>;
}

/**
 * Qué lleva el filtro de una columna, Y LA FORMA SALE DEL TIPO DE LA COLUMNA. Un
 * rango escrito como texto es un filtro que no puede comparar: «100-900» obliga a
 * cada implementación a parsearlo, y lo parsearán distinto. Una columna numérica
 * manda dos números y una de fecha dos fechas ISO.
 */
export type TableFilterValue = string | NumberRange | DateRange;

/** `number`: cualquiera de los dos límites puede faltar, y eso es «sin límite». */
export interface NumberRange {
  min?: number;
  max?: number;
}

/** `date`: ISO 8601, cualquiera de los dos límites puede faltar. */
export interface DateRange {
  from?: string;
  to?: string;
}

/**
 * Los dos rangos se distinguen con GUARDAS CON NOMBRE y no con un `in` en línea:
 * TypeScript no estrecha la rama negativa de `'min' in f || 'max' in f` -se lee
 * como si debiera y deja el otro lado como la unión entera-.
 */
export function isNumberRange(filter: TableFilterValue): filter is NumberRange {
  return typeof filter !== 'string' && ('min' in filter || 'max' in filter);
}

export function isDateRange(filter: TableFilterValue): filter is DateRange {
  return typeof filter !== 'string' && ('from' in filter || 'to' in filter);
}

/** Todo lo que la tabla está pidiendo, en un objeto. */
export interface TableQuery {
  /** El filtro rápido global. Cadena vacía cuando no hay. */
  readonly search: string;
  /** Por columna, por su `key`. Clave ausente = sin filtro. */
  readonly filters: Readonly<Record<string, TableFilterValue>>;
  readonly sort: TableSort | null;
  /** Base cero. */
  readonly page: number;
  readonly pageSize: number;
}

export interface TableSort {
  readonly key: string;
  readonly direction: 'asc' | 'desc';
}

/** Una página de filas. */
export interface TablePage<T> {
  readonly rows: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  /**
   * Cuántas filas coinciden, o `null` si la fuente no lo sabe. `null` ES UNA
   * RESPUESTA LEGÍTIMA, igual que en `SearchPage`. SIN TOTAL NO HAY PAGINADOR, y
   * es honesto: uno sin última página es un control que miente sobre hasta dónde
   * llega.
   */
  readonly total: number | null;
}

/** La consulta vacía, que es lo que pide una tabla antes de que nadie la toque. */
export function emptyQuery(pageSize: number): TableQuery {
  return { search: '', filters: {}, sort: null, page: 0, pageSize };
}

/**
 * Lee una propiedad de primer nivel de una fila. `key` es un NOMBRE y no un
 * camino a propósito: un camino necesita un parser, un parser necesita un caso de
 * error, y la salida para algo más profundo ya existe y es mejor -una plantilla
 * `ewmsCell`, donde el consumidor escribe Angular común-.
 */
export function readCell<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}
