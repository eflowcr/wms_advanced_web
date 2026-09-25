import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { DESIGN_SYSTEM_VERSION, FavoritesNav, Input, Select, Viewport } from '@ewms/design-system';
import type { Favorite, SelectOption } from '@ewms/design-system';
import { CATALOG, countEntries, filterCatalog, STATUS_LABELS, type CatalogEntry } from '../catalog';

/** Toda entrada con página, para el selector de pantallas angostas. */
const PAGES: readonly SelectOption[] = CATALOG.flatMap((section) => section.entries)
  .filter((entry) => entry.route !== null)
  .map((entry) => ({ label: entry.name, value: entry.route }));

/** La primera entrada de cada ruta: es la única que se marca como actual. */
const FIRST_BY_ROUTE = new Map<string, string>();
for (const entry of CATALOG.flatMap((section) => section.entries)) {
  if (entry.route !== null && !FIRST_BY_ROUTE.has(entry.route)) {
    FIRST_BY_ROUTE.set(entry.route, entry.id);
  }
}
import { provideShowroomDesignSystem } from '../showroom.providers';

/**
 * Marco propio del showroom (barra lateral, búsqueda, versión), dentro del `MainLayout` del shell.
 * Sus controles son del sistema, como los de toda pantalla (Ver vault: Showroom - Especificacion §5).
 */
@Component({
  selector: 'ewms-showroom-layout',
  templateUrl: './showroom-layout.html',
  imports: [RouterLink, RouterOutlet, FavoritesNav, Input, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Diccionarios en el componente y no en la ruta: el inyector de elemento se recorre antes que
  // el de entorno, y en la ruta perdían contra los de `MainLayout` (se vio «Select the row» en la
  // tabla). Solo palabras: proveer acá el almacén de favoritos sería una segunda lista.
  providers: [provideShowroomDesignSystem()],
})
export class ShowroomLayout {
  /** En tiempo de compilación, del package.json de la librería; nunca a mano. */
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly statusLabels = STATUS_LABELS;

  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly sidebar = viewChild<ElementRef<HTMLElement>>('sidebar');

  protected readonly wide = inject(Viewport).isWide;
  protected readonly pages = PAGES;

  protected readonly gridClasses = computed(() =>
    this.wide() ? 'grid-cols-[17rem_minmax(0,1fr)]' : 'grid-cols-1',
  );

  constructor() {
    // Fija la barra a lo que se ve: debajo del encabezado del shell, un alto de pantalla dejaba
    // las últimas entradas fuera de la vista, y su propio scroll no las alcanzaba.
    const view = this.document.defaultView;
    const fit = (): void => {
      const element = this.sidebar()?.nativeElement;
      if (element && view) {
        const top = Math.max(0, element.getBoundingClientRect().top);
        element.style.height = String(view.innerHeight - top) + 'px';
      }
    };
    afterNextRender(() => {
      fit();
      view?.addEventListener('scroll', fit, { passive: true });
      view?.addEventListener('resize', fit);
    });
    inject(DestroyRef).onDestroy(() => {
      view?.removeEventListener('scroll', fit);
      view?.removeEventListener('resize', fit);
    });
  }

  protected readonly query = signal('');

  /** El catálogo filtrado. Una sola lista: la barra lateral no se desvía del índice. */
  protected readonly sections = computed(() => filterCatalog(this.query()));
  protected readonly matches = computed(() => countEntries(this.sections()));
  protected readonly filtering = computed(() => this.query().trim().length > 0);

  // `startWith` porque la navegación que creó este layout ya terminó y no emite: sin él,
  // la primera página no tendría ruta y el bloque no marcaría nada como actual.
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** La página visible, para que el bloque la marque. */
  protected readonly activeRoute = computed(() => this.url().split(/[?#]/)[0] ?? '/design-system');

  protected isCurrent(entry: CatalogEntry): boolean {
    return entry.route === this.activeRoute() && FIRST_BY_ROUTE.get(entry.route) === entry.id;
  }

  protected go(route: unknown): void {
    if (typeof route === 'string' && route !== this.activeRoute()) {
      void this.router.navigateByUrl(route);
    }
  }

  /** El bloque no navega, emite; navega quien sabe qué es una ruta (acá, el catálogo). */
  protected onFavorite(favorite: Favorite): void {
    void this.router.navigateByUrl(favorite.route);
  }
}
