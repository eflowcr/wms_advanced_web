import { signal } from '@angular/core';
import type { TableColumn } from './column';
import { TableColumnMenu, type ColumnAction } from './table-column-menu';
import { TableSortState } from './table-sort';
import { TableViewState } from './table-view';
import type { TablePin } from './table.types';

/** Lo que el menú lee de una columna, sin montar ninguna: los dos estados son clases puras. */
function column(key: string, pinned: TablePin | null = null): TableColumn {
  return {
    key: () => key,
    header: () => key,
    sortable: () => true,
    hideable: () => true,
    pinned: () => pinned,
    type: () => 'text',
  } as unknown as TableColumn;
}

describe('TableColumnMenu', () => {
  const [a, b, c] = [column('a', 'start'), column('b'), column('c')];
  let layout: TableViewState;
  let sort: TableSortState;
  let menu: TableColumnMenu;
  const fitted: string[] = [];

  beforeEach(() => {
    fitted.length = 0;
    layout = new TableViewState(signal([a, b, c]), signal('md'), signal(false));
    sort = new TableSortState(() => undefined);
    menu = new TableColumnMenu({
      sort,
      layout,
      words: () => ({}) as Record<ColumnAction, string>,
      fit: (target) => fitted.push(target.key()),
      move: (target, delta) => layout.move(target, delta),
    });
  });

  const keys = (): string[] => layout.visibleColumns().map((target) => target.key());

  it('sorts from the menu: alone if it did not sort, in its place if it did', () => {
    sort.toggle(b, false);
    menu.run('sortDesc', c);
    expect(sort.list()).toEqual([{ key: 'c', direction: 'desc' }]);
    sort.toggle(b, true);
    menu.run('sortAsc', c);
    expect(sort.list().map((entry) => `${entry.key}:${entry.direction}`)).toEqual(['c:asc', 'b:asc']);
    menu.run('sortClear', c);
    expect(sort.list()).toEqual([{ key: 'b', direction: 'asc' }]);
    expect(sort.priority(b)).toBeNull();
  });

  it('pins to either edge and lets go; back to what was declared leaves no mark', () => {
    menu.run('pinEnd', b);
    expect(keys()).toEqual(['a', 'c', 'b']);
    menu.run('unpin', a);
    expect(layout.view().pinned).toEqual({ b: 'end' });
    menu.run('pinStart', a);
    menu.run('unpin', b);
    expect(layout.view().pinned).toEqual({ a: 'start' });
    expect(menu.items(a).find((item) => item.id === 'pinStart')?.disabled).toBe(true);
  });

  it('moves inside its group, fits, and hides', () => {
    menu.run('moveRight', b);
    expect(keys()).toEqual(['a', 'c', 'b']);
    menu.run('moveLeft', b);
    expect(keys()).toEqual(['a', 'b', 'c']);
    menu.run('fit', c);
    expect(fitted).toEqual(['c']);
    menu.run('hide', c);
    expect(keys()).toEqual(['a', 'b']);
  });
});
