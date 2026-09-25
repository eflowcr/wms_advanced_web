import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Icon } from '../icon/icon';
import { Tooltip } from '../tooltip/tooltip';
import { isGroup, parentOf, visibleItems, type NavItem } from './navigation.types';

let nextRailId = 0;

/**
 * Árbol de navegación: no conoce router, menú real ni permisos. Rail o panel por token; plegado,
 * cada icono lleva tooltip. Teclado treeview de las APG. Ver vault: Navegacion.
 */
@Component({
  selector: 'ewms-nav-rail',
  templateUrl: './nav-rail.html',
  imports: [Icon, NgTemplateOutlet, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex' },
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

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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
