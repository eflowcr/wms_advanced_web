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
 * EL ÁRBOL DE NAVEGACIÓN Y NADA MÁS: dibuja items, dice cuál es el actual, abre
 * y cierra grupos y reporta lo elegido. No conoce el router, el menú real ni los
 * permisos; eso es del shell.
 * Dos anchos, un componente: rail de iconos (`--nav-rail-width`) o panel
 * (`--nav-panel-width`). CADA ICONO LLEVA TOOLTIP CUANDO ESTÁ PLEGADO: un rail de
 * glifos sin nombre es inusable para quien no conoce el producto, y `aria-label`
 * solo sirve al lector de pantalla. El teclado es el treeview de las APG: un solo
 * Tab para todo el rail. Ficha: 08-Sistema-de-Diseno/Componentes/Navegacion.
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

  /**
   * El nombre del landmark, ya traducido. Obligatorio: una página puede tener más
   * de un `<nav>` -este y las migas- y dos sin nombre son indistinguibles en la
   * lista de landmarks de un lector de pantalla.
   */
  readonly label = input.required<string>();

  /** Qué item es la página donde estás. Null mientras nada coincide. */
  readonly activeId = input<string | null>(null);

  /** Rail plegado (72) o panel abierto (232). */
  readonly expanded = input<boolean>(true);

  /** Se eligió un destino. Un grupo nunca emite: se abre. */
  readonly itemSelect = output<NavItem>();

  /** Alguien pidió el otro ancho, desde el control del propio rail. */
  readonly expandedChange = output<boolean>();

  /** Etiqueta del control de plegar/desplegar, ya traducida. */
  readonly toggleLabel = input.required<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly treeId = `ewms-nav-rail-${++nextRailId}`;

  /** Qué grupos están abiertos. No controlado: el rail es dueño de su apertura. */
  private readonly open = signal<ReadonlySet<string>>(new Set());

  /** El único item en el orden de tabulación (tabindex móvil de las APG). */
  private readonly focusedId = signal<string | null>(null);

  protected readonly visible = computed(() => visibleItems(this.items(), this.open()));

  /**
   * EL GRUPO DEL ITEM ACTIVO SE ABRE ACÁ Y NO EN EL CONSUMIDOR: aterrizar en
   * /catalogos/articulos con «Catálogos» plegado muestra un rail que no contiene
   * la página donde estás, y hacerlo en el shell pondría estado de árbol donde el
   * árbol no está.
   */
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

  /** El item que lleva `tabindex="0"`. Exactamente uno, siempre. */
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

  /** Clic en una fila: un grupo abre, un destino se reporta. */
  protected onActivate(item: NavItem): void {
    this.focusedId.set(item.id);
    if (isGroup(item)) {
      this.toggle(item);
      return;
    }
    this.itemSelect.emit(item);
  }

  /**
   * El teclado del treeview (WAI-ARIA APG). `Enter` y `Space` no se atienden acá:
   * cada fila es un `<button>` de verdad y el navegador ya los vuelve un clic.
   */
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
          // Ya abierto: entrar, que es lo que piden las APG.
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

  /**
   * Mueve el foco móvil y el foco real con él. La consulta al DOM es el camino
   * honesto: la lista la pinta un `@for`, así que el elemento de un id existe solo
   * después de dibujarse.
   */
  private moveTo(item: NavItem | undefined): void {
    if (item === undefined) {
      return;
    }
    this.focusedId.set(item.id);
    const selector = `[data-nav-item="${CSS.escape(item.id)}"]`;
    this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}
