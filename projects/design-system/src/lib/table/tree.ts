/**
 * Flattening the tree, and NOTHING ELSE.
 *
 * This file has no Angular in it, no signals and no DOM. That is what makes
 * the tree the one part of the table with a spec of its own: given a set of
 * roots, a way to find children and a set of expanded keys, it returns the
 * array the template loops over. Every awkward case -- a parent with no
 * children, a child expanded inside a collapsed parent, lazily loaded children
 * that have not arrived -- is a pure function call with an expected value.
 *
 * THE FLATTENING IS WHAT MAKES VIRTUALISATION POSSIBLE WITHOUT TRICKS. A
 * nested renderer cannot be virtualised: the CDK needs one flat list with a
 * known length, and that is exactly what comes out of here.
 */

/** A row, ready to be drawn. The template knows this and not the tree. */
export interface FlatRow<T> {
  readonly row: T;
  /** 0 for a root. Drives `aria-level` (which is 1-based, so level + 1). */
  readonly level: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  /** How many siblings this row has, including itself. `aria-setsize`. */
  readonly setSize: number;
  /** 1-based position among its siblings. `aria-posinset`. */
  readonly posInSet: number;
  /** Lazily loaded children are on their way. */
  readonly loading: boolean;
  /** Lazily loaded children failed; the row offers a retry. */
  readonly failed: boolean;
  /** What `trackBy` returned. Identifies the row for expansion and selection. */
  readonly key: unknown;
}

/** What `flattenTree` needs to know about the world. */
export interface FlattenOptions<T> {
  /**
   * The children already available for a row, or `null` when it has none.
   *
   * `undefined` means something different from `null` and the difference
   * matters: `undefined` is "this row has children but they are not here yet"
   * -- a lazy parent nobody has expanded, or one whose load is in flight.
   * `null` is "this row is a leaf". Collapsing the two would either hide the
   * toggle on every lazy parent or draw one on every leaf.
   */
  children: (row: T) => readonly T[] | null | undefined;
  /** True when a row is known to have children even if they are not loaded. */
  hasChildren: (row: T) => boolean;
  key: (row: T) => unknown;
  expanded: ReadonlySet<unknown>;
  loading: ReadonlySet<unknown>;
  failed: ReadonlySet<unknown>;
}

/**
 * Walk the tree depth-first and return the visible rows in order.
 *
 * A collapsed row's descendants are not in the result at all -- they are not
 * hidden with CSS. A row that is not in the DOM cannot be reached by Tab, read
 * by a screen reader, or counted into `aria-rowcount`, and all three would be
 * wrong for something the person has collapsed.
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
      loading: options.loading.has(key),
      failed: options.failed.has(key),
      key,
    });

    if (expanded && children && children.length > 0) {
      walk(children, level + 1, into, options);
    }
  });
}

/**
 * Every key in the tree, roots and descendants alike -- what "expand all"
 * needs, and what tells the table whether anything is expandable at all.
 *
 * It walks the WHOLE tree rather than the visible rows, which is the point:
 * the visible rows of a fully collapsed tree are the roots, and expanding
 * those would leave their children collapsed.
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
