import { signal } from '@angular/core';
import type { TableColumn } from './column';
import type { ColumnPosition, TableViewState } from './table-view';

interface DragHost {
  readonly layout: TableViewState;
  readonly columnOf: (key: string) => TableColumn | undefined;
  /** Para anunciar dónde cayó: «Cliente, posición 2 de 5». */
  readonly moved: (column: TableColumn, where: ColumnPosition) => void;
}

/** La línea de inserción: el color de acción, del lado donde cae la columna. */
const LINE = 'before:absolute before:inset-y-0 before:z-4 before:w-0.5 before:bg-primary';

/**
 * Reordenar columnas arrastrando la cabecera (arrastrar y soltar nativo). Solo dentro del
 * grupo de fijado: sobre otro grupo no se acepta la caída y no hay línea. Interna.
 */
export class TableColumnDrag {
  private readonly dragging = signal<string | null>(null);
  readonly target = signal<{ readonly key: string; readonly side: 'before' | 'after' } | null>(
    null,
  );

  /** En `dragstart` el blanco es la cabecera: dónde se apretó se anota antes. */
  private fromHandle = false;

  constructor(private readonly host: DragHost) {}

  press(event: PointerEvent): void {
    this.fromHandle = (event.target as HTMLElement | null)?.closest('[data-resize]') !== null;
  }

  start(event: DragEvent, column: TableColumn): void {
    // Desde un separador (el vecino invade cuatro píxeles) se redimensiona, no se arrastra.
    if (this.fromHandle) {
      event.preventDefault();
      return;
    }
    this.dragging.set(column.key());
    event.dataTransfer?.setData('text/plain', column.key());
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  over(event: DragEvent, column: TableColumn): void {
    const source = this.source();
    if (!source || source === column || source.pinned() !== column.pinned()) {
      this.target.set(null);
      return;
    }
    // Sin `preventDefault` el navegador no deja soltar: es lo que rechaza otro grupo.
    event.preventDefault();
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const side = event.clientX < box.left + box.width / 2 ? 'before' : 'after';
    const current = this.target();
    if (current?.key !== column.key() || current.side !== side) {
      this.target.set({ key: column.key(), side });
    }
  }

  drop(event: DragEvent, column: TableColumn): void {
    event.preventDefault();
    const source = this.source();
    const target = this.target();
    if (source && target?.key === column.key()) {
      const where = this.host.layout.place(source, column, target.side);
      if (where) {
        this.host.moved(source, where);
      }
    }
    this.end();
  }

  end(): void {
    this.dragging.set(null);
    this.target.set(null);
  }

  lineClasses(column: TableColumn): string {
    const target = this.target();
    if (target?.key !== column.key()) {
      return '';
    }
    return `${LINE} ${target.side === 'before' ? 'before:start-0' : 'before:end-0'}`;
  }

  private source(): TableColumn | undefined {
    const key = this.dragging();
    return key === null ? undefined : this.host.columnOf(key);
  }
}
