import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { Icon } from '../icon/icon';
import { CardGroup } from './card-group';
import {
  CARD_BASE_CLASSES,
  CARD_SELECTABLE_CLASSES,
  cardSelectableClasses,
  type CardGroupMember,
} from './card.types';

/**
 * Opción dentro de `ewms-card-group`, contenedor en cualquier otro lado. Lo decide dónde se
 * escribe y no una entrada: un `role="radio"` sin `radiogroup` es inválido. Ver vault: Cards.
 */
@Component({
  selector: 'ewms-card',
  templateUrl: './card.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class Card implements CardGroupMember, OnDestroy {
  /** No se llama `value`: ese es del grupo, al que se ata el formulario. */
  readonly optionValue = input<unknown>(null);

  /** La del grupo se suma con O, nunca se resta. */
  readonly disabled = input<boolean>(false);

  /** Null si es contenedor: `optional: true` hace legal ese caso. */
  private readonly group = inject(CardGroup, { optional: true });

  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');

  protected readonly inGroup = computed(() => this.group !== null);

  readonly ownDisabled = this.disabled;

  protected readonly isDisabled = computed(() =>
    this.group ? this.group.memberDisabled(this) : false,
  );

  protected readonly selected = computed(
    () => this.group !== null && this.group.selectedValue() === this.optionValue(),
  );

  /** Un solo tab stop por grupo; el resto, con flechas. */
  protected readonly tabIndex = computed<number | null>(() => {
    if (!this.group || this.isDisabled()) {
      return null;
    }
    return this.group.tabbableValue() === this.optionValue() ? 0 : -1;
  });

  protected readonly classes = computed(() => {
    if (!this.inGroup()) {
      return `${CARD_BASE_CLASSES} bg-surface border-default text-primary`;
    }
    return [
      CARD_BASE_CLASSES,
      CARD_SELECTABLE_CLASSES,
      cardSelectableClasses(this.selected(), this.isDisabled()),
    ].join(' ');
  });

  constructor() {
    this.group?.register(this);
  }

  ngOnDestroy(): void {
    this.group?.unregister(this);
  }

  focus(): void {
    this.box().nativeElement.focus();
  }

  protected onClick(): void {
    if (this.isDisabled()) {
      return;
    }
    this.group?.select(this.optionValue());
  }

  // Sin `Enter` a propósito: en un grupo de radios envía el formulario.
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.group || this.isDisabled()) {
      return;
    }
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        this.group.move(1);
        return;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        this.group.move(-1);
        return;
      case ' ':
        // Espacio hace scroll por defecto.
        event.preventDefault();
        this.group.select(this.optionValue());
        return;
      default:
        return;
    }
  }
}
