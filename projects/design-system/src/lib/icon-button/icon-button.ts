import { ChangeDetectionStrategy, Component, computed, HostListener, input } from '@angular/core';
import type { IconName } from '../../icons/icons.generated';
import {
  BUTTON_BASE_CLASSES,
  BUTTON_ICON_SIZES,
  buttonSpinnerColor,
  buttonVariantClasses,
  ICON_BUTTON_SIZE_CLASSES,
  isInteractionBlocked,
  suppressEvent,
  type ButtonSize,
  type ButtonVariant,
} from '../button/button.types';
import { Icon } from '../icon/icon';
import { Tooltip } from '../tooltip/tooltip';

/**
 * Aparte de `ewms-button` para que `label` sea obligatoria en el tipo; comparten estilo
 * (button.types.ts). Por defecto `ghost`, porque vive en filas y barras.
 */
@Component({
  selector: 'ewms-icon-button',
  templateUrl: './icon-button.html',
  imports: [Icon, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class IconButton {
  readonly icon = input.required<IconName>();

  /** Sin valor por defecto, que vaciaría la garantía de nombre accesible. Traducida (ADR 0008). */
  readonly label = input.required<string>();

  /** No derivado de `label`: a veces difieren («Eliminar» y «Eliminar (no se puede deshacer)»). */
  readonly tooltip = input.required<string>();

  readonly variant = input<ButtonVariant>('ghost');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);

  /** Entradas, no atributos: sobre `<ewms-icon-button>` caerían en un elemento sin rol. */
  readonly expanded = input<boolean | null>(null);
  readonly controlsId = input<string | null>(null);

  /** Null por defecto: con `false` fijo, un lector lo describiría como conmutador sin serlo. */
  readonly pressed = input<boolean | null>(null);

  protected readonly baseClasses = BUTTON_BASE_CLASSES;

  protected readonly iconSize = computed(() => BUTTON_ICON_SIZES[this.size()]);

  /** Icono con el mapeo del Botón: conviven en la misma barra. */
  protected readonly boxClass = computed(() => ICON_BUTTON_SIZE_CLASSES[this.size()]);

  protected readonly variantClasses = computed(() =>
    buttonVariantClasses(this.variant(), this.disabled()),
  );

  protected readonly spinnerColor = computed(() => buttonSpinnerColor(this.variant()));

  /** Como el Botón: solo mientras falta el atributo nativo, para no anunciarlo dos veces. */
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
