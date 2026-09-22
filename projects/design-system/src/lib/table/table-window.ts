import { computed, signal, type Signal } from '@angular/core';
import { readPixels } from '../tokens/read-token';
import type { TableDensity } from './table.types';
import type { FlatRow } from './tree';

/** Filas de más a cada lado de lo visible: el scroll rápido no deja huecos en blanco. */
const OVERSCAN = 6;

/**
 * La ventana de `[virtual]`: solo las filas que se ven, con espaciadores que sostienen la barra
 * de desplazamiento. No es `cdk-virtual-scroll-viewport`: su transform rompe la cabecera
 * pegajosa. Interna; salió de `table.ts` sin cambiar nada. Ver vault: Tabla §10.
 */
export class TableWindow<T> {
  private readonly scrollTop = signal(0);
  private readonly viewportHeight = signal(0);

  // Sin token de altura no hay virtualización, en vez de un número inventado.
  private readonly rowPixels = computed(() =>
    readPixels(this.density() === 'sm' ? '--row-height-sm' : '--row-height-md'),
  );

  readonly on = computed(() => this.virtual() && this.rowPixels() !== null);

  readonly rows = computed(() => {
    const all = this.all();
    const px = this.rowPixels();
    if (!this.on() || px === null) {
      return { first: 0, rows: all, before: 0, after: 0 };
    }
    const visible = Math.ceil(this.viewportHeight() / px) + OVERSCAN * 2;
    const first = Math.max(0, Math.floor(this.scrollTop() / px) - OVERSCAN);
    const last = Math.min(all.length, first + visible);
    return {
      first,
      rows: all.slice(first, last),
      before: first * px,
      after: (all.length - last) * px,
    };
  });

  constructor(
    private readonly all: Signal<readonly FlatRow<T>[]>,
    private readonly virtual: Signal<boolean>,
    private readonly density: Signal<TableDensity>,
  ) {}

  measure(box: HTMLElement): void {
    this.scrollTop.set(box.scrollTop);
    this.viewportHeight.set(box.clientHeight);
  }

  /** La fila destino puede no estar en el DOM: scroll primero, foco después. */
  reveal(box: HTMLElement | null, rowIndex: number): void {
    const px = this.rowPixels();
    if (!this.on() || px === null || !box) {
      return;
    }
    const top = rowIndex * px;
    const bottom = top + px;
    if (top < box.scrollTop) {
      box.scrollTop = top;
    } else if (bottom > box.scrollTop + box.clientHeight) {
      box.scrollTop = bottom - box.clientHeight;
    }
    this.measure(box);
  }
}
