import { DICTIONARIES } from '../i18n.testing';
import { MENU, MENU_DESTINATIONS, menuEntryFor, routeMatches } from './menu';

/** El texto de una clave con puntos. */
function text(dictionary: unknown, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dictionary);
  return String(value);
}

describe('the main destination', () => {
  it('is ONE, the Dashboard: first, with a route and without children', () => {
    // El rail lo dibuja centrado y aparte, como un botón (decisión del usuario, 2026-09-25).
    const main = MENU.flatMap((entry) => [entry, ...(entry.children ?? [])]).filter(
      (entry) => entry.main,
    );
    expect(main.map((entry) => entry.id)).toEqual(['dashboard']);
    expect(MENU[0]?.main).toBe(true);
    expect(MENU[0]?.route).toBe('/');
    expect(MENU[0]?.children).toBeUndefined();
  });
});

describe('the menu as the name of a route', () => {
  it('matches a route, its children and its query string, and nothing that only shares a prefix', () => {
    expect(routeMatches('/catalogos/articulos', '/catalogos/articulos')).toBe(true);
    expect(routeMatches('/catalogos/articulos/42', '/catalogos/articulos')).toBe(true);
    expect(routeMatches('/catalogos/articulos?estado=1', '/catalogos/articulos')).toBe(true);
    expect(routeMatches('/catalogos/articulosx', '/catalogos/articulos')).toBe(false);
  });

  it('takes the root as the root only, never as the prefix of everything', () => {
    expect(routeMatches('/', '/')).toBe(true);
    expect(routeMatches('/?pestaña=2', '/')).toBe(true);
    expect(routeMatches('/catalogos/articulos', '/')).toBe(false);
  });

  it('never matches an entry without a route: a group is not a destination', () => {
    expect(routeMatches('/catalogos', undefined)).toBe(false);
  });

  it('names a route by the longest destination that matches it', () => {
    expect(menuEntryFor('/design-system/components/button')?.route).toBe('/design-system');
    expect(menuEntryFor('/')?.route).toBe('/');
    expect(menuEntryFor('/no-existe')).toBeUndefined();
    expect(MENU_DESTINATIONS.every((entry) => entry.route !== undefined)).toBe(true);
  });
});

describe('the folded menu', () => {
  it('shows only words that are inside the full name, in both languages (WCAG 2.5.3)', () => {
    // Plegado se ve la etiqueta corta y el nombre accesible es la entera: quien dicta lo que ve
    // tiene que acertar. Ver vault: Navegacion.
    const shortened = MENU.flatMap((entry) => [entry, ...(entry.children ?? [])]).filter(
      (entry) => entry.shortLabelKey !== undefined,
    );
    expect(shortened.length).toBeGreaterThan(0);

    for (const lang of ['es', 'en'] as const) {
      for (const entry of shortened) {
        const full = text(DICTIONARIES[lang], entry.labelKey).toLocaleLowerCase(lang);
        const short = text(DICTIONARIES[lang], entry.shortLabelKey!).toLocaleLowerCase(lang);
        expect(full, `${lang}: ${entry.id}`).toContain(short);
      }
    }
  });
});
