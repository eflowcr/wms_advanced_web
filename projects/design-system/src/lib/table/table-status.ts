import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TABLE_CONTEXT } from './table-context';

/**
 * Al pie de la tabla: cuántas filas y cuántas seleccionadas. Los agregados van en la fila de
 * totales, alineados con su columna. Interna. Ver vault: Tabla §17.
 */
@Component({
  selector: 'ewms-table-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-default bg-secondary px-3 py-2 text-caption text-secondary',
    'data-table-status': '',
  },
  template: `
    @let text = table.text();
    <!-- &ngsp; entre piezas: el flex no lo pinta, y sin él el lector junta «filas2 seleccionadas». -->
    <span data-status-rows>{{ text.rowsShown(table.pageRows().length, table.pageTotal()) }}</span
    >&ngsp;
    @if (table.selectedCount() > 0) {
      <span data-status-selected>{{ text.selectedCount(table.selectedCount()) }}</span>
    }
  `,
})
export class TableStatus {
  protected readonly table = inject(TABLE_CONTEXT);
}
