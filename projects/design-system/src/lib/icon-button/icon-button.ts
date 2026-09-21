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
 * Un botón cuyo único contenido visible es un icono. NO es una variante de
 * `ewms-button`, y la razón son los tipos: en un solo componente `label` tendría
 * que ser opcional y nada impediría un botón de icono sin nombre accesible, que
 * compila. Separados, `label` es obligatoria en el tipo y eso no compila.
 * Comparten implementación (button.types.ts): dos APIs públicas, un estilo.
 * La variante por defecto es `ghost` y no `primary`: vive en filas y barras.
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

  /** Obligatoria sin excepción: sin texto no hay nombre accesible, y un valor por
   * defecto vaciaría la garantía. Llega ya traducida (ADR 0008). */
  readonly label = input.required<string>();

  /**
   * Obligatorio también, y NO derivado de `label`: casi siempre dicen lo mismo,
   * pero generarlo cerraría el caso en que deben diferir -«Eliminar» contra
   * «Eliminar (no se puede deshacer)»-.
   */
  readonly tooltip = input.required<string>();

  readonly variant = input<ButtonVariant>('ghost');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);

  /**
   * Si lo que abre está abierto, y qué abre. ENTRADAS Y NO ATRIBUTOS EN LA
   * ETIQUETA: un `aria-expanded` escrito sobre `<ewms-icon-button>` cae en el
   * elemento personalizado, que no tiene rol y no es lo que se pulsa.
   */
  readonly expanded = input<boolean | null>(null);
  readonly controlsId = input<string | null>(null);

  /**
   * Si este botón es de DOS ESTADOS, y en cuál está. Entrada y no atributo, por lo
   * mismo que `expanded`. `null` por defecto, así un botón de icono común no lleva
   * `aria-pressed`: uno que siempre anuncia «no pulsado» es uno que un lector de
   * pantalla describe como conmutador sin serlo.
   */
  readonly pressed = input<boolean | null>(null);

  protected readonly baseClasses = BUTTON_BASE_CLASSES;

  protected readonly iconSize = computed(() => BUTTON_ICON_SIZES[this.size()]);

  /** Cuadrado. El icono usa el mapeo del Botón y no uno propio más grande: los dos
   * conviven en la misma barra, y dos tamaños en una fila se leen como un error. */
  protected readonly boxClass = computed(() => ICON_BUTTON_SIZE_CLASSES[this.size()]);

  protected readonly variantClasses = computed(() =>
    buttonVariantClasses(this.variant(), this.disabled()),
  );

  protected readonly spinnerColor = computed(() => buttonSpinnerColor(this.variant()));

  /** Como el Botón: `aria-disabled` marca la carga solo mientras falta el atributo
   * nativo, para que el estado no se anuncie dos veces. */
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
