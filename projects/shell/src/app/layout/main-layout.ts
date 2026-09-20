import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { SessionContext } from '@ewms/core';
import {
  Breadcrumbs,
  Favorites,
  FavoriteToggle,
  FavoritesNav,
  IconButton,
  KeyboardShortcuts,
  NavBottom,
  NavRail,
  ShortcutsHost,
  Tabs,
  ToastOutlet,
  ToastService,
  Viewport,
  type Crumb,
  type Favorite,
  type NavItem,
  type Tab,
} from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { BRAND_NAME } from '../brand';
import { provideEwmsDesignSystem } from '../design-system.providers';
import { LanguageSwitcher } from './language-switcher';
import { MENU, MENU_DESTINATIONS, menuEntryFor, routeMatches, type MenuEntry } from './menu';
import { MAX_OPEN_TABS, TabsService } from './tabs.service';

/**
 * THE APP SHELL (DS-5). Header, navigation, document tabs, and the one place
 * every screen renders inside.
 *
 * IT IS THE ARMADO, NOT A COMPONENT. `App-Shell.md` settled this: the pieces
 * that know nothing about the application -- the rail, the tabs, the crumbs --
 * are the design system's; what knows the router, the real menu, the
 * credentials and the active warehouse is this file, and it lives in the
 * shell. That is why the App Shell is not in the catalogue and the navigation
 * pieces are.
 *
 * IT STILL MOUNTS EXACTLY ONE OF EACH:
 *
 *   - ONE keyboard listener (`ewmsShortcutsHost`), inherited from the
 *     provisional layout this replaces and NOT duplicated. `lint:shortcuts`
 *     checks that claim rather than trusting it.
 *   - ONE toast outlet, for the same reason: two aria-live regions announce
 *     every message twice.
 *
 * WHAT IT ADDS THAT THE PROVISIONAL HEADER DID NOT HAVE, and each of them
 * closes something that was written down as missing:
 *
 *   - A SKIP LINK, first in the DOM (WCAG 2.4.1). With a menu of sixteen
 *     destinations, a keyboard user without one pays the whole navigation on
 *     every screen. It is also half of what closes the "5 tabs to the search"
 *     gap; `/` is the other half.
 *   - THE FOCUS MOVES TO THE `h1` ON EVERY ROUTE CHANGE, and the new title is
 *     announced by a live region. A browser does neither in a single-page
 *     application, so without this a screen-reader user hears nothing at all
 *     when a page changes.
 *   - THE HEADER'S SEARCH FIELD IS WHERE `/` LANDS when the screen showing did
 *     not claim the action for itself.
 */
@Component({
  imports: [
    Breadcrumbs,
    FavoriteToggle,
    FavoritesNav,
    IconButton,
    LanguageSwitcher,
    NavBottom,
    NavRail,
    RouterOutlet,
    ShortcutsHost,
    Tabs,
    ToastOutlet,
    TranslocoPipe,
  ],
  selector: 'app-main-layout',
  templateUrl: './main-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  /*
   * The design system's texts and formats, PROVIDED ONCE for the whole
   * application -- and provided HERE rather than in `appConfig`.
   *
   * `appConfig` is eager: anything it imports lands in the initial bundle, and
   * importing the design system's barrel from there dragged the whole library
   * in, initial budget and all. This component is lazily loaded like every
   * other route, so the cost lands where the rest of the design system already
   * is.
   *
   * Every routed page renders inside this one, so "once for the whole
   * application" still holds.
   */
  providers: [provideEwmsDesignSystem()],
})
export class MainLayout {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly toasts = inject(ToastService);
  private readonly tabsService = inject(TabsService);
  private readonly favorites = inject(Favorites);
  private readonly shortcuts = inject(KeyboardShortcuts);

  protected readonly session = inject(SessionContext);
  protected readonly viewport = inject(Viewport);

  protected readonly brandName = BRAND_NAME;
  protected readonly maxTabs = MAX_OPEN_TABS;

  private readonly main = viewChild<ElementRef<HTMLElement>>('main');
  private readonly searchField = viewChild<ElementRef<HTMLInputElement>>('headerSearch');

  /** Collapsed rail or expanded panel. In memory, like everything else here. */
  protected readonly railExpanded = signal(true);

  /** What the live region says after a route change. */
  protected readonly routeAnnouncement = signal('');

  /** The language, as a signal, so every label below redraws when it changes. */
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** The URL, as a signal. `startWith` because the first navigation is done. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * The menu, translated.
   *
   * `activeLang()` is read so this recomputes on a language change: menu.ts
   * holds keys, not words, and the whole point of that is that switching
   * language redraws the navigation without a reload.
   */
  protected readonly navItems = computed<readonly NavItem[]>(() => {
    this.activeLang();
    return MENU.map((entry) => this.toNavItem(entry));
  });

  /** Which menu entry is the page showing. */
  protected readonly activeId = computed(() => menuEntryFor(this.url())?.id ?? null);

  protected readonly tabs = computed<readonly Tab[]>(() => this.tabsService.tabs());
  protected readonly activeTabId = computed(() => this.tabsService.activeRoute());

  /**
   * The crumbs of the page showing: its group, then itself.
   *
   * Built here and not by each screen, because the trail is a fact about the
   * MENU and the menu lives here. A domain screen with a deeper trail of its
   * own will extend this in DS-6.
   */
  protected readonly crumbs = computed<readonly Crumb[]>(() => {
    this.activeLang();
    const active = this.activeId();
    if (active === null) {
      return [];
    }
    const group = MENU.find((entry) => entry.children?.some((child) => child.id === active));
    const item = MENU_DESTINATIONS.find((entry) => entry.id === active);
    const trail: Crumb[] = [{ label: this.transloco.translate('shell.menu.home'), route: '/' }];
    if (group !== undefined) {
      trail.push({ label: this.transloco.translate(group.labelKey) });
    }
    if (item !== undefined) {
      trail.push({ label: this.transloco.translate(item.labelKey) });
    }
    return trail;
  });

  /**
   * What THIS page is, as a favourite: THE ROUTE, and nothing else. The star
   * takes it as it is; what the route is called is resolved by the block when
   * it draws (`EWMS_FAVORITE_LABELS`), so it is never handed over from here.
   */
  protected readonly pageRoute = computed(() => this.url().split('?')[0] ?? '/');

  /** What the page showing is called: for its tab and for the announcement. */
  private readonly pageTitle = computed(() => {
    this.activeLang();
    const active = this.activeId();
    const item = MENU_DESTINATIONS.find((entry) => entry.id === active);
    return item === undefined ? this.brandName : this.transloco.translate(item.labelKey);
  });

  constructor() {
    /*
     * ROUTE CHANGED: open the tab, move the focus, announce the title.
     *
     * All three in one effect because all three are the same event, and
     * splitting them is how one of them gets forgotten. The browser does none
     * of them in a single-page application.
     */
    effect(() => {
      const url = this.url();
      const title = this.pageTitle();

      /*
       * `untracked`, AND IT IS LOAD-BEARING RATHER THAN TIDY.
       *
       * `TabsService.activate` writes `active` and `open` -- and, to decide
       * what to write, it READS them. Called straight from an effect body,
       * those reads become dependencies of this effect, and the writes then
       * re-run it: an infinite synchronous loop that locks the tab before the
       * first paint. It was found by opening the application, which is the
       * only place it shows -- every unit test drives the service directly.
       *
       * What this effect genuinely depends on is the two lines above it: the
       * url and the page it resolves to. Everything else is a consequence, and
       * `untracked` is how that distinction is written down.
       */
      untracked(() => {
        const opened = this.tabsService.activate(url, title, url !== '/');
        if (!opened) {
          this.toasts.show(
            'warning',
            this.transloco.translate('shell.tabs.limit', { max: MAX_OPEN_TABS }),
          );
        } else {
          // Keep an already-open tab's label in step with the language.
          this.tabsService.relabel(url, title);
        }

        this.focusPage();
        this.routeAnnouncement.set(title);
      });
    });

    /*
     * A LANGUAGE CHANGE RE-LABELS EVERY OPEN TAB, not just the active one.
     *
     * The effect above keeps the CURRENT route's tab in step, which was enough
     * until somebody switched language with four documents open: the active
     * tab turned Spanish and the other three stayed English. A strip in two
     * languages is exactly the half-translated screen ADR 0008 exists to
     * prevent, and it was found by switching the language and looking.
     *
     * The shell is the only thing that can do this: it owns the menu, so it is
     * the only thing that knows what a route is CALLED.
     */
    effect(() => {
      this.activeLang();
      untracked(() => {
        for (const tab of this.tabsService.tabs()) {
          const item = MENU_DESTINATIONS.find((entry) => routeMatches(tab.route, entry.route));
          if (item !== undefined) {
            this.tabsService.relabel(tab.route, this.transloco.translate(item.labelKey));
          }
        }
      });
    });

    /*
     * `/` LANDS IN THE HEADER'S SEARCH FIELD -- WHEN NOBODY ELSE CLAIMED IT.
     *
     * THE SHELL DOES NOT REGISTER `search`, AND THAT IS THE WHOLE TRICK.
     *
     * The obvious version -- take the action, give it back when a screen wants
     * it -- cannot be made to work, and the reason is worth writing down. The
     * engine THROWS on a second registration, deliberately: two handlers for
     * `search` is two screens disagreeing about what `/` does. So the shell
     * would have to release the action before the incoming screen asks for it,
     * and there is no moment where that is true. THIS APPLICATION IS ZONELESS:
     * a routed component is created by the change detection that FOLLOWS
     * `NavigationEnd`, not before it, so the shell won the race against every
     * screen and the showroom's pattern pages threw on load. Two attempts at
     * ordering it failed before it was clear the shape was wrong, not the
     * timing.
     *
     * What works is asking the engine what it already knows. It publishes what
     * it decided about every keystroke, and `unregistered` means exactly
     * "this WAS the search binding and nobody was listening". The shell
     * answers those and only those.
     *
     * No registration, no race, no conflict -- and the rule the comanda asks
     * for, stated once in code: `/` goes to the screen's own field when it has
     * one, and to the header's when it does not.
     */
    this.shortcuts.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.action === 'search' && event.outcome === 'unregistered') {
        this.focusSearch();
      }
    });
  }

  /**
   * THE SKIP LINK GOES TO `main`, AND THE ROUTE CHANGE GOES TO THE `h1`.
   *
   * Two different jobs, and conflating them cost the comanda's own number.
   *
   *   The route change has to say WHERE YOU ARE, so it lands on the heading
   *   that names the page.
   *
   *   The skip link has to say TAB ON FROM HERE, so it lands on the start of
   *   the content -- and `main` is the start. Landing on the heading instead
   *   skips whatever sits before it inside the content, which on the showroom
   *   is its entire sidebar, search field included: the skip link took you
   *   PAST the thing you were skipping to.
   *
   * With `main` as the target, the catalogue's search is three presses from
   * the top of the document -- Tab, Enter, Tab, Tab -- which is the number the
   * comanda asks for and which the provisional header could not reach.
   */
  protected onSkip(event: Event): void {
    event.preventDefault();
    this.main()?.nativeElement.focus();
  }

  protected onNavItemSelect(item: NavItem): void {
    if (item.route !== undefined) {
      void this.router.navigateByUrl(item.route);
    }
  }

  protected onFavoriteSelect(favorite: Favorite): void {
    void this.router.navigateByUrl(favorite.route);
  }

  protected onTabSelect(tab: Tab): void {
    void this.router.navigateByUrl(tab.id);
  }

  /** Closing a tab navigates to the neighbour; closing the last goes home. */
  protected onTabClose(tab: Tab): void {
    const next = this.tabsService.close(tab.id);
    void this.router.navigateByUrl(next ?? '/');
  }

  protected onCrumbSelect(crumb: Crumb): void {
    if (crumb.route !== undefined) {
      void this.router.navigateByUrl(crumb.route);
    }
  }

  protected onRailExpandedChange(expanded: boolean): void {
    this.railExpanded.set(expanded);
  }

  /** The star of the page showing, for the header. */
  protected favoritesCount(): number {
    return this.favorites.count();
  }

  /**
   * THE FOCUS GOES TO THE PAGE'S `h1`, or to `main` when the page has none.
   *
   * `queueMicrotask` because the outlet has not drawn the new component at the
   * moment the navigation ends: focusing here would land on the OLD heading,
   * which is worse than not moving at all.
   */
  private focusPage(): void {
    queueMicrotask(() => {
      const region = this.main()?.nativeElement;
      const heading = region?.querySelector<HTMLElement>('[data-page-heading], h1');
      const target = heading ?? region;
      if (target === undefined || target === null) {
        return;
      }
      /*
       * AN `h1` IS NOT FOCUSABLE UNLESS SOMEBODY MAKES IT SO, and setting the
       * attribute here rather than on twenty-five pages is the point: a page
       * that forgot it would silently drop the focus of everyone arriving.
       * `-1` keeps it out of the Tab order, so nothing else changes.
       */
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus();
    });
  }

  private toNavItem(entry: MenuEntry): NavItem {
    const base = {
      id: entry.id,
      label: this.transloco.translate(entry.labelKey),
      icon: entry.icon,
    };
    // Spread rather than `route: undefined`: with `exactOptionalPropertyTypes`
    // an absent optional and a present `undefined` are not the same type, and
    // the distinction is what keeps "a group has no route" honest.
    return {
      ...base,
      ...(entry.route === undefined ? {} : { route: entry.route }),
      ...(entry.children === undefined
        ? {}
        : { children: entry.children.map((child) => this.toNavItem(child)) }),
    };
  }

  /**
   * What the breadcrumbs' fold is called, with the count folded in.
   *
   * An arrow function held as a field, not built in the template: a new
   * closure on every change detection would make the input look changed every
   * time and redraw the trail for nothing.
   */
  protected readonly expandCrumbsLabel = (hidden: number): string =>
    this.transloco.translate('shell.breadcrumbs.expand', { hidden });

  /** The header's search field, focused by the `/` shortcut. */
  protected focusSearch(): void {
    this.searchField()?.nativeElement.focus();
  }
}
