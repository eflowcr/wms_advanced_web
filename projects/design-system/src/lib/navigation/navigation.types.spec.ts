import {
  CRUMB_FOLD_THRESHOLD,
  foldCrumbs,
  isGroup,
  parentOf,
  visibleItems,
  type Crumb,
  type NavItem,
} from './navigation.types';

// La aritmética de la navegación, sin componentes: qué camina el teclado y qué muestra el rastro.

const TREE: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '/' },
  {
    id: 'catalogs',
    label: 'Catálogos',
    icon: 'inventory',
    children: [
      { id: 'articles', label: 'Artículos', icon: 'package', route: '/articulos' },
      { id: 'clients', label: 'Clientes', icon: 'operator', route: '/clientes' },
    ],
  },
  { id: 'design', label: 'Sistema de diseño', icon: 'controls', route: '/design-system' },
];

describe('isGroup', () => {
  it('is a group when it has children, and a destination otherwise', () => {
    expect(isGroup(TREE[1]!)).toBe(true);
    expect(isGroup(TREE[0]!)).toBe(false);
  });

  it('an EMPTY children array is not a group', () => {
    // Un grupo que abre a nada no hace nada al pulsarlo.
    expect(isGroup({ id: 'x', label: 'X', icon: 'home', children: [] })).toBe(false);
  });
});

describe('visibleItems', () => {
  it('leaves a closed group folded', () => {
    const visible = visibleItems(TREE, new Set());

    expect(visible.map((item) => item.id)).toEqual(['dashboard', 'catalogs', 'design']);
  });

  it('walks into an open group, in place', () => {
    // En su lugar y no al final: el orden es el que lee el ojo.
    const visible = visibleItems(TREE, new Set(['catalogs']));

    expect(visible.map((item) => item.id)).toEqual([
      'dashboard',
      'catalogs',
      'articles',
      'clients',
      'design',
    ]);
  });
});

describe('parentOf', () => {
  it('finds the group a child belongs to', () => {
    expect(parentOf(TREE, 'clients')?.id).toBe('catalogs');
  });

  it('is null for a top-level item and for one that does not exist', () => {
    expect(parentOf(TREE, 'dashboard')).toBeNull();
    expect(parentOf(TREE, 'nothing')).toBeNull();
  });
});

describe('foldCrumbs', () => {
  function trail(depth: number): readonly Crumb[] {
    return Array.from({ length: depth }, (_, index) => ({ label: `N${index}` }));
  }

  it('shows a short trail whole', () => {
    const short = trail(CRUMB_FOLD_THRESHOLD - 1);

    expect(foldCrumbs(short, false)).toEqual({ visible: short, folded: 0 });
  });

  it('folds the middle of a deep trail and counts what it hid', () => {
    const deep = trail(7);
    const { visible, folded } = foldCrumbs(deep, false);

    // La primera es la salida y la última dónde estás: ninguna se pliega.
    expect(visible.map((crumb) => crumb.label)).toEqual(['N0', 'N6']);
    expect(folded).toBe(5);
  });

  it('gives the whole trail back once the fold is opened', () => {
    const deep = trail(7);

    expect(foldCrumbs(deep, true).visible).toHaveLength(7);
    expect(foldCrumbs(deep, true).folded).toBe(0);
  });

  it('an empty trail folds nothing rather than throwing', () => {
    expect(foldCrumbs([], false)).toEqual({ visible: [], folded: 0 });
  });
});
