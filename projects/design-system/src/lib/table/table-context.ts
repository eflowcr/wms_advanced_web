import { InjectionToken, type Signal } from '@angular/core';
import type { FormControl } from '@angular/forms';
import type { TableColumn } from './column';
import type { TableFilters } from './table-filters';
import type { TableTreeState } from './table-tree-state';
import type { TableViewState } from './table-view';
import type { MenuItem, TableDensity } from './table.types';
import type { TableFormatters, TableMessages } from './table.tokens';

/**
 * Lo que las piezas internas de la Tabla (barra de herramientas, barra de estado) leen de ella.
 * Un token y no el tipo `Table`: la pieza importaría a la tabla que la importa. Interno.
 */
export interface TableContext {
  readonly tableId: string;
  readonly text: Signal<TableMessages>;
  readonly quickFilter: Signal<boolean>;
  readonly searchControl: FormControl<string>;
  readonly filtering: TableFilters;
  readonly anyFilterable: Signal<boolean>;
  readonly filtersOpen: Signal<boolean>;
  readonly filterRowId: string;
  readonly densityChoice: Signal<TableDensity>;
  readonly columnChooser: Signal<boolean>;
  readonly layout: TableViewState;
  readonly selectedCount: Signal<number>;
  readonly selectedRows: Signal<readonly unknown[]>;
  readonly pageRows: Signal<readonly unknown[]>;
  readonly pageTotal: Signal<number | null>;
  readonly visibleColumns: Signal<readonly TableColumn[]>;
  readonly format: Signal<TableFormatters>;
  readonly exportable: Signal<boolean>;
  runExport(kind: 'csv' | 'csv-selected' | 'copy'): void;
  readonly bulkActions: Signal<readonly MenuItem[]>;
  runBulk(item: MenuItem): void;
  clearSelection(): void;
  toggleFilters(): void;
  moveColumn(column: TableColumn, delta: 1 | -1): void;
  setDensity(density: TableDensity): void;
  readonly viewChanged: Signal<boolean>;
  /** Lo del árbol que ofrece Vista, sin el tipo de fila (la barra no lo conoce). */
  readonly tree: Pick<TableTreeState<unknown>, 'anyExpandable' | 'expandAll' | 'collapseAll'>;
  resetView(): void;
}

export const TABLE_CONTEXT = new InjectionToken<TableContext>('TABLE_CONTEXT');
