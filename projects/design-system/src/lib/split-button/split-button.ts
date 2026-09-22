import type { OverlayRef } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import type { IconName } from '../../icons/icons.generated';
import { Button } from '../button/button';
import type { ButtonSize } from '../button/button.types';
import { Icon } from '../icon/icon';
import {
  createMenuOverlay,
  MENU_CLASSES,
  MENU_ICON_SLOT_CLASSES,
  MENU_POSITIONS,
  menuItemClasses,
  moveMenuIndex,
} from '../menu/menu';
import type { MenuItem } from '../menu/menu.types';
import {
  EWMS_SPLIT_BUTTON_MESSAGES,
  SPLIT_MAIN_CLASSES,
  SPLIT_TRIGGER_CLASSES,
  type SplitAction,
} from './split-button.types';

export type { SplitAction, SplitButtonMessages } from './split-button.types';

let nextSplitButtonId = 0;

/**
 * Acción principal y menú de alternativas (APG *menu button*). El menú es el de la fila de la
 * Tabla (`lib/menu/`): mismo overlay, mismo teclado. Ver vault: Split-Button.
 */
@Component({
  selector: 'ewms-split-button',
  templateUrl: './split-button.html',
  imports: [Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class SplitButton implements OnDestroy {
  /** Texto de la acción principal, ya traducido. */
  readonly label = input.required<string>();
  readonly icon = input<IconName | null>(null);
  readonly actions = input<readonly SplitAction[]>([]);
  /** La escala del Botón; `sm` en la barra de la Tabla, junto a sus otros botones. */
  readonly size = input<ButtonSize>('md');

  /** La acción principal. */
  readonly primary = output<void>();
  /** El `id` de la alternativa elegida en el menú. */
  readonly action = output<string>();

  protected readonly words = inject(EWMS_SPLIT_BUTTON_MESSAGES);

  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly menuTemplate = viewChild.required<TemplateRef<unknown>>('menu');

  private overlayRef: OverlayRef | null = null;

  protected readonly menuId = `ewms-split-button-${++nextSplitButtonId}-menu`;
  protected readonly menuClasses = MENU_CLASSES;
  protected readonly iconSlotClasses = MENU_ICON_SLOT_CLASSES;
  protected readonly mainClasses = SPLIT_MAIN_CLASSES;
  protected readonly triggerClasses = SPLIT_TRIGGER_CLASSES;
  protected readonly isOpen = signal(false);
  protected readonly activeIndex = signal(-1);

  protected readonly activeId = computed(() =>
    this.isOpen() && this.activeIndex() >= 0 ? this.itemId(this.activeIndex()) : null,
  );

  ngOnDestroy(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  protected itemId(index: number): string {
    return `${this.menuId}-item-${index}`;
  }

  protected itemClasses(item: SplitAction, index: number): string {
    return menuItemClasses(item as MenuItem, index === this.activeIndex());
  }

  protected toggle(): void {
    if (this.isOpen()) {
      this.close(true);
    } else {
      this.open(1);
    }
  }

  /** `from` 1 abre en la primera habilitada; -1, en la última (APG). */
  private open(from: 1 | -1): void {
    if (this.actions().length === 0) {
      return;
    }
    this.overlayRef = createMenuOverlay(
      this.injector,
      this.host.nativeElement,
      this.viewContainerRef,
      this.menuTemplate(),
      MENU_POSITIONS,
    );
    // El clic en la flecha también es «afuera»: cerrar ahí haría que el toggle lo reabriera.
    this.overlayRef.outsidePointerEvents().subscribe((event) => {
      if (!this.trigger()?.contains(event.target as Node)) {
        this.close(false);
      }
    });
    this.activeIndex.set(moveMenuIndex(this.actions() as readonly MenuItem[], -1, from));
    this.isOpen.set(true);
    // El foco entra a la lista, que marca la activa con `aria-activedescendant`.
    queueMicrotask(() =>
      this.host.nativeElement.ownerDocument.getElementById(this.menuId)?.focus(),
    );
  }

  /** Por teclado el foco vuelve al disparador; un clic afuera lo deja donde cayó. */
  private close(restoreFocus: boolean): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.isOpen.set(false);
    this.activeIndex.set(-1);
    if (restoreFocus) {
      this.trigger()?.focus();
    }
  }

  private trigger(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('[data-split-trigger] button');
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.isOpen()) {
        this.open(event.key === 'ArrowDown' ? 1 : -1);
      }
    }
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const items = this.actions() as readonly MenuItem[];
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(
          moveMenuIndex(items, this.activeIndex(), event.key === 'ArrowDown' ? 1 : -1),
        );
        return;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const item = this.actions()[this.activeIndex()];
        if (item) {
          this.choose(item);
        }
        return;
      }
      case 'Escape':
        event.preventDefault();
        this.close(true);
        return;
      case 'Tab':
        this.close(false);
        return;
      default:
        return;
    }
  }

  protected choose(item: SplitAction): void {
    if (item.disabled) {
      return;
    }
    this.close(true);
    this.action.emit(item.id);
  }

  protected onItemEnter(index: number): void {
    if (!this.actions()[index]?.disabled) {
      this.activeIndex.set(index);
    }
  }
}
