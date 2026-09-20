import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { DESIGN_SYSTEM_VERSION, FavoriteToggle, FavoritesNav } from '@ewms/design-system';
import type { Favorite } from '@ewms/design-system';
import { CATALOG, countEntries, filterCatalog, STATUS_LABELS } from '../catalog';
import { provideShowroomDesignSystem } from '../showroom.providers';

/** Where a page with no catalogue entry falls back to, so the star always works. */
const FALLBACK_LABEL = 'Sistema de diseño';

/**
 * The frame every showroom page renders inside: a fixed sidebar, a search box
 * over the catalogue, and the version of the design system on screen.
 *
 * IT IS THE SHOWROOM'S OWN LAYOUT, NOT THE SHELL'S. The shell's chrome wraps
 * this one (app.routes.ts mounts the showroom inside MainLayout) and is not
 * touched: the two answer to different people.
 *
 * NONE OF THE CHROME USES A DESIGN-SYSTEM COMPONENT. The search field is a
 * plain `<input>` and the links are plain `<a>`, built from tokens by hand. If
 * the sidebar depended on the Button, a broken Button would take away the page
 * that documents the Button -- the tool that diagnoses cannot depend on what it
 * diagnoses (Showroom spec, section 5). The tokens are the same; the components
 * are not.
 *
 * TWO EXCEPTIONS SINCE DS-5, BOTH DELIBERATE: `ewms-favorites-nav` and
 * `ewms-favorite-toggle`. They are not chrome that could be rebuilt from
 * tokens -- they ARE the feature REQ-FE-DS4-002 asks to see working, and the
 * requirement is that the block lives in a FIXED PLACE IN THE NAVIGATION
 * (RFE-04) rather than inside a page. Building a second copy for the catalogue
 * is exactly what RFE-04 forbids. If they break, what breaks is the favourites
 * page, which is the right blast radius.
 */
@Component({
  selector: 'ewms-showroom-layout',
  templateUrl: './showroom-layout.html',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, FavoritesNav, FavoriteToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /*
   * THE CATALOGUE'S OWN DICTIONARIES, ON THE COMPONENT AND NOT ON THE ROUTE.
   *
   * The shell provides its own on `MainLayout`, which this layout renders
   * inside. A component's providers live in the ELEMENT injector, and that
   * chain is walked before any environment injector -- so route-level
   * providers here lost to MainLayout's, and every showroom page quietly
   * showed the shell's strings in whatever language the application was in.
   * The table's row checkboxes reading "Select the row" in a Spanish-only
   * catalogue is how it was noticed.
   *
   * On the component they are nearer than MainLayout's and win, which is what
   * "the catalogue speaks for itself" has to mean.
   *
   * Since DS-5 this also carries the catalogue's own `Favorites`, so the
   * showroom's list is the showroom's and not the shell's.
   */
  providers: [provideShowroomDesignSystem()],
})
export class ShowroomLayout {
  /** Compile-time, from the library's package.json. Never typed in by hand. */
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly statusLabels = STATUS_LABELS;

  private readonly router = inject(Router);

  protected readonly query = signal('');

  /** The catalogue, filtered. One list, so the sidebar cannot drift from the index. */
  protected readonly sections = computed(() => filterCatalog(this.query()));
  protected readonly matches = computed(() => countEntries(this.sections()));
  protected readonly filtering = computed(() => this.query().trim().length > 0);

  /**
   * The URL, as a signal.
   *
   * `startWith` because a navigation that already finished emits nothing: the
   * layout is created BY that navigation, so without it the first page has no
   * route and the star would mark the wrong thing until you moved.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * What THIS page is, as a favourite.
   *
   * Read out of the catalogue rather than out of the URL, so the label in the
   * favourites block is the one in the sidebar. A page outside the catalogue
   * still gets a star -- it just gets the section's name.
   */
  protected readonly pageFavorite = computed<Favorite>(() => {
    const route = this.url().split('?')[0] ?? '/design-system';
    const entry = CATALOG.flatMap((section) => section.entries).find(
      (candidate) => candidate.route === route,
    );
    return { route, label: entry?.name ?? FALLBACK_LABEL };
  });

  protected readonly activeRoute = computed(() => this.pageFavorite().route);

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /**
   * A favourite chosen in the block. The BLOCK does not navigate -- it emits,
   * and the thing that knows what a route means does the navigating. Here that
   * is the catalogue; in the shell it is the shell.
   */
  protected onFavorite(favorite: Favorite): void {
    void this.router.navigateByUrl(favorite.route);
  }
}
