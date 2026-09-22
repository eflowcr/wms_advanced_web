import type { TableColumn } from './column';
import type { TableSortState } from './table-sort';
import type { TableViewState } from './table-view';
import type { MenuItem } from './table.types';

/** Lo que ofrece el menú de una columna, por nombre: los textos llegan en `columnActions`. */
export type ColumnAction =
  | 'sortAsc'
  | 'sortDesc'
  | 'sortClear'
  | 'pinStart'
  | 'pinEnd'
  | 'unpin'
  | 'fit'
  | 'moveLeft'
  | 'moveRight'
  | 'hide';

interface ColumnMenuHost {
  readonly sort: TableSortState;
  readonly layout: TableViewState;
  readonly words: () => Readonly<Record<ColumnAction, string>>;
  readonly fit: (column: TableColumn) => void;
  readonly move: (column: TableColumn, delta: 1 | -1) => void;
}

/**
 * Las entradas del menú de columna (⋮, clic derecho, Shift+F10) y qué hace cada una. Lo que ya
 * está hecho o no se puede va deshabilitado, no escondido: el menú no cambia de forma. Interna.
 */
export class TableColumnMenu {
  constructor(private readonly host: ColumnMenuHost) {}

  items(column: TableColumn): readonly MenuItem[] {
    const { sort, layout } = this.host;
    const words = this.host.words();
    const direction = sort.direction(column);
    const pin = layout.pinnedOf(column);
    const entry = (id: ColumnAction, disabled: boolean, extra: Partial<MenuItem> = {}): MenuItem => ({
      id,
      label: words[id],
      disabled,
      ...extra,
    });
    const sorting = column.sortable()
      ? [
          entry('sortAsc', direction === 'asc', { icon: 'chevron-up' }),
          entry('sortDesc', direction === 'desc', { icon: 'chevron-down' }),
          entry('sortClear', direction === null, { icon: 'x' }),
        ]
      : [];
    const fitting = column.type() === 'actions' ? [] : [entry('fit', false)];
    return [
      ...sorting,
      entry('pinStart', pin === 'start', { separatorBefore: sorting.length > 0 }),
      entry('pinEnd', pin === 'end'),
      entry('unpin', pin === null),
      ...fitting,
      entry('moveLeft', !layout.canMove(column, -1), { icon: 'arrow-left', separatorBefore: true }),
      entry('moveRight', !layout.canMove(column, 1), { icon: 'arrow-right' }),
      entry('hide', !column.hideable() || !layout.canHide(column), {
        icon: 'eye-off',
        separatorBefore: true,
      }),
    ];
  }

  run(action: ColumnAction, column: TableColumn): void {
    const { sort, layout } = this.host;
    switch (action) {
      case 'sortAsc':
        return sort.choose(column, 'asc');
      case 'sortDesc':
        return sort.choose(column, 'desc');
      case 'sortClear':
        return sort.choose(column, null);
      case 'pinStart':
        return layout.pin(column, 'start');
      case 'pinEnd':
        return layout.pin(column, 'end');
      case 'unpin':
        return layout.pin(column, null);
      case 'fit':
        return this.host.fit(column);
      case 'moveLeft':
        return this.host.move(column, -1);
      case 'moveRight':
        return this.host.move(column, 1);
      case 'hide':
        return layout.toggle(column);
    }
  }
}
