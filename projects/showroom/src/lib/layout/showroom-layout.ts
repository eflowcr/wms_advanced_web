import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { DESIGN_SYSTEM_VERSION, FavoritesNav } from '@ewms/design-system';
import type { Favorite } from '@ewms/design-system';
import { countEntries, filterCatalog, STATUS_LABELS } from '../catalog';
import { provideShowroomDesignSystem } from '../showroom.providers';

/**
 * Marco propio del showroom (barra lateral, búsqueda, versión), dentro del `MainLayout` del shell.
 * Su cromo no usa componentes del DS: la herramienta que diagnostica no puede depender de lo
 * que diagnostica (Ver vault: Showroom - Especificacion §5).
 */
// Única excepción desde DS-5: `ewms-favorites-nav`, porque REQ-FE-DS4-002 RFE-04 lo quiere fijo
// en la navegación y prohíbe una segunda copia. Lee la lista de la aplicación, que provee el
// shell por inyección; la estrella también es del shell.
@Component({
  selector: 'ewms-showroom-layout',
  templateUrl: './showroom-layout.html',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, FavoritesNav],
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
  protected readonly activeRoute = computed(() => this.url().split('?')[0] ?? '/design-system');

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** El bloque no navega, emite; navega quien sabe qué es una ruta (acá, el catálogo). */
  protected onFavorite(favorite: Favorite): void {
    void this.router.navigateByUrl(favorite.route);
  }
}
