/**
 * Aplanar el árbol y NADA MÁS: sin Angular, sin señales y sin DOM. Por eso es la
 * única parte de la tabla con spec propio -cada caso raro es una llamada a una
 * función pura con un valor esperado-, y por eso la virtualización sale sin
 * trucos: el CDK necesita una lista plana con largo conocido y acá está.
 */

/** Una fila lista para dibujar. La plantilla conoce esto, no el árbol. */
export interface FlatRow<T> {
  readonly row: T;
  /** 0 en una raíz. Alimenta `aria-level`, que es base 1 (level + 1). */
  readonly level: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  /** Cuántos hermanos tiene esta fila, ella incluida. `aria-setsize`. */
  readonly setSize: number;
  /** Posición base 1 entre sus hermanos. `aria-posinset`. */
  readonly posInSet: number;
  /** Los hijos perezosos vienen en camino. */
  readonly loading: boolean;
  /** Los hijos perezosos fallaron; la fila ofrece reintentar. */
  readonly failed: boolean;
  /** Lo que devolvió `trackBy`. Identifica la fila para expandir y seleccionar. */
  readonly key: unknown;
}

/** Lo que `flattenTree` necesita saber del mundo. */
export interface FlattenOptions<T> {
  /**
   * Los hijos ya disponibles, o `null` si no tiene. `undefined` es distinto de
   * `null`: `undefined` es «tiene hijos y no llegaron», `null` es «es una hoja».
   * Juntarlos escondería el toggle en todo padre perezoso o lo dibujaría en toda
   * hoja.
   */
  children: (row: T) => readonly T[] | null | undefined;
  /** Cierto cuando se sabe que una fila tiene hijos aunque no estén cargados. */
  hasChildren: (row: T) => boolean;
  key: (row: T) => unknown;
  expanded: ReadonlySet<unknown>;
  loading: ReadonlySet<unknown>;
  failed: ReadonlySet<unknown>;
}

/**
 * Camina el árbol en profundidad y devuelve las filas visibles en orden. Los
 * descendientes de una fila plegada no están en el resultado: no se esconden con
 * CSS. Una fila fuera del DOM no la alcanza el Tab, no la lee un lector y no
 * cuenta para `aria-rowcount`, y las tres cosas serían erróneas.
 */
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
      /*
       * LAS DOS DEPENDEN DE `expanded`, y no es redundancia: los conjuntos viven
       * más que el gesto -una carga en vuelo guarda su clave, un fallo la guarda
       * hasta que alguien reintente-, así que leídos solos ponen un spinner o una
       * fila roja bajo un padre dibujado plegado.
       */
      loading: expanded && options.loading.has(key),
      failed: expanded && options.failed.has(key),
      key,
    });

    if (expanded && children && children.length > 0) {
      walk(children, level + 1, into, options);
    }
  });
}

/**
 * Todas las claves del árbol, raíces y descendientes: lo que necesita «expandir
 * todo». Camina el árbol ENTERO y no las filas visibles, que es el punto: las
 * visibles de un árbol plegado son las raíces, y expandirlas dejaría a sus hijos
 * plegados.
 */
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
