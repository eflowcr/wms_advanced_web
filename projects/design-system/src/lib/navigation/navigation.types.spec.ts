import {
  CRUMB_FOLD_THRESHOLD,
  foldCrumbs,
  isGroup,
  parentOf,
  visibleItems,
  type Crumb,
  type NavItem,
} from './navigation.types';

/**
 * The arithmetic of the navigation, on its own.
 *
 * These four functions decide what the keyboard walks and what the trail
 * shows, and none of them needs a component to answer. Pulling them out is the
 * same move the scan detector made: "which item comes next when Catálogos is
 * closed?" is a question about a list, not about a rail.
 */

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
    // A group that opens onto nothing is a control that does nothing when
    // pressed. Whoever built the tree meant a destination.
    expect(isGroup({ id: 'x', label: 'X', icon: 'home', children: [] })).toBe(false);
  });
});

describe('visibleItems', () => {
  it('leaves a closed group folded', () => {
    const visible = visibleItems(TREE, new Set());

    expect(visible.map((item) => item.id)).toEqual(['dashboard', 'catalogs', 'design']);
  });

  it('walks into an open group, in place', () => {
    // In place and not appended: the arrows move down the screen, so the order
    // this returns has to be the order the eye reads.
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

    // The first is the way out and the last is where you are: neither folds.
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
