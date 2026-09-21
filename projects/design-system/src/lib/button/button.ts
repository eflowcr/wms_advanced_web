import { ChangeDetectionStrategy, Component, computed, HostListener, input } from '@angular/core';
import type { IconName } from '../../icons/icons.generated';
import { Icon } from '../icon/icon';
import {
  BUTTON_BASE_CLASSES,
  BUTTON_FONT_SIZES,
  BUTTON_HEIGHT_CLASSES,
  BUTTON_ICON_SIZES,
  BUTTON_PADDING_CLASSES,
  buttonSpinnerColor,
  buttonVariantClasses,
  isInteractionBlocked,
  suppressEvent,
  type ButtonIconPosition,
  type ButtonSize,
  type ButtonVariant,
} from './button.types';

export type { ButtonIconPosition, ButtonSize, ButtonVariant } from './button.types';

let nextButtonId = 0;

/**
 * El botón de acción del sistema. Estado de carga accesible -conserva foco y
 * nombre-, estilo por token y supresión estricta de eventos mientras carga o está
 * deshabilitado. La implementación visual se comparte con `ewms-icon-button` por
 * button.types.ts: dos APIs públicas, un estilo.
 */
@Component({
  selector: 'ewms-button',
  templateUrl: './button.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly icon = input<IconName | null>(null);
  readonly iconPosition = input<ButtonIconPosition>('left');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);

  /**
   * SI ESTE BOTÓN ENVÍA EL FORMULARIO EN QUE ESTÁ. Por defecto `'button'`, así que
   * nada de lo que existe cambia.
   *
   * Hasta DS-5 el Botón pintaba `type="button"` siempre, y era deliberado. También
   * tenía un costo, encontrado construyendo la pantalla de ejemplo de DS-4: UN
   * FORMULARIO SIN BOTÓN DE ENVÍO TAMPOCO SE ENVÍA CON `Enter`, porque el envío
   * implícito del navegador necesita que exista uno. Cada formulario de varios
   * campos solo se podía guardar con clic o con Ctrl+S.
   * Enviar sigue siendo algo que alguien escribe a propósito; ahora se puede
   * escribir, y el patrón anti doble envío no cambia.
   */
  readonly type = input<'button' | 'submit'>('button');

  protected readonly contentId = `ewms-btn-content-${++nextButtonId}`;

  protected readonly baseClasses = BUTTON_BASE_CLASSES;

  protected readonly iconSize = computed(() => BUTTON_ICON_SIZES[this.size()]);
  protected readonly fontSize = computed(() => BUTTON_FONT_SIZES[this.size()]);

  protected readonly heightClass = computed(() => BUTTON_HEIGHT_CLASSES[this.size()]);
  protected readonly paddingClass = computed(() => BUTTON_PADDING_CLASSES[this.size()]);

  protected readonly hasLeftIcon = computed(
    () => Boolean(this.icon()) && this.iconPosition() === 'left',
  );
  protected readonly hasRightIcon = computed(
    () => Boolean(this.icon()) && this.iconPosition() === 'right',
  );

  protected readonly variantClasses = computed(() =>
    buttonVariantClasses(this.variant(), this.disabled()),
  );

  protected readonly spinnerColor = computed(() => buttonSpinnerColor(this.variant()));

  /** `aria-disabled` marca la carga solo mientras falta el atributo nativo: con
   * `disabled` puesto el nativo ya lo dice, y los dos lo anunciarían dos veces. */
  protected readonly ariaDisabled = computed(() =>
    this.loading() && !this.disabled() ? 'true' : null,
  );

  @HostListener('click', ['$event'])
  protected onHostClick(event: MouseEvent): void {
    if (isInteractionBlocked(this.disabled(), this.loading())) {
      suppressEvent(event);
    }
  }

  protected onButtonClick(event: MouseEvent): void {
    if (isInteractionBlocked(this.disabled(), this.loading())) {
      suppressEvent(event);
    }
  }

  protected onButtonKeydown(event: KeyboardEvent): void {
    if (this.loading() && (event.key === 'Enter' || event.key === ' ')) {
      suppressEvent(event);
    }
  }
}
