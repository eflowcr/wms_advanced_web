import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TABLE_CONTEXT } from './table-context';
import { readCell } from './table-source';

/** Un agregado declarado, ya calculado y con su etiqueta. */
interface AggregateLine {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

/**
 * Al pie de la tabla: cuántas filas, cuántas seleccionadas y los agregados de las columnas
 * numéricas. Sobre la selección si la hay; si no, sobre lo que está en pantalla. Interna.
 * Ver vault: Tabla §17.
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
    <span data-status-rows>{{ text.rowsShown(table.pageRows().length, table.pageTotal()) }}</span>&ngsp;
    @if (table.selectedCount() > 0) {
      <span data-status-selected>{{ text.selectedCount(table.selectedCount()) }}</span>&ngsp;
    }
    @for (line of aggregates(); track line.key) {
      <span [attr.data-aggregate]="line.key">
        {{ line.label }}:&ngsp;<span class="font-mono text-primary">{{ line.value }}</span>
      </span>&ngsp;
    }
  `,
})
export class TableStatus {
  protected readonly table = inject(TABLE_CONTEXT);

  protected readonly aggregates = computed<readonly AggregateLine[]>(() => {
    const selected = this.table.selectedCount() > 0;
    // En pantalla son las raíces de la página: sumar también las hijas contaría dos veces.
    const rows = selected ? this.table.selectedRows() : this.table.pageRows();
    const text = this.table.text();
    const format = this.table.format();
    return this.table
      .visibleColumns()
      .filter((column) => column.type() === 'number' && column.aggregate() !== null)
      .map((column) => {
        const kind = column.aggregate()!;
        const numbers = rows
          .map((row) => Number(readCell(row, column.key())))
          .filter((value) => Number.isFinite(value));
        const sum = numbers.reduce((total, value) => total + value, 0);
        const value =
          kind === 'count' ? numbers.length : kind === 'avg' && numbers.length > 0 ? sum / numbers.length : sum;
        return {
          key: column.key(),
          label: text.aggregate(kind, column.header() || column.key(), selected ? 'selected' : 'shown'),
          value: format.number(value),
        };
      });
  });
}
