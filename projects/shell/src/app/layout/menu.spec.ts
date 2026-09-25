import { MENU_DESTINATIONS, menuEntryFor, routeMatches } from './menu';

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
