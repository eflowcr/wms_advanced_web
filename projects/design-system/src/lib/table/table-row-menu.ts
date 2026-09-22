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
import type { FlatRow } from './tree';

interface RowMenuHost<T> {
  readonly tableId: string;
  readonly items: () => readonly MenuItem[];
  readonly template: () => TemplateRef<unknown> | undefined;
  readonly injector: Injector;
  readonly viewContainerRef: ViewContainerRef;
  readonly document: Document;
  /** Al cerrar, el foco vuelve a la fila, no al documento. */
  readonly closed: (row: FlatRow<T>) => void;
  readonly chosen: (row: FlatRow<T>, item: MenuItem) => void;
}

/**
 * El menú de fila: kebab, clic derecho, Shift+F10 y la tecla de menú. Foco en la lista y
 * `aria-activedescendant`, como el Select. Interna; salió de `table.ts` sin cambiar nada.
 */
export class TableRowMenu<T> {
  readonly row = signal<FlatRow<T> | null>(null);
  readonly index = signal(-1);
  readonly classes = MENU_CLASSES;
  readonly separatorClasses = MENU_SEPARATOR_CLASSES;
  readonly iconSlotClasses = MENU_ICON_SLOT_CLASSES;
  readonly id: string;
  readonly enabled = computed(() => this.host.items().length > 0);

  private overlay: OverlayRef | null = null;

  // Chromium/X11 manda `contextmenu` al pulsar y `auxclick` al soltar, y cerraba el menú
  // recién abierto (defecto 2a88b80). Solo un `pointerdown` nuevo lo puede cerrar.
  private gestureEnded = false;

  private readonly onPointerDown = (): void => {
    this.gestureEnded = true;
  };

  constructor(private readonly host: RowMenuHost<T>) {
    this.id = `${host.tableId}-menu`;
  }

  optionId(index: number): string {
    return `${this.id}-item-${index}`;
  }

  itemClasses(item: MenuItem, index: number): string {
    return menuItemClasses(item, index === this.index());
  }

  // Clic derecho y kebab: un trackpad no tiene clic derecho.
  open(flat: FlatRow<T>, anchor: HTMLElement): void {
    if (!this.enabled()) {
      return;
    }
    this.close();
    const template = this.host.template();
    if (!template) {
      return;
    }
    this.row.set(flat);
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

  onContextMenu(event: MouseEvent, flat: FlatRow<T>): void {
    if (!this.enabled()) {
      return;
    }
    event.preventDefault();
    this.open(flat, event.target as HTMLElement);
  }

  close(): void {
    if (!this.overlay) {
      return;
    }
    this.host.document.removeEventListener('pointerdown', this.onPointerDown, true);
    const row = this.row();
    this.overlay.dispose();
    this.overlay = null;
    this.row.set(null);
    this.index.set(-1);
    if (row) {
      this.host.closed(row);
    }
  }

  choose(item: MenuItem): void {
    const row = this.row();
    if (!row || item.disabled) {
      return;
    }
    this.close();
    this.host.chosen(row, item);
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.host.items();
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
