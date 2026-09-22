import { computed, signal, type Signal } from '@angular/core';
import { isObservable } from 'rxjs';
import { readCell } from './table-source';
import type { TableChildren } from './table.types';
import { flattenTree, type FlatRow } from './tree';

/**
 * El árbol de la Tabla: qué filas están abiertas, los hijos perezosos (en vuelo, fallidos,
 * llegados) y la lista aplanada que dibuja la plantilla. Interna. Ver vault: Tabla §4.
 */
export class TableTreeState<T> {
  private readonly expanded = signal<ReadonlySet<unknown>>(new Set());
  private readonly loading = signal<ReadonlySet<unknown>>(new Set());
  private readonly failed = signal<ReadonlySet<unknown>>(new Set());
  private readonly lazy = signal<ReadonlyMap<unknown, readonly T[]>>(new Map());

  private readonly resolve = computed<TableChildren<T> | null>(() => {
    const declared = this.children();
    if (declared === null) {
      return null;
    }
    if (typeof declared === 'string') {
      return (row) => (readCell(row, declared) as readonly T[] | undefined) ?? null;
    }
    return declared;
  });

  readonly isTree = computed(() => this.resolve() !== null);

  constructor(
    private readonly children: Signal<TableChildren<T> | string | null>,
    private readonly key: Signal<(row: T) => unknown>,
    private readonly roots: Signal<readonly T[]>,
  ) {}

  // `undefined` = hay hijos y no llegaron; `null` = hoja. La diferencia dibuja el toggle.
  private readonly childrenOf = (row: T): readonly T[] | null | undefined => {
    const resolved = this.resolve()?.(row) ?? null;
    if (resolved === null) {
      return null;
    }
    return isObservable(resolved) ? this.lazy().get(this.key()(row)) : resolved;
  };

  // Un padre perezoso siempre tiene toggle: si no, nadie podría pedir sus hijos.
  private readonly hasChildrenOf = (row: T): boolean => {
    const resolved = this.resolve()?.(row) ?? null;
    return resolved !== null && (isObservable(resolved) || resolved.length > 0);
  };

  readonly rows = computed<readonly FlatRow<T>[]>(() =>
    flattenTree(this.roots(), {
      children: this.childrenOf,
      hasChildren: this.hasChildrenOf,
      key: this.key(),
      expanded: this.expanded(),
      loading: this.loading(),
      failed: this.failed(),
    }),
  );

  toggle(flat: FlatRow<T>): void {
    if (!flat.hasChildren) {
      return;
    }
    const open = new Set(this.expanded());
    if (open.delete(flat.key)) {
      this.expanded.set(open);
      return;
    }
    open.add(flat.key);
    this.expanded.set(open);
    this.loadLazy(flat);
  }

  retry(flat: FlatRow<T>): void {
    this.lazy.update((current) => {
      const next = new Map(current);
      next.delete(flat.key);
      return next;
    });
    this.loadLazy(flat);
  }

  // Una sola vez por fila: pedirlos en cada expansión le pega a la red sin necesidad.
  private loadLazy(flat: FlatRow<T>): void {
    const resolved = this.resolve()?.(flat.row);
    if (!resolved || !isObservable(resolved) || this.lazy().has(flat.key)) {
      return;
    }
    this.failed.update((current) => without(current, flat.key));
    this.loading.update((current) => new Set(current).add(flat.key));
    resolved.subscribe({
      next: (children) => {
        this.lazy.update((current) => new Map(current).set(flat.key, children));
        this.loading.update((current) => without(current, flat.key));
      },
      error: () => {
        this.loading.update((current) => without(current, flat.key));
        this.failed.update((current) => new Set(current).add(flat.key));
      },
    });
  }
}

function without(set: ReadonlySet<unknown>, key: unknown): ReadonlySet<unknown> {
  const next = new Set(set);
  next.delete(key);
  return next;
}
