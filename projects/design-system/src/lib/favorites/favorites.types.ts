import { InjectionToken } from '@angular/core';
import type { IconName } from '../../icons/icons.generated';

/**
 * A favourite is A ROUTE AND ITS NAME. Nothing else.
 *
 * Not the screen's state, not its filters, not a query string. That is what
 * makes the datum trivially non-sensitive, and it is the promise the contract
 * to the backend repeats (REQ-FE-DS4-002 §12).
 *
 * The label arrives ALREADY TRANSLATED from whoever marked it. The design
 * system speaks no language (ADR 0008), and the alternative -- storing a
 * translation key -- would make a favourite depend on a dictionary that the
 * store knows nothing about.
 */
export interface Favorite {
  /** The application route. The identity of the favourite. */
  readonly route: string;
  /** What to show, already translated. */
  readonly label: string;
  readonly icon?: IconName;
}

/**
 * WHERE FAVOURITES LIVE, BEHIND AN INTERFACE (RFE-02).
 *
 * `Favorites` knows this and never a mechanism. The implementation is the one
 * thing that changes when the Security Core arrives (PLN-WMS-005, Sprint 1):
 * a second class, provided instead of this one, and the service, the toggle
 * and the navigation block are not touched.
 *
 * ASYNCHRONOUS IN ITS FORM, although the in-memory implementation answers at
 * once. A synchronous interface would have to be rewritten -- along with every
 * consumer -- the day the answer comes over the network, and "we will make it
 * async later" is a change that touches every call site at once.
 */
export interface FavoritesStore {
  /** The whole list, in a stable order. */
  read(): Promise<readonly Favorite[]>;
  /**
   * Add one. Not "replace the list": two tabs open must not overwrite each
   * other, which is the same rule the backend contract asks for (§12).
   */
  add(favorite: Favorite): Promise<void>;
  /** Remove one, by route. */
  remove(route: string): Promise<void>;
}

/**
 * The store, PROVIDED ONCE PER APPLICATION.
 *
 * The library declares the shape and the applications provide it, exactly like
 * `EWMS_SHORTCUT_MAP` and `EWMS_TABLE_MESSAGES` before it.
 */
export const EWMS_FAVORITES_STORE = new InjectionToken<FavoritesStore>('EWMS_FAVORITES_STORE');
