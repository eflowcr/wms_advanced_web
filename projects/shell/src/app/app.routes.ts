import type { Route, Routes } from '@angular/router';
import { MENU, MENU_DESTINATIONS, BUILT_ROUTES } from './layout/menu';

/**
 * Every menu destination that has no screen yet, as an «En construcción»
 * route.
 *
 * DERIVED FROM THE MENU, NOT LISTED AGAIN. Thirteen hand-written route objects
 * would be thirteen chances for the menu and the router to disagree, and the
 * failure mode of that disagreement is a menu entry that 404s -- which is
 * exactly what the placeholder page exists to prevent.
 *
 * Each one carries its `titleKey`, so the tab, the document title and the page
 * heading are all the same word in the reader's language.
 */
const UNDER_CONSTRUCTION: Routes = MENU_DESTINATIONS.filter(
  (entry) => entry.route !== undefined && !BUILT_ROUTES.includes(entry.route),
).map<Route>((entry) => ({
  // Routes are identifiers, not interface text -- but these ones are Spanish
  // because they are the product's own vocabulary (`/catalogos/articulos`),
  // which is what the legacy application and the warehouse floor both use.
  path: entry.route!.replace(/^\//, ''),
  data: { titleKey: entry.labelKey },
  loadComponent: async () => (await import('./pages/under-construction')).UnderConstruction,
}));

/**
 * THE ROUTE TREE, IN TWO LAYERS (ADR 0012).
 *
 * The public layer is EMPTY and is declared anyway. ADR 0012 decided this on
 * 2026-09-17 and gave the reason: moving the shell later means touching every
 * child route and every relative link at once, and the moment that would
 * happen is the moment authentication is built -- two risks in one pull
 * request. The boundary is cheap while it is empty.
 *
 * NO LOGIN AND NO GUARD ARE BUILT HERE. There is no backend to authenticate
 * against (PLN-WMS-005, Sprint 1). What exists is the place both will attach
 * to, and `SessionContext` as the seat of the state they will fill.
 */
export const routes: Routes = [
  /*
   * THE PUBLIC LAYER -- no shell, no rail, no tabs.
   *
   * A login drawn inside the shell, with the navy rail beside it, is
   * incoherent: there is nowhere to navigate yet. When `/login` is built it
   * goes here, and nothing below moves.
   */
  {
    path: 'login',
    // Reserved. Building an empty component for it would be building a screen
    // nobody specified; the layer is what had to exist early, not the page.
    redirectTo: '',
    pathMatch: 'full',
  },

  /*
   * THE AUTHENTICATED LAYER. Everything the operator uses renders inside the
   * App Shell. The session guard attaches HERE when there is a session to
   * guard -- one place, which is the gain ADR 0012 bought.
   */
  {
    path: '',
    loadComponent: async () => (await import('./layout/main-layout')).MainLayout,
    children: [
      {
        path: '',
        data: { titleKey: 'shell.menu.dashboard' },
        loadComponent: async () => (await import('./pages/home')).Home,
      },
      {
        // The showroom is an internal route, not Storybook.
        path: 'design-system',
        data: { titleKey: 'shell.menu.designSystem' },
        loadChildren: async () => (await import('@ewms/showroom')).showroomRoutes,
      },
      ...UNDER_CONSTRUCTION,
      {
        /*
         * ANYTHING ELSE IS THE DASHBOARD, NOT A BLANK PAGE.
         *
         * A real 404 screen belongs to DS-6, with the domains that can
         * actually be mistyped. Until then a stray URL landing on a shell with
         * nothing in `<main>` would be a page with no `h1` -- and the route
         * change moves the focus to the `h1`.
         */
        path: '**',
        redirectTo: '',
      },
    ],
  },
];

/** Re-exported so a reader of the routes can see where the tree comes from. */
export { MENU };
