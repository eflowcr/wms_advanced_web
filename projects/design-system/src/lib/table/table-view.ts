import { computed, signal, type Signal } from '@angular/core';
import { readPixels } from '../tokens/read-token';
import type { TableColumn } from './column';
import type { TableDensity, TablePin, TableView } from './table.types';

/** El paso del teclado al redimensionar y el mínimo de una columna, por token. */
const RESIZE_STEP_TOKEN = '--col-resize-step';
const MIN_WIDTH_TOKEN = '--col-filter-min-width';

/**
 * Lo que el usuario configura de las columnas —ocultas, anchos— y el orden que imponen las
 * fijadas. Vive en memoria y sale por `(viewChange)`; nunca va al navegador. Interna.
 */
export class TableViewState {
  private readonly hidden = signal<ReadonlySet<string>>(new Set());
  private readonly widths = signal<Readonly<Record<string, number>>>({});

  /** Las visibles, con las fijadas al inicio y al final: el `sticky` solo pega en los bordes. */
  readonly visibleColumns = computed(() => {
    const visible = this.columns().filter((column) => !this.hidden().has(column.key()));
    const at = (pin: TablePin | null) => visible.filter((column) => column.pinned() === pin);
    return [...at('start'), ...at(null), ...at('end')];
  });

  /** Lo que ofrece el selector de columnas: las que se pueden ocultar. */
  readonly hideable = computed(() => this.columns().filter((column) => column.hideable()));

  constructor(
    private readonly columns: Signal<readonly TableColumn[]>,
    private readonly density: Signal<TableDensity>,
  ) {}

  isVisible(column: TableColumn): boolean {
    return !this.hidden().has(column.key());
  }

  /** La última visible no se oculta: una tabla sin columnas no se puede volver a configurar. */
  canHide(column: TableColumn): boolean {
    return !this.isVisible(column) || this.visibleColumns().length > 1;
  }

  toggle(column: TableColumn): void {
    if (!column.hideable() || !this.canHide(column)) {
      return;
    }
    const next = new Set(this.hidden());
    if (next.has(column.key())) {
      next.delete(column.key());
    } else {
      next.add(column.key());
    }
    this.hidden.set(next);
  }

  /** Píxeles CSS elegidos por el usuario, o null: entonces manda el token de `width`. */
  width(column: TableColumn): number | null {
    return this.widths()[column.key()] ?? null;
  }

  /** Sin token de mínimo no se achica nada: un número inventado sería una copia. */
  resize(column: TableColumn, pixels: number): void {
    const min = readPixels(MIN_WIDTH_TOKEN) ?? pixels;
    this.widths.update((current) => ({ ...current, [column.key()]: Math.round(Math.max(min, pixels)) }));
  }

  /** Flechas del separador: un paso por token; sin token, ninguno. */
  step(column: TableColumn, current: number, direction: 1 | -1): void {
    const step = readPixels(RESIZE_STEP_TOKEN);
    if (step !== null) {
      this.resize(column, current + direction * step);
    }
  }

  /** Doble clic: vuelve al ancho del token. */
  reset(column: TableColumn): void {
    this.widths.update((current) => {
      const next = { ...current };
      delete next[column.key()];
      return next;
    });
  }

  readonly view = computed<TableView>(() => ({
    hidden: [...this.hidden()],
    widths: this.widths(),
    pinned: Object.fromEntries(
      this.columns()
        .filter((column) => column.pinned() !== null)
        .map((column) => [column.key(), column.pinned() as TablePin]),
    ),
    density: this.density(),
  }));
}
