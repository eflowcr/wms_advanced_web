import { Observable, of } from 'rxjs';
import {
  isDateRange,
  isNumberRange,
  readCell,
  type TableFilterValue,
  type TablePage,
  type TableQuery,
  type TableSource,
} from './table-source';

/**
 * Un `TableSource` sobre un arreglo en memoria. SALE DE LA LIBRERÍA, al revés que
 * la fuente de demo del selector: esto es lo que usa una pantalla cuyos datos ya
 * caben en memoria, y si no cada una escribiría el mismo filtrado y paginado,
 * distinto. Es además la implementación de referencia del contrato.
 * FILTRAR Y ORDENAR TRABAJAN SOBRE EL VALOR CRUDO, nunca sobre el texto
 * formateado: ordenar `[1200, 900]` por sus cadenas pone «1.200» antes que «900»,
 * que está mal de un modo que nadie reporta -simplemente dejan de confiar.
 */
export class ArrayTableSource<T> implements TableSource<T> {
  constructor(
    private readonly rows: readonly T[],
    /** Qué propiedades mira el filtro rápido. Vacío = todas las de primer nivel. */
    private readonly searchable: readonly string[] = [],
  ) {}

  load(query: TableQuery): Observable<TablePage<T>> {
    const matched = this.rows.filter(
      (row) => this.matchesSearch(row, query.search) && this.matchesFilters(row, query.filters),
    );
    const sorted = sortRows(matched, query);
    const from = query.page * query.pageSize;

    return of({
      rows: sorted.slice(from, from + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: sorted.length,
    });
  }

  private matchesSearch(row: T, search: string): boolean {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return true;
    }
    const keys = this.searchable.length > 0 ? this.searchable : Object.keys(row as object);
    return keys.some((key) =>
      String(readCell(row, key) ?? '')
        .toLowerCase()
        .includes(needle),
    );
  }

  private matchesFilters(row: T, filters: Readonly<Record<string, TableFilterValue>>): boolean {
    return Object.entries(filters).every(([key, filter]) =>
      matchesFilter(readCell(row, key), filter),
    );
  }
}

/** Una celda contra un filtro. Exportada para que el spec de la Tabla fije las
 * tres formas sin armar una fuente alrededor. */
export function matchesFilter(value: unknown, filter: TableFilterValue): boolean {
  if (typeof filter === 'string') {
    return (
      filter.trim() === '' ||
      String(value ?? '')
        .toLowerCase()
        .includes(filter.trim().toLowerCase())
    );
  }

  if (isNumberRange(filter)) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      // Una fila cuyo valor no es número no puede estar dentro de un rango
      // numérico: dejarla haría que «entre 100 y 900» incluyera en silencio las
      // filas sin valor.
      return false;
    }
    return (
      (filter.min === undefined || number >= filter.min) &&
      (filter.max === undefined || number <= filter.max)
    );
  }

  if (isDateRange(filter)) {
    /*
     * Las fechas se comparan como CADENAS ISO 8601, que es exacto y no perezoso: el
     * formato ordena lexicográficamente por construcción, y así se evita un parseo
     * que puede dar Invalid Date en silencio sobre un valor con otra forma.
     */
    const text = String(value ?? '');
    if (text === '') {
      return false;
    }
    return (
      (filter.from === undefined || text >= filter.from) &&
      (filter.to === undefined || text <= filter.to)
    );
  }

  // Un objeto vacío es todos los límites borrados, o sea ningún filtro.
  return true;
}

/**
 * Ordena por el valor crudo, estable y con los vacíos al final EN AMBAS
 * DIRECCIONES, que no es lo que hace una comparación ingenua: las filas sin valor
 * no son «más chicas», están ausentes. Subirlas al ordenar descendente haría que
 * la primera pantalla fuera una pantalla de blancos.
 */
export function sortRows<T>(rows: readonly T[], query: TableQuery): readonly T[] {
  const sort = query.sort;
  if (!sort) {
    return rows;
  }
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = readCell(a, sort.key);
    const right = readCell(b, sort.key);
    const missing = compareMissing(left, right);
    return missing !== null ? missing : factor * compareValues(left, right);
  });
}

/** `null` cuando los dos lados tienen valor; si no, la respuesta de vacío-al-final. */
function compareMissing(left: unknown, right: unknown): number | null {
  const leftEmpty = left === null || left === undefined || left === '';
  const rightEmpty = right === null || right === undefined || right === '';
  if (leftEmpty && rightEmpty) {
    return 0;
  }
  if (leftEmpty) {
    return 1;
  }
  if (rightEmpty) {
    return -1;
  }
  return null;
}

/** Números numéricamente, todo lo demás como texto. `localeCompare` y no `<`, para
 * que «Ñandú» caiga donde lo busca quien lee español y no después de la «Z». */
function compareValues(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}
