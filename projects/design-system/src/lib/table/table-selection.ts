import { computed, signal } from '@angular/core';
import type { FlatRow } from './tree';

/**
 * La selección de la Tabla: filas por clave de `trackBy`, así sobrevive al cambio de página y
 * una acción masiva recibe filas que ya no están en pantalla. Con ancla para el rango. Interna.
 */
export class TableSelection<T> {
  private readonly chosen = signal<ReadonlyMap<unknown, T>>(new Map());

  /** La última marcada o desmarcada a mano: desde acá va un Shift+clic. */
  private anchor: unknown = undefined;

  readonly count = computed(() => this.chosen().size);

  readonly rows = computed<readonly T[]>(() => [...this.chosen().values()]);

  has(key: unknown): boolean {
    return this.chosen().has(key);
  }

  toggle(flat: FlatRow<T>): void {
    const next = new Map(this.chosen());
    if (next.has(flat.key)) {
      next.delete(flat.key);
    } else {
      next.set(flat.key, flat.row);
    }
    this.anchor = flat.key;
    this.chosen.set(next);
  }

  /**
   * Del ancla a esta fila, en el orden de pantalla, todas marcadas. Sin ancla en pantalla es un
   * clic común: un rango desde una fila que ya no se ve no se puede adivinar.
   */
  range(flat: FlatRow<T>, rows: readonly FlatRow<T>[]): void {
    const from = rows.findIndex((candidate) => candidate.key === this.anchor);
    const to = rows.findIndex((candidate) => candidate.key === flat.key);
    if (from < 0 || to < 0) {
      this.toggle(flat);
      return;
    }
    const next = new Map(this.chosen());
    for (const candidate of rows.slice(Math.min(from, to), Math.max(from, to) + 1)) {
      next.set(candidate.key, candidate.row);
    }
    this.chosen.set(next);
  }

  /** Solo lo que está en pantalla: si no, alguien borra 400 registros queriendo borrar 20. */
  toggleAll(rows: readonly FlatRow<T>[]): void {
    const next = new Map(this.chosen());
    const everyone = rows.length > 0 && rows.every((flat) => next.has(flat.key));
    for (const flat of rows) {
      if (everyone) {
        next.delete(flat.key);
      } else {
        next.set(flat.key, flat.row);
      }
    }
    this.chosen.set(next);
  }

  clear(): void {
    this.anchor = undefined;
    this.chosen.set(new Map());
  }
}
