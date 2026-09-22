import type { OverlayRef } from '@angular/cdk/overlay';
import {
  computed,
  signal,
  type Injector,
  type TemplateRef,
  type ViewContainerRef,
} from '@angular/core';
import {
  createMenuOverlay,
  menuItemClasses,
  MENU_CLASSES,
  MENU_ICON_SLOT_CLASSES,
  MENU_POSITIONS,
  MENU_SEPARATOR_CLASSES,
  moveMenuIndex,
} from '../menu/menu';
import type { MenuItem } from './table.types';

interface MenuHost<Target> {
  /** Único en el documento: `aria-activedescendant` apunta a ids de este prefijo. */
  readonly id: string;
  readonly items: (target: Target) => readonly MenuItem[];
  /** Nombre de la lista: «Acciones de la fila», «Opciones de la columna Fecha». */
  readonly label: (target: Target) => string;
  readonly template: () => TemplateRef<unknown> | undefined;
  readonly injector: Injector;
  readonly viewContainerRef: ViewContainerRef;
  readonly document: Document;
  /** Al cerrar, el foco vuelve a quien lo abrió (la fila, la cabecera), no al documento. */
  readonly closed: (target: Target) => void;
  readonly chosen: (target: Target, item: MenuItem) => void;
}

/**
 * Un menú de la Tabla —el de fila y el de columna—: botón, clic derecho, Shift+F10 y la tecla de
 * menú. Foco en la lista y `aria-activedescendant`, como el Select. Interna.
 */
export class TableMenu<Target> {
  readonly target = signal<Target | null>(null);
  readonly index = signal(-1);
  readonly classes = MENU_CLASSES;
  readonly separatorClasses = MENU_SEPARATOR_CLASSES;
  readonly iconSlotClasses = MENU_ICON_SLOT_CLASSES;
  readonly id: string;
  /** Sin nada que ofrecer no hay botón ni se abre (el menú de fila sin `menuItems`). */
  readonly enabled: (target: Target) => boolean;
  readonly items = computed(() => {
    const target = this.target();
    return target === null ? [] : this.host.items(target);
  });
  readonly label = computed(() => {
    const target = this.target();
    return target === null ? '' : this.host.label(target);
  });

  private overlay: OverlayRef | null = null;

  // Chromium/X11 manda `contextmenu` al pulsar y `auxclick` al soltar, y cerraba el menú
  // recién abierto (defecto 2a88b80). Solo un `pointerdown` nuevo lo puede cerrar.
  private gestureEnded = false;

  private readonly onPointerDown = (): void => {
    this.gestureEnded = true;
  };

  constructor(private readonly host: MenuHost<Target>) {
    this.id = host.id;
    this.enabled = (target) => host.items(target).length > 0;
  }

  optionId(index: number): string {
    return `${this.id}-item-${index}`;
  }

  itemClasses(item: MenuItem, index: number): string {
    return menuItemClasses(item, index === this.index());
  }

  // Clic derecho y botón: un trackpad no tiene clic derecho.
  open(target: Target, anchor: HTMLElement): void {
    if (!this.enabled(target)) {
      return;
    }
    this.close();
    const template = this.host.template();
    if (!template) {
      return;
    }
    this.target.set(target);
    this.index.set(-1);
    this.overlay = createMenuOverlay(
      this.host.injector,
      anchor,
      this.host.viewContainerRef,
      template,
      MENU_POSITIONS,
    );
    this.gestureEnded = false;
    this.host.document.addEventListener('pointerdown', this.onPointerDown, true);
    this.overlay.outsidePointerEvents().subscribe(() => {
      if (this.gestureEnded) {
        this.close();
      }
    });
    queueMicrotask(() => this.host.document.querySelector<HTMLElement>(`#${this.id}`)?.focus());
  }

  onContextMenu(event: MouseEvent, target: Target): void {
    if (!this.enabled(target)) {
      return;
    }
    event.preventDefault();
    this.open(target, event.target as HTMLElement);
  }

  close(): void {
    if (!this.overlay) {
      return;
    }
    this.host.document.removeEventListener('pointerdown', this.onPointerDown, true);
    const target = this.target();
    this.overlay.dispose();
    this.overlay = null;
    this.target.set(null);
    this.index.set(-1);
    if (target !== null) {
      this.host.closed(target);
    }
  }

  choose(item: MenuItem): void {
    const target = this.target();
    if (target === null || item.disabled) {
      return;
    }
    this.close();
    this.host.chosen(target, item);
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.items();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.index.set(moveMenuIndex(items, this.index(), 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.index.set(moveMenuIndex(items, this.index(), -1));
        return;
      case 'Enter':
      case ' ': {
        const item = items[this.index()];
        if (item) {
          event.preventDefault();
          this.choose(item);
        }
        return;
      }
      case 'Escape':
        event.preventDefault();
        this.close();
    }
  }

  /** El overlay vive en el body: sin esto el menú abierto sobrevive a la tabla. */
  dispose(): void {
    this.host.document.removeEventListener('pointerdown', this.onPointerDown, true);
    this.overlay?.dispose();
    this.overlay = null;
  }
}
