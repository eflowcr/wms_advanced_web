import { expandableKeys, flattenTree, type FlattenOptions } from './tree';

interface Node {
  readonly id: string;
  readonly hijos?: readonly Node[];
  /** A lazy parent: it has children, and they are not here. */
  readonly lazy?: boolean;
}

const TREE: readonly Node[] = [
  {
    id: 'a',
    hijos: [
      { id: 'a1', hijos: [{ id: 'a1x' }, { id: 'a1y' }] },
      { id: 'a2' },
    ],
  },
  { id: 'b' },
  { id: 'c', lazy: true },
];

function options(
  expanded: readonly string[] = [],
  extra: Partial<FlattenOptions<Node>> = {},
): FlattenOptions<Node> {
  return {
    children: (node) => (node.lazy ? undefined : (node.hijos ?? null)),
    hasChildren: (node) => Boolean(node.lazy) || (node.hijos?.length ?? 0) > 0,
    key: (node) => node.id,
    expanded: new Set(expanded),
    loading: new Set(),
    failed: new Set(),
    ...extra,
  };
}

/**
 * The tree, tested as a function.
 *
 * THIS IS THE PART OF THE TABLE THAT CAN HAVE A SPEC OF ITS OWN, and it is why
 * the flattening lives in a file with no Angular in it: every awkward case is a
 * call with an expected value instead of a fixture, a render and a query.
 */
describe('flattenTree', () => {
  it('shows only the roots when nothing is expanded', () => {
    const flat = flattenTree(TREE, options());
    expect(flat.map((row) => row.row.id)).toEqual(['a', 'b', 'c']);
  });

  it('A COLLAPSED ROW IS ABSENT, not hidden', () => {
    const flat = flattenTree(TREE, options());
    // Not "present with a flag": a row that is not here cannot be reached by
    // Tab, read by a screen reader, or counted into aria-rowcount -- and all
    // three would be wrong for something the person collapsed.
    expect(flat.some((row) => row.row.id === 'a1')).toBe(false);
  });

  it('walks depth-first, so a child follows its parent', () => {
    const flat = flattenTree(TREE, options(['a', 'a1']));
    expect(flat.map((row) => row.row.id)).toEqual(['a', 'a1', 'a1x', 'a1y', 'a2', 'b', 'c']);
  });

  it('gives every row its level, starting at zero', () => {
    const flat = flattenTree(TREE, options(['a', 'a1']));
    expect(flat.map((row) => row.level)).toEqual([0, 0 + 1, 2, 2, 1, 0, 0]);
  });

  it('counts the set and the position among SIBLINGS, not among the visible rows', () => {
    const flat = flattenTree(TREE, options(['a']));
    const a1 = flat.find((row) => row.row.id === 'a1');
    // Two children of `a`, not seven rows on screen: aria-setsize is about the
    // branch, which is what tells somebody "2 of 2" rather than "2 of 7".
    expect(a1?.setSize).toBe(2);
    expect(a1?.posInSet).toBe(1);
    expect(flat.find((row) => row.row.id === 'b')?.posInSet).toBe(2);
    expect(flat.find((row) => row.row.id === 'b')?.setSize).toBe(3);
  });

  it('marks a parent as expandable even when its children have not arrived', () => {
    const flat = flattenTree(TREE, options());
    const lazy = flat.find((row) => row.row.id === 'c');
    // `undefined` is "there are children, not here yet"; `null` is "leaf". If
    // the two collapsed, either every leaf would show a toggle or no lazy
    // parent could ever be opened.
    expect(lazy?.hasChildren).toBe(true);
    expect(flat.find((row) => row.row.id === 'b')?.hasChildren).toBe(false);
  });

  it('expanding a lazy parent with nothing loaded adds no rows', () => {
    const flat = flattenTree(TREE, options(['c']));
    expect(flat.map((row) => row.row.id)).toEqual(['a', 'b', 'c']);
    expect(flat.find((row) => row.row.id === 'c')?.expanded).toBe(true);
  });

  it('carries the loading and failed flags of the rows that have them', () => {
    const flat = flattenTree(
      TREE,
      options(['c'], { loading: new Set(['c']), failed: new Set(['b']) }),
    );
    expect(flat.find((row) => row.row.id === 'c')?.loading).toBe(true);
    expect(flat.find((row) => row.row.id === 'b')?.failed).toBe(true);
    expect(flat.find((row) => row.row.id === 'a')?.loading).toBe(false);
  });

  it('never marks a leaf as expanded, however the set is written', () => {
    const flat = flattenTree(TREE, options(['b']));
    expect(flat.find((row) => row.row.id === 'b')?.expanded).toBe(false);
  });

  it('handles an empty tree', () => {
    expect(flattenTree([], options())).toEqual([]);
  });

  it('treats a parent with an empty child array as a leaf', () => {
    const rows: readonly Node[] = [{ id: 'solo', hijos: [] }];
    const flat = flattenTree(rows, options());
    expect(flat[0]?.hasChildren).toBe(false);
  });
});

describe('expandableKeys', () => {
  it('walks the WHOLE tree, not just what is visible', () => {
    // The visible rows of a fully collapsed tree are its roots; expanding only
    // those would leave their children collapsed, so "expand all" has to know
    // about rows nobody can see yet.
    expect(expandableKeys(TREE, options())).toEqual(['a', 'a1', 'c']);
  });

  it('is empty for a flat list', () => {
    expect(expandableKeys([{ id: 'x' }, { id: 'y' }], options())).toEqual([]);
  });
});
