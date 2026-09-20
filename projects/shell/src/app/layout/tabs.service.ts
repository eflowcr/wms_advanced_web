import { Injectable, computed, signal, type Signal } from '@angular/core';
import type { Tab } from '@ewms/design-system';

/**
 * HOW MANY DOCUMENTS MAY BE OPEN AT ONCE.
 *
 * Twelve, and it is a DECISION OF THE TEAM (2026-09-19) rather than a
 * technical limit, so it is written down with its reason and can be revised:
 *
 *   - MEMORY. Every open tab is a route whose component stays addressable, and
 *     with real domains each one holds a table, its filters and its page.
 *   - LEGIBILITY. Past a dozen the strip is scrolling in both directions and
 *     the tab you want is faster to reach from the menu than from the strip,
 *     at which point the strip has stopped doing its job.
 *
 * What happens at the limit is a WARNING and a refusal, not a silent drop of
 * the oldest: closing somebody's work without being asked is worse than
 * telling them the strip is full.
 */
export const MAX_OPEN_TABS = 12;

/** One open document: the route it is, and the title it shows. */
export interface OpenTab extends Tab {
  readonly route: string;
}

/**
 * THE OPEN DOCUMENTS, IN MEMORY, IN THE SHELL.
 *
 * In the shell and not in the design system, for the reason `App-Shell.md`
 * gives: which routes are open is a fact about THIS application. `ewms-tabs`
 * draws a list of things one of which is showing, and knows nothing about
 * routes.
 *
 * In memory, and lost on reload, like the favourites and for the same reason:
 * there is no browser storage anywhere in this application and no exception is
 * opened here either.
 */
@Injectable({ providedIn: 'root' })
export class TabsService {
  private readonly open = signal<readonly OpenTab[]>([]);

  readonly tabs: Signal<readonly OpenTab[]> = this.open.asReadonly();

  /** Which route is showing. Null before the first navigation resolves. */
  private readonly active = signal<string | null>(null);
  readonly activeRoute: Signal<string | null> = this.active.asReadonly();

  readonly isFull = computed(() => this.open().length >= MAX_OPEN_TABS);

  /**
   * A route was navigated to: open it if it was not open, and activate it.
   *
   * Returns `false` when the strip was full and the route was NOT opened, so
   * the caller can say so. It does not raise the toast itself: the design
   * system speaks no language, and neither does a service that would have to
   * choose the words.
   */
  activate(route: string, label: string, closable = true): boolean {
    this.active.set(route);

    if (this.open().some((tab) => tab.route === route)) {
      return true;
    }
    if (this.isFull()) {
      return false;
    }

    this.open.update((tabs) => [...tabs, { id: route, route, label, closable }]);
    return true;
  }

  /**
   * Keep a tab's label in step with the language.
   *
   * A tab's title is the route's title, translated. Without this, switching
   * language redrew the menu and left the strip in the previous one -- which
   * is exactly the kind of half-translated screen ADR 0008 exists to prevent.
   */
  relabel(route: string, label: string): void {
    this.open.update((tabs) =>
      tabs.map((tab) => (tab.route === route ? { ...tab, label } : tab)),
    );
  }

  /**
   * Close one, and say where to go next.
   *
   * Returns the route that should now be showing, or `null` when nothing is
   * left. The NEIGHBOUR and not the first: closing the third of five tabs and
   * landing on the first is a jump nobody asked for.
   */
  close(route: string): string | null {
    const tabs = this.open();
    const index = tabs.findIndex((tab) => tab.route === route);
    if (index < 0) {
      return this.active();
    }

    const rest = tabs.filter((tab) => tab.route !== route);
    this.open.set(rest);

    if (this.active() !== route) {
      return this.active();
    }
    if (rest.length === 0) {
      this.active.set(null);
      return null;
    }

    const neighbour = rest[Math.min(index, rest.length - 1)];
    const next = neighbour?.route ?? null;
    this.active.set(next);
    return next;
  }
}
