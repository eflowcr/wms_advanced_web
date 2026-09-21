import { expandableKeys, flattenTree, type FlattenOptions } from './tree';

interface Node {
  readonly id: string;
  readonly hijos?: readonly Node[];
  /** Padre perezoso: tiene hijos y no están acá. */
  readonly lazy?: boolean;
}

const TREE: readonly Node[] = [
  {
    id: 'a',
    hijos: [{ id: 'a1', hijos: [{ id: 'a1x' }, { id: 'a1y' }] }, { id: 'a2' }],
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

// El árbol como función pura: cada caso raro es una llamada con valor esperado.
describe('flattenTree', () => {
  it('shows only the roots when nothing is expanded', () => {
    const flat = flattenTree(TREE, options());
    expect(flat.map((row) => row.row.id)).toEqual(['a', 'b', 'c']);
  });

  it('A COLLAPSED ROW IS ABSENT, not hidden', () => {
    const flat = flattenTree(TREE, options());
    // Ausente y no marcada: fuera del DOM no la alcanza el Tab ni cuenta en aria-rowcount.
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
    // aria-setsize es de la rama: «2 de 2», no «2 de 7».
    expect(a1?.setSize).toBe(2);
    expect(a1?.posInSet).toBe(1);
    expect(flat.find((row) => row.row.id === 'b')?.posInSet).toBe(2);
    expect(flat.find((row) => row.row.id === 'b')?.setSize).toBe(3);
  });

  it('marks a parent as expandable even when its children have not arrived', () => {
    const flat = flattenTree(TREE, options());
    const lazy = flat.find((row) => row.row.id === 'c');
    // `undefined` = hay hijos, no llegaron; `null` = hoja. Juntarlos rompe el toggle.
    expect(lazy?.hasChildren).toBe(true);
    expect(flat.find((row) => row.row.id === 'b')?.hasChildren).toBe(false);
  });

  it('expanding a lazy parent with nothing loaded adds no rows', () => {
    const flat = flattenTree(TREE, options(['c']));
    expect(flat.map((row) => row.row.id)).toEqual(['a', 'b', 'c']);
    expect(flat.find((row) => row.row.id === 'c')?.expanded).toBe(true);
  });

  it('carries the loading and failed flags of the EXPANDED rows that have them', () => {
    const flat = flattenTree(
      TREE,
      options(['a', 'c'], { loading: new Set(['c']), failed: new Set(['a']) }),
    );
    expect(flat.find((row) => row.row.id === 'c')?.loading).toBe(true);
    expect(flat.find((row) => row.row.id === 'a')?.failed).toBe(true);
    expect(flat.find((row) => row.row.id === 'b')?.loading).toBe(false);
  });

  it('WITHHOLDS THEM FROM A ROW THAT IS FOLDED UP', () => {
    // Los conjuntos sobreviven al gesto: leídos solos pintan spinner o error bajo un padre
    // plegado (lo atrapó la primera captura de la demo perezosa).
    const flat = flattenTree(
      TREE,
      options([], { loading: new Set(['c']), failed: new Set(['a']) }),
    );
    expect(flat.find((row) => row.row.id === 'c')?.loading).toBe(false);
    expect(flat.find((row) => row.row.id === 'a')?.failed).toBe(false);
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
    // «Expandir todo» tiene que conocer filas que nadie ve todavía.
    expect(expandableKeys(TREE, options())).toEqual(['a', 'a1', 'c']);
  });

  it('is empty for a flat list', () => {
    expect(expandableKeys([{ id: 'x' }, { id: 'y' }], options())).toEqual([]);
  });
});
