import type { Favorite, FavoritesStore } from './favorites.types';

/**
 * FAVOURITES IN MEMORY, AND THE LIMITATION IS THE POINT OF WRITING IT DOWN.
 *
 * Decisión del usuario (2026-09-19), replacing the decision of 2026-09-18 that
 * deferred favourites until the backend existed. The comanda's "listo cuando"
 * for step 7 reads *"the pattern is built and works in the example app, even
 * though it does not yet have real user data"*, and this is that.
 *
 *   WHAT IT COSTS: THEY ARE LOST ON RELOAD. There is no browser storage
 *   anywhere in this application -- ESLint forbids `localStorage` and
 *   `sessionStorage` outright and NO EXCEPTION IS OPENED HERE, which was the
 *   whole reason the decision was difficult. So the list lives for as long as
 *   the tab does.
 *
 *   WHEN IT STOPS COSTING THAT: the Security Core of the backend
 *   (PLN-WMS-005, Sprint 1). A favourite is a per-user preference and needs a
 *   user to belong to. The contract to ask for is already written
 *   (REQ-FE-DS4-002 §12).
 *
 * The end-to-end suite ASSERTS THE LOSS rather than working around it: marking
 * two favourites, reloading, and finding the block empty is a test. The day
 * somebody connects the backend that test fails, which is exactly when this
 * paragraph has to be rewritten.
 *
 * SHIPPED FROM THE LIBRARY, unlike `SearchSource`'s demo implementation, and
 * for the reason `ArrayTableSource` is shipped: both applications need it --
 * the shell and the showroom -- and writing "an array in a field" twice is two
 * things that drift. A backend implementation is a different matter and does
 * not belong here.
 */
export class InMemoryFavoritesStore implements FavoritesStore {
  /**
   * Insertion order, and that IS the stable order RFE-01 asks for. Sorting by
   * label would reshuffle the block every time a language changed; sorting by
   * route would put a list in an order nobody chose. What somebody marked
   * first stays first.
   */
  private favorites: Favorite[] = [];

  read(): Promise<readonly Favorite[]> {
    return Promise.resolve([...this.favorites]);
  }

  add(favorite: Favorite): Promise<void> {
    if (!this.favorites.some((current) => current.route === favorite.route)) {
      this.favorites.push(favorite);
    }
    return Promise.resolve();
  }

  remove(route: string): Promise<void> {
    this.favorites = this.favorites.filter((current) => current.route !== route);
    return Promise.resolve();
  }
}
