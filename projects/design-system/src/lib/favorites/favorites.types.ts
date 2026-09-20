import { InjectionToken, type Signal } from '@angular/core';
import type { IconName } from '../../icons/icons.generated';

/**
 * A favourite is A ROUTE. Nothing else.
 *
 * Not the screen's state, not its filters, not a query string. That is what
 * makes the datum trivially non-sensitive, and it is the promise the contract
 * to the backend repeats (REQ-FE-DS4-002 §12).
 *
 * AND NOT ITS NAME. Until v1.3 of the REQ a favourite carried the label it had
 * when it was marked, already translated -- so «Artículos», marked in Spanish,
 * stayed «Artículos» after switching to English, and a backend would have kept
 * it that way for good. The name is PRESENTATION: it depends on the language
 * and on what the screen is called tomorrow. It is resolved when the block is
 * drawn, through `EWMS_FAVORITE_LABELS`, and never stored.
 */
export interface Favorite {
  /** The application route. The identity of the favourite: stable, no language. */
  readonly route: string;
  /** Optional. When absent, the resolver supplies one. */
  readonly icon?: IconName;
}

/**
 * WHAT A ROUTE IS CALLED, ASKED AT THE MOMENT OF DRAWING.
 *
 * `labelFor` returns a SIGNAL so a language switch repaints the block by
 * itself. A route nobody can name any more -- a screen that was removed --
 * resolves to the empty string, and the block shows the route as it is rather
 * than an empty row.
 *
 * A provider of WORDS, not of state: each application provides its own for the
 * routes it knows, exactly like the dictionaries. Providing it twice is
 * correct in a way that providing the STORE twice never is.
 */
export interface FavoriteLabelResolver {
  labelFor(route: string): Signal<string>;
  iconFor(route: string): IconName | null;
}

export const EWMS_FAVORITE_LABELS = new InjectionToken<FavoriteLabelResolver>(
  'EWMS_FAVORITE_LABELS',
);

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
