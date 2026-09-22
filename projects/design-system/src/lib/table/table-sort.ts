import { signal } from '@angular/core';
import type { TableColumn } from './column';
import type { TableSort } from './table-source';

type Direction = TableSort['direction'];

/**
 * El orden de la Tabla: una lista, la primera manda. Clic ordena por esa columna sola; con Shift
 * la suma a la lista (o cicla la suya). Interna. Ver vault: Tabla §21.
 */
export class TableSortState {
  readonly list = signal<readonly TableSort[]>([]);

  /** Cualquier cambio de orden vuelve a la página 0. */
  constructor(private readonly changed: () => void) {}

  direction(column: TableColumn): Direction | null {
    return this.list().find((sort) => sort.key === column.key())?.direction ?? null;
  }

  /** Base 1, y solo con dos o más: con una sola, un «1» es ruido. */
  priority(column: TableColumn): number | null {
    const list = this.list();
    const index = list.findIndex((sort) => sort.key === column.key());
    return list.length > 1 && index >= 0 ? index + 1 : null;
  }

  /** `aria-sort` solo en la que manda: las APG piden uno por tabla, y `none` en las demás es ruido. */
  ariaSort(column: TableColumn): 'ascending' | 'descending' | null {
    const first = this.list()[0];
    if (first?.key !== column.key()) {
      return null;
    }
    return first.direction === 'asc' ? 'ascending' : 'descending';
  }

  /** Asc, desc y ninguno: el tercer clic devuelve el orden de la fuente. */
  toggle(column: TableColumn, additive: boolean): void {
    if (!column.sortable()) {
      return;
    }
    const current = this.direction(column);
    const next: Direction | null = current === null ? 'asc' : current === 'asc' ? 'desc' : null;
    if (additive) {
      this.set(column, next);
      return;
    }
    this.list.set(next === null ? [] : [{ key: column.key(), direction: next }]);
    this.changed();
  }

  /** Desde el menú de columna: en su lugar si ya ordenaba; si no, sola. */
  choose(column: TableColumn, direction: Direction | null): void {
    if (this.direction(column) === null && direction !== null) {
      this.list.set([{ key: column.key(), direction }]);
      this.changed();
      return;
    }
    this.set(column, direction);
  }

  /** En su lugar de la lista, al final si no estaba, o fuera con `null`. */
  private set(column: TableColumn, direction: Direction | null): void {
    const list = this.list();
    const index = list.findIndex((sort) => sort.key === column.key());
    const entry = direction === null ? [] : [{ key: column.key(), direction }];
    this.list.set(
      index < 0
        ? [...list, ...entry]
        : [...list.slice(0, index), ...entry, ...list.slice(index + 1)],
    );
    this.changed();
  }
}
