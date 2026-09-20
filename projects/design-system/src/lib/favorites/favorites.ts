import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { EWMS_FAVORITES_STORE, type Favorite } from './favorites.types';

/**
 * THE FAVOURITES OF THIS SESSION, AS SIGNALS (REQ-FE-DS4-002 RFE-01).
 *
 * Signals and not a store library, like every other piece of state in this
 * application: PLN-WMS-002 §5 asks for state management in proportion to the
 * problem, and the problem is a list of at most a handful of routes.
 *
 * IT KNOWS THE INTERFACE AND NEVER A MECHANISM. Where the list is kept is
 * `EWMS_FAVORITES_STORE`'s business; this service reads through it, writes
 * through it, and holds the answer in a signal so the block in the navigation
 * and the star on the page redraw together without either of them asking.
 *
 * WHY IT IS HERE AND NOT IN `core/preferences/`, which is where the REQ put
 * it. Exactly the reason the keyboard engine is here: the showroom may not
 * import `@ewms/core` at all (the boundary is an ESLint error), and the
 * showroom is where the example screen lives. A service in `core/` would have
 * meant a second implementation for the catalogue, which is the drift the
 * single interface exists to prevent. Carried into v1.2 of the REQ with this
 * reason, as the same move was carried into v1.1 for `keyboard/`.
 */
@Injectable()
export class Favorites {
  private readonly store = inject(EWMS_FAVORITES_STORE);

  private readonly items = signal<readonly Favorite[]>([]);

  /** The list, in a stable order. */
  readonly list: Signal<readonly Favorite[]> = this.items.asReadonly();

  readonly count = computed(() => this.items().length);

  constructor() {
    void this.refresh();
  }

  /** Whether this route is marked. A signal, so a star redraws by itself. */
  isFavorite(route: string): Signal<boolean> {
    return computed(() => this.items().some((favorite) => favorite.route === route));
  }

  /**
   * Mark or unmark. Idempotent per pair: marking and unmarking returns the
   * list to exactly where it was (PACQ-01.2).
   *
   * The signal is refreshed FROM THE STORE after the write rather than being
   * patched optimistically. With the in-memory store the difference is
   * invisible; with a backend it is the difference between showing what was
   * saved and showing what we hoped was saved.
   */
  async toggle(favorite: Favorite): Promise<void> {
    const marked = this.items().some((current) => current.route === favorite.route);
    if (marked) {
      await this.store.remove(favorite.route);
    } else {
      await this.store.add(favorite);
    }
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    this.items.set(await this.store.read());
  }
}
