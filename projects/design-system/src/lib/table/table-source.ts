import type { Observable } from 'rxjs';

/** Contrato de datos: la tabla no sabe de HTTP. Ver vault: Tabla §3. */
export interface TableSource<T> {
  load(query: TableQuery): Observable<TablePage<T>>;
  /**
   * Todas las filas que la consulta deja, ordenadas y sin paginar. Solo una fuente en memoria
   * la tiene: con ella la tabla exporta en el cliente; sin ella emite `(exportRequest)`.
   */
  matching?(query: TableQuery): readonly T[];
}

/** La forma sale del tipo de columna: un rango como texto no se puede comparar. */
export type TableFilterValue = string | NumberRange | DateRange | SetFilter;

/** Un límite ausente es «sin límite». */
export interface NumberRange {
  min?: number;
  max?: number;
}

/** ISO 8601; un límite ausente es «sin límite». */
export interface DateRange {
  from?: string;
  to?: string;
}

/** Claves del diccionario `badges` que pasan (filtro de conjunto). Vacío = ninguna elegida. */
export type SetFilter = readonly string[];

/** Guardas con nombre: TypeScript no estrecha la rama negativa de un `in` en línea. */
export function isSetFilter(filter: TableFilterValue): filter is SetFilter {
  return Array.isArray(filter);
}

export function isNumberRange(filter: TableFilterValue): filter is NumberRange {
  return typeof filter === 'object' && !isSetFilter(filter) && ('min' in filter || 'max' in filter);
}

export function isDateRange(filter: TableFilterValue): filter is DateRange {
  return typeof filter === 'object' && !isSetFilter(filter) && ('from' in filter || 'to' in filter);
}

export interface TableQuery {
  /** Filtro rápido global; cadena vacía si no hay. */
  readonly search: string;
  /** Por `key`; clave ausente = sin filtro. */
  readonly filters: Readonly<Record<string, TableFilterValue>>;
  readonly sort: TableSort | null;
  readonly page: number;
  readonly pageSize: number;
}

export interface TableSort {
  readonly key: string;
  readonly direction: 'asc' | 'desc';
}

export interface TablePage<T> {
  readonly rows: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  /** `null` si la fuente no cuenta: legítimo, y sin total no hay paginador. */
  readonly total: number | null;
}

export function emptyQuery(pageSize: number): TableQuery {
  return { search: '', filters: {}, sort: null, page: 0, pageSize };
}

/** Primer nivel: `key` es un nombre, no un camino. Para más, `ewmsCell`. */
export function readCell<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}
