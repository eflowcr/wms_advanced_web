import { signal } from '@angular/core';
import { TableSavedViews, sameState } from './table-saved-views';
import {
  InMemoryTableViewStore,
  parseTableViews,
  TABLE_VIEWS_VERSION,
  type TableSavedState,
} from './table-saved-views.types';

const STATE: TableSavedState = {
  view: { order: ['a', 'b'], hidden: [], widths: { a: 120 }, pinned: {}, density: 'md' },
  filters: { a: 'x', b: { min: 1 } },
  sort: [{ key: 'a', direction: 'asc' }],
};

describe('parseTableViews', () => {
  it('takes a document of its version, and keeps the good views of a partly broken one', () => {
    const parsed = parseTableViews({
      version: TABLE_VIEWS_VERSION,
      views: [
        { id: '1', name: 'Uno', state: STATE },
        { id: '2', name: 'Rota', state: { view: 'nada' } },
        { id: '3', name: 'Filtro raro', state: { ...STATE, filters: { a: { desde: 1 } } } },
      ],
      defaultId: '1',
    });
    expect(parsed?.views.map((view) => view.id)).toEqual(['1']);
    expect(parsed?.defaultId).toBe('1');
  });

  it('DISCARDS ANOTHER VERSION OR ANOTHER SHAPE, never half-reads it', () => {
    expect(parseTableViews({ version: 0, views: [], defaultId: null })).toBeNull();
    expect(parseTableViews({ version: TABLE_VIEWS_VERSION + 1, views: [] })).toBeNull();
    expect(parseTableViews('texto')).toBeNull();
    expect(parseTableViews(null)).toBeNull();
    expect(parseTableViews([])).toBeNull();
  });

  it('a default that points at nothing is no default', () => {
    const parsed = parseTableViews({ version: TABLE_VIEWS_VERSION, views: [], defaultId: 'x' });
    expect(parsed).toEqual({ version: TABLE_VIEWS_VERSION, views: [], defaultId: null });
  });
});

describe('TableSavedViews', () => {
  function setup(store = new InMemoryTableViewStore(), key: string | null = 'expediciones') {
    const current = signal<TableSavedState>(STATE);
    let id = 0;
    const views = new TableSavedViews({
      store,
      key: () => key,
      capture: () => current(),
      apply: (state) => current.set(state),
      newId: () => `v${++id}`,
    });
    return { views, current, store };
  }

  it('is off without a store or without a key: nothing to offer', () => {
    expect(
      new TableSavedViews({
        store: null,
        key: () => 'x',
        capture: () => STATE,
        apply: () => undefined,
        newId: () => '1',
      }).enabled(),
    ).toBe(false);
    expect(setup(new InMemoryTableViewStore(), null).views.enabled()).toBe(false);
    expect(setup().views.enabled()).toBe(true);
  });

  it('CREATES, SAYS WHEN IT CHANGED, SAVES AND REVERTS', async () => {
    const { views, current, store } = setup();
    views.create('Mías');
    expect(views.active()?.name).toBe('Mías');
    expect(views.modified()).toBe(false);

    current.set({ ...STATE, sort: [] });
    expect(views.modified()).toBe(true);
    views.revert();
    expect(current().sort).toEqual(STATE.sort);

    current.set({ ...STATE, sort: [] });
    views.saveChanges();
    expect(views.modified()).toBe(false);
    expect((await store.read('expediciones'))?.views[0]?.state.sort).toEqual([]);
  });

  it('renames, duplicates next to it, removes, and one default at a time', async () => {
    const { views, store } = setup();
    views.create('Uno');
    views.create('Dos');
    views.rename('v1', 'Primera');
    views.duplicate('v1', 'Primera (copia)');
    expect(views.views().map((view) => view.name)).toEqual(['Primera', 'Primera (copia)', 'Dos']);
    expect(views.activeId()).toBe('v3');

    views.toggleDefault('v2');
    expect(views.defaultId()).toBe('v2');
    views.toggleDefault('v2');
    expect(views.defaultId()).toBeNull();

    views.toggleDefault('v3');
    views.remove('v3');
    expect(views.activeId()).toBeNull();
    expect(views.defaultId()).toBeNull();
    expect((await store.read('expediciones'))?.views.map((view) => view.id)).toEqual(['v1', 'v2']);
  });

  it('OPENS WITH THE DEFAULT VIEW, as it was saved', async () => {
    const store = new InMemoryTableViewStore();
    const saved = { ...STATE, sort: [{ key: 'b', direction: 'desc' as const }] };
    await store.write('expediciones', {
      version: TABLE_VIEWS_VERSION,
      views: [{ id: 'x', name: 'Por defecto', state: saved }],
      defaultId: 'x',
    });
    const { views, current } = setup(store);
    await views.load();
    expect(views.activeId()).toBe('x');
    expect(current()).toEqual(saved);
  });

  it('compares by content, whatever the order of the keys', () => {
    const reordered: TableSavedState = {
      sort: STATE.sort,
      filters: { b: { min: 1 }, a: 'x' },
      view: { density: 'md', pinned: {}, widths: { a: 120 }, hidden: [], order: ['a', 'b'] },
    };
    expect(sameState(STATE, reordered)).toBe(true);
    expect(sameState(STATE, { ...STATE, filters: {} })).toBe(false);
  });
});
