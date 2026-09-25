import {
  CATALOG,
  catalogKeyFor,
  countEntries,
  filterCatalog,
  SHOWROOM_BASE,
  STATUS_LABELS,
  type CatalogEntry,
} from './catalog';
import { showroomText } from './showroom.testing';

/** El nombre en español, como lo traduce el layout con el idioma activo. */
const spanish = (entry: CatalogEntry): string => showroomText(entry.name);
const english = (entry: CatalogEntry): string => showroomText(entry.name, 'en');

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
          // Una página que no existe no es navegable: en su lugar se ve el estado.
          expect(entry.route, entry.id).toBeNull();
        }
      }
    }
  });

  it('leaves nothing built without a page', () => {
    // Promesa cerrada en DS-2 PR 4: todo componente en verde tiene ficha. `built` sigue siendo
    // un estado legal, pero no sobrevive al PR que lo abrió: componente y ficha van juntos.
    const built = CATALOG.flatMap((section) =>
      section.entries.filter((entry) => entry.status === 'built').map((entry) => entry.id),
    );
    expect(built).toEqual([]);
  });

  it('labels everything that is not ready as pending, and nothing else', () => {
    expect(STATUS_LABELS.ready).toBeNull();
    for (const status of ['built', 'documented', 'gap'] as const) {
      expect(showroomText(STATUS_LABELS[status] ?? '')).toBe('(pendiente)');
    }
  });

  it('names every entry, note and section in both dictionaries', () => {
    const keys = CATALOG.flatMap((section) => [
      section.title,
      ...section.entries.flatMap((entry) => [entry.name, entry.note]),
    ]);
    for (const key of keys) {
      expect(showroomText(key), key).not.toBe('');
      expect(showroomText(key, 'en'), key).not.toBe('');
    }
  });

  it('does not list the App Shell: it is the shell layout, not a design-system component', () => {
    const names = CATALOG.flatMap((section) => section.entries.map(spanish));
    expect(names.some((name) => /app shell/i.test(name))).toBe(false);
  });

  it('names a page by its route for whoever names it from outside, and nothing else', () => {
    expect(catalogKeyFor(`${SHOWROOM_BASE}/components/button?tab=1`)).toBe(
      'showroom.catalog.button.name',
    );
    // Badge comparte la ruta de la Tabla: manda la primera entrada.
    expect(catalogKeyFor(`${SHOWROOM_BASE}/components/table`)).toBe('showroom.catalog.table.name');
    expect(catalogKeyFor(SHOWROOM_BASE)).toBeNull();
    expect(catalogKeyFor('/catalogos/articulos')).toBeNull();
  });

  describe('filterCatalog', () => {
    it('returns everything for an empty or blank query', () => {
      expect(filterCatalog('', spanish)).toBe(CATALOG);
      expect(filterCatalog('   ', spanish)).toBe(CATALOG);
    });

    it('matches by name, ignoring case', () => {
      const sections = filterCatalog('TOGGLE', spanish);

      // Dos desde DS-5, y es la búsqueda funcionando: «Toggle» por nombre y «Favoritos» por
      // selector (`ewms-favorite-toggle`). Achicar la consulta probaría una coincidencia.
      expect(sections.flatMap((section) => section.entries).map((entry) => entry.id)).toEqual([
        'toggle',
        'favorites',
      ]);
    });

    it('matches by the name in the active language, not in another', () => {
      expect(countEntries(filterCatalog('botón', spanish))).toBe(1);
      expect(countEntries(filterCatalog('botón', english))).toBe(0);
      expect(filterCatalog('data table', english)[0]?.entries[0]?.id).toBe('table');
    });

    it('matches by selector, which is what you type in a template', () => {
      const sections = filterCatalog('ewms-select', spanish);
      expect(countEntries(sections)).toBe(1);
      expect(sections[0]?.entries[0]?.id).toBe('select');
    });

    it('drops a section that ends up empty rather than leaving a bare heading', () => {
      const sections = filterCatalog('marca', spanish);
      expect(sections).toHaveLength(1);
      expect(sections[0]?.id).toBe('foundations');
    });

    it('returns nothing for a query that matches nothing', () => {
      expect(countEntries(filterCatalog('no-existe-este-componente', spanish))).toBe(0);
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
