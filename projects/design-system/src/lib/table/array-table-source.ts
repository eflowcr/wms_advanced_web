import { Observable, of } from 'rxjs';
import {
  isDateRange,
  isNumberRange,
  isSetFilter,
  readCell,
  type TableFilterValue,
  type TablePage,
  type TableQuery,
  type TableSource,
} from './table-source';

/**
 * Fuente en memoria y referencia del contrato. Filtrar y ordenar usan el valor crudo, nunca
 * el texto formateado. Ver vault: Tabla §3.
 */
export class ArrayTableSource<T> implements TableSource<T> {
  constructor(
    private readonly rows: readonly T[],
    /** Qué mira el filtro rápido. Vacío = todas las de primer nivel. */
    private readonly searchable: readonly string[] = [],
  ) {}

  load(query: TableQuery): Observable<TablePage<T>> {
    const sorted = this.matching(query);
    const from = query.page * query.pageSize;

    return of({
      rows: sorted.slice(from, from + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: sorted.length,
    });
  }

  /** Lo filtrado y ordenado, sin paginar: lo que exporta la tabla. */
  matching(query: TableQuery): readonly T[] {
    const matched = this.rows.filter(
      (row) => this.matchesSearch(row, query.search) && this.matchesFilters(row, query.filters),
    );
    return sortRows(matched, query);
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

/** Exportada para que el spec fije las cuatro formas sin armar una fuente. */
export function matchesFilter(value: unknown, filter: TableFilterValue): boolean {
  if (isSetFilter(filter)) {
    // Vacío es «ninguno elegido» y no «todos»: la tabla borra el filtro antes de mandarlo vacío.
    return filter.includes(String(value ?? ''));
  }

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
      // Sin número no está en ningún rango: si no, «entre 100 y 900» incluiría las vacías.
      return false;
    }
    return (
      (filter.min === undefined || number >= filter.min) &&
      (filter.max === undefined || number <= filter.max)
    );
  }

  if (isDateRange(filter)) {
    // Como cadenas ISO 8601: ordenan lexicográficamente y no hay Invalid Date silencioso.
    const text = String(value ?? '');
    if (text === '') {
      return false;
    }
    return (
      (filter.from === undefined || text >= filter.from) &&
      (filter.to === undefined || text <= filter.to)
    );
  }

  // Objeto vacío: todos los límites borrados, ningún filtro.
  return true;
}

/** Estable, con los vacíos al final en ambas direcciones: descendente no abre con blancos. */
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

/** `localeCompare` y no `<`: «Ñandú» cae donde lo busca quien lee español. */
function compareValues(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}
