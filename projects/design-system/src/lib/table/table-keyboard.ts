import { signal } from '@angular/core';
import type { FlatRow } from './tree';

interface KeyboardHost<T> {
  readonly element: HTMLElement;
  readonly rows: () => readonly FlatRow<T>[];
  readonly columnCount: () => number;
  readonly selectable: () => boolean;
  readonly toggle: (flat: FlatRow<T>) => void;
  readonly activate: (flat: FlatRow<T>) => void;
  readonly select: (flat: FlatRow<T>, range: boolean) => void;
  readonly copy: (flat: FlatRow<T>) => void;
  readonly openMenu: (flat: FlatRow<T>, anchor: HTMLElement) => void;
  /** Con ventana, la fila destino puede no estar en el DOM: se desplaza antes de enfocar. */
  readonly reveal: (rowIndex: number) => void;
}

/**
 * El teclado de la grilla: una sola parada de Tab (`tabindex` rotatorio) y el patrón treegrid
 * de las APG. Interna; salió de `table.ts` sin cambiar nada. Ver vault: Tabla §6.
 */
export class TableKeyboard<T> {
  readonly focusRow = signal(0);
  readonly focusColumn = signal(0);

  constructor(private readonly host: KeyboardHost<T>) {}

  isFocused(rowIndex: number, columnIndex: number): boolean {
    return this.focusRow() === rowIndex && this.focusColumn() === columnIndex;
  }

  onCellFocus(rowIndex: number, columnIndex: number): void {
    this.focusRow.set(rowIndex);
    this.focusColumn.set(columnIndex);
  }

  // Teclado treegrid de las WAI-ARIA APG: en una fila padre las flechas expanden y
  // pliegan antes de moverse entre celdas. Ver vault: Tabla §6.
  onKeydown(event: KeyboardEvent, rowIndex: number): void {
    // La lista aplanada entera, nunca la ventana.
    const rows = this.host.rows();
    const flat = rows[rowIndex];
    if (!flat) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(Math.min(rows.length - 1, rowIndex + 1), this.focusColumn());
        return;

      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(Math.max(0, rowIndex - 1), this.focusColumn());
        return;

      case 'ArrowRight':
        event.preventDefault();
        if (flat.hasChildren && !flat.expanded) {
          this.host.toggle(flat);
          return;
        }
        this.moveFocus(rowIndex, Math.min(this.host.columnCount() - 1, this.focusColumn() + 1));
        return;

      case 'ArrowLeft':
        event.preventDefault();
        if (flat.hasChildren && flat.expanded) {
          this.host.toggle(flat);
          return;
        }
        if (this.focusColumn() === 0 && flat.level > 0) {
          // Primera celda de una hija: va al padre.
          this.moveFocus(parentIndexOf(rows, rowIndex), 0);
          return;
        }
        this.moveFocus(rowIndex, Math.max(0, this.focusColumn() - 1));
        return;

      case 'Home':
        event.preventDefault();
        this.moveFocus(event.ctrlKey ? 0 : rowIndex, 0);
        return;

      case 'End':
        event.preventDefault();
        this.moveFocus(event.ctrlKey ? rows.length - 1 : rowIndex, this.host.columnCount() - 1);
        return;

      case 'Enter':
        event.preventDefault();
        this.host.activate(flat);
        return;

      case ' ':
        if (this.host.selectable()) {
          // Espacio hace scroll por defecto.
          event.preventDefault();
          this.host.select(flat, event.shiftKey);
        }
        return;

      case 'c':
      case 'C':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.host.copy(flat);
        }
        return;

      case 'ContextMenu':
      case 'F10':
        // Shift+F10 y la tecla de menú abren el menú; F10 a secas es del navegador.
        if (event.key === 'F10' && !event.shiftKey) {
          return;
        }
        event.preventDefault();
        this.host.openMenu(flat, event.currentTarget as HTMLElement);
        return;

      default:
        return;
    }
  }

  // Con ventana, la fila destino puede no estar en el DOM: scroll primero, foco después.
  moveFocus(rowIndex: number, columnIndex: number): void {
    this.focusRow.set(rowIndex);
    this.focusColumn.set(columnIndex);

    this.host.reveal(rowIndex);
    queueMicrotask(() =>
      this.host.element.querySelector<HTMLElement>(`[data-cell="${rowIndex}-${columnIndex}"]`)?.focus(),
    );
  }
}

function parentIndexOf<T>(rows: readonly FlatRow<T>[], from: number): number {
  const level = rows[from]?.level ?? 0;
  for (let index = from - 1; index >= 0; index -= 1) {
    if ((rows[index]?.level ?? 0) < level) {
      return index;
    }
  }
  return from;
}
