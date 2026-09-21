// Aplanar el árbol y nada más: función pura, sin Angular ni DOM. Ver vault: Tabla §4.

export interface FlatRow<T> {
  readonly row: T;
  /** Base 0; `aria-level` es level + 1. */
  readonly level: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  /** Hermanos, ella incluida (`aria-setsize`). */
  readonly setSize: number;
  /** Base 1 (`aria-posinset`). */
  readonly posInSet: number;
  readonly loading: boolean;
  readonly failed: boolean;
  /** Lo que devolvió `trackBy`. */
  readonly key: unknown;
}

export interface FlattenOptions<T> {
  /** `undefined` = tiene hijos y no llegaron; `null` = hoja. Juntarlos rompe el toggle. */
  children: (row: T) => readonly T[] | null | undefined;
  /** Sabe que hay hijos aunque no estén cargados. */
  hasChildren: (row: T) => boolean;
  key: (row: T) => unknown;
  expanded: ReadonlySet<unknown>;
  loading: ReadonlySet<unknown>;
  failed: ReadonlySet<unknown>;
}

/** Los descendientes de una fila plegada no están: fuera del DOM, no escondidos con CSS. */
export function flattenTree<T>(
  roots: readonly T[],
  options: FlattenOptions<T>,
): readonly FlatRow<T>[] {
  const flat: FlatRow<T>[] = [];
  walk(roots, 0, flat, options);
  return flat;
}

function walk<T>(
  rows: readonly T[],
  level: number,
  into: FlatRow<T>[],
  options: FlattenOptions<T>,
): void {
  const setSize = rows.length;
  rows.forEach((row, index) => {
    const key = options.key(row);
    const children = options.children(row);
    const hasChildren = options.hasChildren(row) || (children?.length ?? 0) > 0;
    const expanded = hasChildren && options.expanded.has(key);

    into.push({
      row,
      level,
      hasChildren,
      expanded,
      setSize,
      posInSet: index + 1,
      // Dependen de `expanded`: los conjuntos sobreviven al gesto y pintarían
      // bajo un padre plegado.
      loading: expanded && options.loading.has(key),
      failed: expanded && options.failed.has(key),
      key,
    });

    if (expanded && children && children.length > 0) {
      walk(children, level + 1, into, options);
    }
  });
}

/** Todas las claves del árbol entero, no las visibles: lo que necesita «expandir todo». */
export function expandableKeys<T>(
  roots: readonly T[],
  options: Pick<FlattenOptions<T>, 'children' | 'hasChildren' | 'key'>,
): readonly unknown[] {
  const keys: unknown[] = [];
  const visit = (rows: readonly T[]): void => {
    for (const row of rows) {
      const children = options.children(row);
      if (options.hasChildren(row) || (children?.length ?? 0) > 0) {
        keys.push(options.key(row));
      }
      if (children) {
        visit(children);
      }
    }
  };
  visit(roots);
  return keys;
}
