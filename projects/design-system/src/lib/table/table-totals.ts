import { readCell } from './table-source';
import type { TableAggregate, TableTotalsScope } from './table.types';

/** Lo que el pie sabe de sus filas: cuáles, de dónde salen y si alcanzan para un total. */
export interface TotalsInput {
  readonly selected: readonly unknown[];
  /** Todo lo filtrado, si la fuente lo tiene en memoria (`matching`). */
  readonly matching: readonly unknown[] | undefined;
  readonly page: readonly unknown[];
  /** `null`: la fuente no cuenta. */
  readonly total: number | null;
  readonly filtered: boolean;
}

/** Sobre qué filas va el pie, cuántas son, y `null` si no hay filas que sumar sin mentir. */
export interface TotalsRows {
  readonly scope: TableTotalsScope;
  readonly count: number;
  readonly rows: readonly unknown[] | null;
}

/**
 * La selección si la hay; si no, todo lo filtrado cuando la fuente lo tiene, o la página de una
 * fuente remota. Una remota que no cuenta no da total: se muestra «—». Ver vault: Tabla §17.
 */
export function totalsRows(input: TotalsInput): TotalsRows {
  const whole: TableTotalsScope = input.filtered ? 'filtered' : 'all';
  if (input.selected.length > 0) {
    return { scope: 'selected', count: input.selected.length, rows: input.selected };
  }
  if (input.matching !== undefined) {
    return { scope: whole, count: input.matching.length, rows: input.matching };
  }
  if (input.total === null) {
    return { scope: 'page', count: input.page.length, rows: null };
  }
  const complete = input.total <= input.page.length;
  return { scope: complete ? whole : 'page', count: input.page.length, rows: input.page };
}

/** Sobre el valor crudo: `count` cuenta las filas con número; sin números, promedio y topes no hay. */
export function aggregateOf(
  kind: TableAggregate,
  rows: readonly unknown[],
  key: string,
): number | null {
  const numbers = rows
    .map((row) => readCell(row, key))
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(Number)
    .filter((value) => Number.isFinite(value));
  switch (kind) {
    case 'count':
      return numbers.length;
    case 'sum':
      return numbers.reduce((total, value) => total + value, 0);
    case 'avg':
      return numbers.length === 0
        ? null
        : numbers.reduce((total, value) => total + value, 0) / numbers.length;
    case 'min':
      return numbers.length === 0 ? null : Math.min(...numbers);
    case 'max':
      return numbers.length === 0 ? null : Math.max(...numbers);
  }
}
