import { CATALOG, countEntries, filterCatalog, SHOWROOM_BASE, STATUS_LABELS } from './catalog';

describe('the catalogue', () => {
  it('is one list with three sections', () => {
    expect(CATALOG.map((section) => section.id)).toEqual(['foundations', 'components', 'patterns']);
  });

  it('gives every entry a unique id', () => {
    const ids = CATALOG.flatMap((section) => section.entries.map((entry) => entry.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only gives a route to an entry that is ready, and always under the showroom', () => {
    for (const section of CATALOG) {
      for (const entry of section.entries) {
        if (entry.status === 'ready') {
          expect(entry.route, entry.id).toContain(SHOWROOM_BASE);
        } else {
          // A page that does not exist must not be navigable: the state is
          // visible instead, which is the point of listing it at all.
          expect(entry.route, entry.id).toBeNull();
        }
      }
    }
  });

  it('leaves nothing built without a page', () => {
    /*
     * The promise DS-2 PR 4 closed, kept as a test so it cannot quietly
     * reopen: every component that compiles and is green has a sheet in the
     * showroom.
     *
     * `built` REMAINS A LEGAL STATE and the type keeps it on purpose -- it is
     * what a catalogue entry looks like between a component landing and its
     * page being written. What this asserts is that the gap does not survive
     * the PR that opened it: build a component and its sheet goes in the same
     * change, or this fails and names it.
     */
    const built = CATALOG.flatMap((section) =>
      section.entries.filter((entry) => entry.status === 'built').map((entry) => entry.id),
    );
    expect(built).toEqual([]);
  });

  it('labels everything that is not ready as pending, and nothing else', () => {
    expect(STATUS_LABELS.ready).toBe('');
    expect(STATUS_LABELS.built).toBe('(pendiente)');
    expect(STATUS_LABELS.documented).toBe('(pendiente)');
    expect(STATUS_LABELS.gap).toBe('(pendiente)');
  });

  it('does not list the App Shell: it is the shell layout, not a design-system component', () => {
    const names = CATALOG.flatMap((section) => section.entries.map((entry) => entry.name));
    expect(names.some((name) => /app shell/i.test(name))).toBe(false);
  });

  describe('filterCatalog', () => {
    it('returns everything for an empty or blank query', () => {
      expect(filterCatalog('')).toBe(CATALOG);
      expect(filterCatalog('   ')).toBe(CATALOG);
    });

    it('matches by name, ignoring case', () => {
      const sections = filterCatalog('TOGGLE');

      /*
       * TWO SINCE DS-5, AND THAT IS THE SEARCH WORKING RATHER THAN FAILING:
       * «Toggle» matches by NAME and «Favoritos» matches by SELECTOR
       * (`ewms-favorite-toggle`). Narrowing the query to keep the number at
       * one would be testing a coincidence instead of the behaviour.
       */
      expect(sections.flatMap((section) => section.entries).map((entry) => entry.id)).toEqual([
        'toggle',
        'favorites',
      ]);
    });

    it('matches by selector, which is what you type in a template', () => {
      const sections = filterCatalog('ewms-select');
      expect(countEntries(sections)).toBe(1);
      expect(sections[0]?.entries[0]?.id).toBe('select');
    });

    it('drops a section that ends up empty rather than leaving a bare heading', () => {
      const sections = filterCatalog('marca');
      expect(sections).toHaveLength(1);
      expect(sections[0]?.id).toBe('foundations');
    });

    it('returns nothing for a query that matches nothing', () => {
      expect(countEntries(filterCatalog('no-existe-este-componente'))).toBe(0);
    });
  });

  describe('countEntries', () => {
    it('adds up the entries of every section', () => {
      expect(countEntries(CATALOG)).toBe(
        CATALOG.reduce((total, section) => total + section.entries.length, 0),
      );
      expect(countEntries([])).toBe(0);
    });
  });
});
