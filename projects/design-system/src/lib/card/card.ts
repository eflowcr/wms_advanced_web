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
 * Dos usos bajo un nombre, como los describe la ficha: dentro de un
 * `ewms-card-group` es una OPCIÓN -toma rol, posición de tabulación y flechas del
 * grupo-; en cualquier otro lado es un CONTENEDOR sin estado ni interacción.
 * CUÁL ES SALE DE DÓNDE SE ESCRIBE, NO DE UNA ENTRADA: una bandera `selectable`
 * dejaría existir una card seleccionable fuera de un grupo, o sea un `role="radio"`
 * sin `radiogroup` alrededor, que es inválido y que axe reporta.
 */
@Component({
  selector: 'ewms-card',
  templateUrl: './card.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class Card implements CardGroupMember, OnDestroy {
  /**
   * Cuánto vale esta card al ser la elegida. Sin sentido fuera de un grupo. No se
   * llama `value`: `value` es del grupo, que es a lo que se ata un formulario, y
   * dos miembros con ese nombre es cómo alguien ata el que no era.
   */
  readonly optionValue = input<unknown>(null);

  /** La entrada propia de la card. La del grupo se suma con O, nunca se resta. */
  readonly disabled = input<boolean>(false);

  /** El grupo al que pertenece, o null si es un contenedor. `self: false` porque el
   * grupo es un ancestro; `optional: true` es lo que hace legal el caso contenedor. */
  private readonly group = inject(CardGroup, { optional: true });

  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');

  protected readonly inGroup = computed(() => this.group !== null);

  /** Quien deshabilita gana: la entrada de la card, o la del grupo. */
  readonly ownDisabled = this.disabled;

  protected readonly isDisabled = computed(() =>
    this.group ? this.group.memberDisabled(this) : false,
  );

  protected readonly selected = computed(
    () => this.group !== null && this.group.selectedValue() === this.optionValue(),
  );

  /** Un solo tab stop para todo el grupo, y acá aterriza. El resto se alcanza con
   * las flechas y con nada más. */
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

  /**
   * Las flechas y la barra espaciadora, como responde un grupo de radios. `Enter`
   * falta a propósito: en un grupo de radios es del formulario -envía-, y tragarlo
   * rompería el gesto que hace rápido un formulario manejado con teclado.
   */
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
        // Espacio hace scroll por defecto, lo último que quiere quien elige una
        // opción.
        event.preventDefault();
        this.group.select(this.optionValue());
        return;
      default:
        return;
    }
  }
}
