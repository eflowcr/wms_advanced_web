import { FocusTrapFactory, type FocusTrap } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Icon } from '../icon/icon';
import { Tooltip } from '../tooltip/tooltip';
import { isGroup, parentOf, visibleItems, type NavItem } from './navigation.types';

let nextRailId = 0;

/**
 * Abierta: fila de 40 con ícono y texto. Con los 10 px del árbol el ícono cae en 36, el centro del
 * rail plegado y de la hamburguesa de la cabecera: no salta al abrir.
 */
const OPEN_ROW_CLASSES = 'h-(--nav-row-height) items-center gap-4 pr-2';

/**
 * Plegada: fila de 64 de alto con el ícono sobre la etiqueta corta, la mini guía de YouTube. Sin
 * relleno lateral: a 12 px «Dashboard» mide 67 y «Catalogues» 68. Van sueltas sobre el navy, bajo el
 * indicador del ícono: dentro de la píldora quedaban pegadas a sus bordes (2026-09-25).
 */
const FOLDED_ROW_CLASSES =
  'h-(--nav-row-height-collapsed) flex-col items-center justify-center gap-1 text-caption';

/**
 * Sobre el degradado navy, el activo es una píldora surface con texto primario (decisión del
 * usuario, 2026-09-25, opción A). Por estado y no con variantes `aria-*`: utilidades que la hoja ya
 * tenía, y cada variante nueva suma a la hoja inicial.
 */
const ACTIVE_ROW_CLASSES = 'bg-surface text-primary';

/**
 * El destino principal, abierto (decisión del usuario, 2026-09-25): centrado y aparte del árbol; en
 * reposo con borde, para leerse como botón y no como una fila más. Sigue siendo un `treeitem`.
 */
const MAIN_ROW_CLASSES = 'mb-2 h-(--nav-row-height) items-center justify-center gap-4 px-4';
const MAIN_ACTIVE_CLASSES = 'bg-surface text-h4 text-primary';
const MAIN_REST_CLASSES = 'border border-strong text-p hover:bg-primary-hover';

/**
 * El cajón: fijo bajo la cabecera, encima del contenido y de su velo, y entra deslizándose (sin
 * movimiento con `prefers-reduced-motion`).
 */
const DRAWER_CLASSES =
  'fixed bottom-0 left-0 top-(--shell-header-height) z-10 w-(--nav-panel-width) rounded-tr-nav shadow-lg ' +
  '[transition:var(--transition-nav-drawer)] motion-safe:starting:[translate:-100%]';

/**
 * Árbol de navegación: no conoce router, menú real ni permisos. Rail o panel por token; plegado,
 * ícono sobre etiqueta corta y tooltip. En pantalla media, abierto es un cajón con velo que atrapa
 * el foco. Teclado treeview de las APG. Ver vault: Navegacion.
 */
@Component({
  selector: 'ewms-nav-rail',
  templateUrl: './nav-rail.html',
  imports: [Icon, NgTemplateOutlet, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Escape en el host, como en la barra inferior: el cajón es un contenedor no enfocable.
  host: { class: 'flex', '[class]': 'hostClasses()', '(keydown)': 'onDrawerKeydown($event)' },
})
export class NavRail {
  readonly items = input.required<readonly NavItem[]>();

  /** Obligatorio: dos `<nav>` sin nombre son indistinguibles para un lector de pantalla. */
  readonly label = input.required<string>();

  /** Null mientras nada coincide. */
  readonly activeId = input<string | null>(null);

  /** Rail plegado (72) o panel abierto (240). */
  readonly expanded = input<boolean>(true);

  /** Un grupo nunca emite: se abre. */
  readonly itemSelect = output<NavItem>();

  readonly expandedChange = output<boolean>();

  /**
   * Con nombre, el rail dibuja al pie su botón de ancho (el catálogo, sin cabecera). Vacía no hay
   * botón: en la app el único conmutador es la hamburguesa de la cabecera.
   */
  readonly toggleLabel = input<string>('');

  /**
   * Pantalla media (entre la barra inferior y el corte del cajón): abierto, el panel se superpone
   * al contenido con velo; plegado sigue en el flujo. Escape y el velo piden cerrarlo.
   */
  readonly drawer = input<boolean>(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  private readonly focusTraps = inject(FocusTrapFactory);
  private readonly injector = inject(Injector);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  private trap: FocusTrap | null = null;
  /** A quién devolver el foco al cerrar el cajón: la hamburguesa que lo abrió. Se recuerda. */
  private opener: HTMLElement | null = null;

  protected readonly drawerOpen = computed(() => this.drawer() && this.expanded());

  /** Con el panel fuera del flujo, el host guarda la columna del rail plegado. */
  protected readonly hostClasses = computed(() => (this.drawer() ? 'w-(--nav-rail-width)' : ''));

  protected readonly panelClasses = computed(() => {
    if (this.drawerOpen()) {
      return DRAWER_CLASSES;
    }
    // `relative`: el bloque que contiene el fondo decorativo.
    return this.expanded()
      ? 'relative h-full w-(--nav-panel-width) rounded-tr-nav'
      : 'relative h-full w-(--nav-rail-width)';
  });

  protected readonly treeId = `ewms-nav-rail-${++nextRailId}`;

  /** No controlado: el rail es dueño de su apertura. */
  private readonly open = signal<ReadonlySet<string>>(new Set());

  /** Tabindex móvil de las APG. */
  private readonly focusedId = signal<string | null>(null);

  protected readonly visible = computed(() => visibleItems(this.items(), this.open()));

  // El grupo del item activo se abre acá: si no, el rail no mostraría la página donde estás.
  constructor() {
    effect(() => {
      const active = this.activeId();
      if (active === null) {
        return;
      }
      const parent = parentOf(this.items(), active);
      if (parent !== null && !this.open().has(parent.id)) {
        this.open.update((current) => new Set(current).add(parent.id));
      }
    });

    // Abrir el cajón atrapa el foco; cerrarlo, por la vía que sea, lo devuelve.
    effect(() => {
      const open = this.drawerOpen();
      untracked(() => (open ? this.trapFocus() : this.releaseFocus()));
    });
    inject(DestroyRef).onDestroy(() => this.trap?.destroy());
  }

  /** Exactamente un item con `tabindex="0"`. */
  protected readonly focusTarget = computed(() => {
    const focused = this.focusedId();
    const visible = this.visible();
    if (focused !== null && visible.some((item) => item.id === focused)) {
      return focused;
    }
    const active = this.activeId();
    if (active !== null && visible.some((item) => item.id === active)) {
      return active;
    }
    return visible[0]?.id ?? null;
  });

  protected isGroup(item: NavItem): boolean {
    return isGroup(item);
  }

  protected isOpen(item: NavItem): boolean {
    return this.open().has(item.id);
  }

  protected onToggleWidth(): void {
    this.expandedChange.emit(!this.expanded());
  }

  protected rowClasses(item: NavItem, child: boolean): string {
    const current = this.isCurrent(item);
    const tone = current ? ACTIVE_ROW_CLASSES : 'hover:bg-primary-hover';
    if (!this.expanded()) {
      // Plegado, lo activo va en el indicador del ícono; la fila solo lleva el hover.
      const folded = item.main ? `${FOLDED_ROW_CLASSES} mb-2` : FOLDED_ROW_CLASSES;
      return current ? folded : `${folded} ${tone}`;
    }
    if (item.main) {
      return `${MAIN_ROW_CLASSES} ${current ? MAIN_ACTIVE_CLASSES : MAIN_REST_CLASSES}`;
    }
    // Abierta, el activo va en semibold.
    return `${OPEN_ROW_CLASSES} ${child ? 'pl-10' : 'pl-4'} ${current ? 'text-h4' : 'text-p'} ${tone}`;
  }

  /** Plegado: la píldora activa rodea solo el ícono, como el indicador de un navigation rail. */
  protected indicatorClasses(item: NavItem): string {
    return this.isCurrent(item) ? ACTIVE_ROW_CLASSES : '';
  }

  /** La página donde estás; un grupo nunca lo es. */
  protected isCurrent(item: NavItem): boolean {
    return this.activeId() === item.id && !isGroup(item);
  }

  /** Velo o Escape: se pide cerrar, no se cierra solo (el ancho es del consumidor). */
  protected close(): void {
    this.expandedChange.emit(false);
  }

  protected onDrawerKeydown(event: KeyboardEvent): void {
    if (this.drawerOpen() && event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  // `afterNextRender`: sin zonas el panel todavía no es fijo al correr el efecto (como en la hoja).
  private trapFocus(): void {
    const active = this.document.activeElement;
    this.opener = active instanceof HTMLElement ? active : null;
    afterNextRender(
      () => {
        // Cerrado antes del pintado: no queda una trampa colgando.
        if (!this.drawerOpen()) {
          return;
        }
        this.trap = this.focusTraps.create(this.panel().nativeElement);
        void this.trap.focusFirstTabbableElementWhenReady();
      },
      { injector: this.injector },
    );
  }

  private releaseFocus(): void {
    if (this.trap === null) {
      return;
    }
    this.trap.destroy();
    this.trap = null;
    if (this.opener?.isConnected) {
      this.opener.focus();
    }
    this.opener = null;
  }

  protected onActivate(item: NavItem): void {
    this.focusedId.set(item.id);
    if (isGroup(item)) {
      this.toggle(item);
      return;
    }
    this.itemSelect.emit(item);
  }

  // `Enter` y `Space` no se atienden: cada fila es un `<button>` y el navegador ya hace el clic.
  protected onKeydown(event: KeyboardEvent, item: NavItem): void {
    const visible = this.visible();
    const index = visible.findIndex((candidate) => candidate.id === item.id);

    switch (event.key) {
      case 'ArrowDown':
        this.moveTo(visible[index + 1]);
        break;
      case 'ArrowUp':
        this.moveTo(visible[index - 1]);
        break;
      case 'Home':
        this.moveTo(visible[0]);
        break;
      case 'End':
        this.moveTo(visible[visible.length - 1]);
        break;
      case 'ArrowRight':
        if (isGroup(item) && !this.isOpen(item)) {
          this.toggle(item);
        } else if (isGroup(item)) {
          // Ya abierto: entrar, como piden las APG.
          this.moveTo(visible[index + 1]);
        }
        break;
      case 'ArrowLeft':
        if (isGroup(item) && this.isOpen(item)) {
          this.toggle(item);
        } else {
          // Un hijo sube a su grupo; una hoja de primer nivel no tiene adónde.
          const parent = parentOf(this.items(), item.id);
          if (parent !== null) {
            this.moveTo(parent);
          }
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  private toggle(group: NavItem): void {
    this.open.update((current) => {
      const next = new Set(current);
      if (!next.delete(group.id)) {
        next.add(group.id);
      }
      return next;
    });
  }

  // Consulta al DOM: el elemento existe solo después de que el `@for` lo dibuja.
  private moveTo(item: NavItem | undefined): void {
    if (item === undefined) {
      return;
    }
    this.focusedId.set(item.id);
    const selector = `[data-nav-item="${CSS.escape(item.id)}"]`;
    this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}
