import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  input,
  isDevMode,
  type OnInit,
} from '@angular/core';
import type { IconName } from '../../icons/icons.generated';
import { Icon } from '../icon/icon';
import { Tooltip } from '../tooltip/tooltip';
import {
  BUTTON_BASE_CLASSES,
  BUTTON_FONT_SIZES,
  BUTTON_HEIGHT_CLASSES,
  BUTTON_ICON_SIZES,
  BUTTON_PADDING_CLASSES,
  buttonSpinnerColor,
  buttonVariantClasses,
  ICON_ONLY_BOX_CLASSES,
  isInteractionBlocked,
  suppressEvent,
  type ButtonIconPosition,
  type ButtonSize,
  type ButtonVariant,
} from './button.types';

export type { ButtonIconPosition, ButtonSize, ButtonVariant } from './button.types';

let nextButtonId = 0;

/** Cargando conserva foco y nombre y suprime eventos. Solo ícono: caja cuadrada y `label`. */
@Component({
  selector: 'ewms-button',
  templateUrl: './button.html',
  imports: [Icon, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class Button implements OnInit {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly icon = input<IconName | null>(null);
  readonly iconPosition = input<ButtonIconPosition>('left');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);

  /** Sin texto visible: `label` pasa a ser el nombre accesible y el tooltip. */
  readonly iconOnly = input<boolean>(false);
  /** Ya traducida (ADR 0008). Obligatoria con `iconOnly`. */
  readonly label = input<string | null>(null);

  /** `submit` habilita el envío con Enter, que necesita un botón de envío. Ver vault: Boton. */
  readonly type = input<'button' | 'submit'>('button');

  /** Entradas, no atributos: sobre `<ewms-button>` caerían en un elemento sin rol. Null = ausente. */
  readonly pressed = input<boolean | null>(null);
  readonly expanded = input<boolean | null>(null);
  readonly controls = input<string | null>(null);

  protected readonly contentId = `ewms-btn-content-${++nextButtonId}`;

  protected readonly baseClasses = BUTTON_BASE_CLASSES;

  protected readonly iconSize = computed(() => BUTTON_ICON_SIZES[this.size()]);
  protected readonly fontSize = computed(() => BUTTON_FONT_SIZES[this.size()]);

  protected readonly boxClass = computed(() =>
    this.iconOnly()
      ? ICON_ONLY_BOX_CLASSES[this.size()]
      : `${BUTTON_HEIGHT_CLASSES[this.size()]} ${BUTTON_PADDING_CLASSES[this.size()]}`,
  );

  protected readonly hasLeftIcon = computed(
    () => Boolean(this.icon()) && (this.iconOnly() || this.iconPosition() === 'left'),
  );
  protected readonly hasRightIcon = computed(
    () => Boolean(this.icon()) && !this.iconOnly() && this.iconPosition() === 'right',
  );

  protected readonly variantClasses = computed(() =>
    buttonVariantClasses(this.variant(), this.disabled()),
  );

  protected readonly spinnerColor = computed(() => buttonSpinnerColor(this.variant()));

  /** Solo mientras falta el atributo nativo, para no anunciar el estado dos veces. */
  protected readonly ariaDisabled = computed(() =>
    this.loading() && !this.disabled() ? 'true' : null,
  );

  ngOnInit(): void {
    if (isDevMode() && this.iconOnly() && !this.label()) {
      throw new Error('ewms-button: iconOnly requires a label (accessible name and tooltip).');
    }
  }

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
