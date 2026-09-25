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
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { SessionContext } from '@ewms/core';
import { catalogKeyFor } from '@ewms/showroom';
import {
  Breadcrumbs,
  Favorites,
  FavoriteToggle,
  FavoritesNav,
  Button,
  KeyboardShortcuts,
  NavBottom,
  NavRail,
  SearchBox,
  ShortcutsHost,
  Tabs,
  ToastOutlet,
  ToastService,
  Viewport,
  isSingleCharacter,
  type Crumb,
  type Favorite,
  type NavItem,
  type Tab,
} from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { BRAND_NAME } from '../brand';
import { provideEwmsDesignSystem } from '../design-system.providers';
import { LanguageSwitcher } from './language-switcher';
import { MENU, MENU_DESTINATIONS, menuEntryFor, type MenuEntry } from './menu';
import { MAX_OPEN_TABS, TabsService } from './tabs.service';

/**
 * El App Shell (DS-5): header, navegación y pestañas. Es del shell y no del design
 * system porque conoce router y menú. Un solo host de teclado y un solo toast outlet
 * (lo verifica `lint:shortcuts`). Ver vault: 08-Sistema-de-Diseno/Componentes/App-Shell.
 */
@Component({
  imports: [
    Breadcrumbs,
    FavoriteToggle,
    FavoritesNav,
    Button,
    LanguageSwitcher,
    NavBottom,
    NavRail,
    RouterLink,
    RouterOutlet,
    SearchBox,
    ShortcutsHost,
    Tabs,
    ToastOutlet,
    TranslocoPipe,
  ],
  selector: 'app-main-layout',
  templateUrl: './main-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Acá y no en `appConfig`: importar el barril del design system desde lo eager lo
  // metía entero en el bundle inicial. Este layout es lazy y envuelve toda ruta,
  // así que sigue siendo una sola vez para toda la aplicación.
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
  private readonly searchField = viewChild<SearchBox>('headerSearch');

  /** La pista sale del mapa y se apaga con los atajos de un carácter (WCAG 2.2 2.1.4). */
  protected readonly searchShortcut = computed(() => {
    const binding = this.shortcuts.bindings()?.search;
    if (binding === undefined) {
      return '';
    }
    const off = isSingleCharacter(binding) && !this.shortcuts.singleKeyShortcuts();
    return off ? '' : binding.chord.join('+');
  });

  /** Rail colapsado o panel expandido; solo en memoria. */
  protected readonly railExpanded = signal(true);

  /** Lo que anuncia la región viva tras un cambio de ruta. */
  protected readonly routeAnnouncement = signal('');

  /** `null` hasta la primera carga, que no mueve el foco. */
  private previousUrl: string | null = null;

  /** Leída por cada etiqueta de abajo para redibujarse al cambiar de idioma. */
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** `startWith` porque la primera navegación ya terminó al construirse. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** menu.ts guarda claves; leer `activeLang()` redibuja el menú sin recargar. */
  protected readonly navItems = computed<readonly NavItem[]>(() => {
    this.activeLang();
    return MENU.map((entry) => this.toNavItem(entry));
  });

  protected readonly activeId = computed(() => menuEntryFor(this.url())?.id ?? null);

  protected readonly tabs = computed<readonly Tab[]>(() => this.tabsService.tabs());
  protected readonly activeTabId = computed(() => this.tabsService.activeRoute());

  /**
   * Inicio › grupo › pantalla. Se arma acá porque la miga es un hecho del menú;
   * una pantalla con miga más profunda lo extiende en DS-6.
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

  /** El favorito es solo la ruta; su nombre lo resuelve `EWMS_FAVORITE_LABELS` al dibujar. */
  protected readonly pageRoute = computed(() => this.url().split('?')[0] ?? '/');

  /** Nombre de la página, para su pestaña y para el anuncio. */
  private readonly pageTitle = computed(() => {
    this.activeLang();
    const key = this.titleKeyFor(this.url());
    return key === null ? this.brandName : this.transloco.translate(key);
  });

  constructor() {
    // Cambio de ruta: abrir la pestaña, mover el foco y anunciar el título, en un
    // solo efecto para que ninguno se olvide. En una SPA el navegador no hace ninguno.
    effect(() => {
      const url = this.url();
      const title = this.pageTitle();

      // `untracked` es obligatorio: `activate` lee y escribe `active`/`open`, y sin
      // él el efecto se relanza a sí mismo en un bucle síncrono que cuelga la
      // pestaña antes del primer pintado. Las pruebas unitarias no lo ven.
      untracked(() => {
        const opened = this.tabsService.activate(url, title, url !== '/');
        if (!opened) {
          this.toasts.show(
            'warning',
            this.transloco.translate('shell.tabs.limit', { max: MAX_OPEN_TABS }),
          );
        } else {
          // Una pestaña ya abierta sigue al idioma actual.
          this.tabsService.relabel(url, title);
        }

        // Solo al navegar: en la primera carga Chrome pinta el `h1` como `:focus-visible`
        // porque aún no hubo puntero, y un cambio de idioma no es una navegación.
        if (this.previousUrl !== null && this.previousUrl !== url) {
          this.focusPage();
        }
        this.previousUrl = url;
        this.routeAnnouncement.set(title);
      });
    });

    // Un cambio de idioma reetiqueta todas las pestañas abiertas, no solo la activa:
    // una tira en dos idiomas es la pantalla a medio traducir que evita el ADR 0008.
    // Solo el shell puede: es dueño del menú, que sabe cómo se llama cada ruta.
    effect(() => {
      this.activeLang();
      untracked(() => {
        for (const tab of this.tabsService.tabs()) {
          const key = this.titleKeyFor(tab.route);
          if (key !== null) {
            this.tabsService.relabel(tab.route, this.transloco.translate(key));
          }
        }
      });
    });

    // `/` va al buscador del header solo si ninguna pantalla lo reclamó. El shell
    // no registra `search` (el motor lanza ante un doble registro y, sin zonas, no
    // hay momento para soltarlo): contesta solo los eventos `unregistered`.
    // Ver vault: 08-Sistema-de-Diseno/Componentes/App-Shell.
    this.shortcuts.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.action === 'search' && event.outcome === 'unregistered') {
        this.focusSearch();
      }
    });
  }

  /**
   * El skip link va a `main`, no al `h1`: al `h1` se saltaba el sidebar del showroom
   * con su buscador. Así el buscador queda a tres pulsaciones. Ver vault: App-Shell.
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

  /** Cerrar navega a la vecina; cerrar la última va al inicio. */
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

  protected favoritesCount(): number {
    return this.favorites.count();
  }

  /**
   * Foco al `h1` de la página, o a `main` si no tiene. `queueMicrotask` porque al
   * terminar la navegación el outlet todavía muestra el encabezado viejo.
   */
  private focusPage(): void {
    queueMicrotask(() => {
      const region = this.main()?.nativeElement;
      const heading = region?.querySelector<HTMLElement>('[data-page-heading], h1');
      const target = heading ?? region;
      if (target === undefined || target === null) {
        return;
      }
      // Un `h1` no es focalizable: se le pone acá y no en veinticinco páginas, que
      // podrían olvidarlo. `-1` lo deja fuera del orden de Tab.
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
    // Spread y no `route: undefined`: con `exactOptionalPropertyTypes` no son el
    // mismo tipo, y esa diferencia sostiene que un grupo no tiene ruta.
    return {
      ...base,
      ...(entry.route === undefined ? {} : { route: entry.route }),
      ...(entry.children === undefined
        ? {}
        : { children: entry.children.map((child) => this.toNavItem(child)) }),
    };
  }

  /** Campo y no closure en la plantilla: uno nuevo por detección redibujaría las migas. */
  protected readonly expandCrumbsLabel = (hidden: number): string =>
    this.transloco.translate('shell.breadcrumbs.expand', { hidden });

  /**
   * La clave del nombre de una ruta: la página del catálogo por su nombre (el menú solo diría
   * «Sistema de diseño» para todas), o su destino del menú.
   */
  private titleKeyFor(route: string): string | null {
    return catalogKeyFor(route) ?? menuEntryFor(route)?.labelKey ?? null;
  }

  /** Destino del atajo `/`: el campo real, no el host, que no es enfocable. */
  protected focusSearch(): void {
    this.searchField()?.focus();
  }
}
