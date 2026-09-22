import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import type { FormValueControl, ValidationError } from '@angular/forms/signals';
import {
  FIELD_BASE_CLASSES,
  FIELD_FONT_SIZES,
  FIELD_HEIGHT_CLASSES,
  FIELD_ICON_SIZE,
  FIELD_PADDING_CLASSES,
  fieldBorderColor,
  fieldSurfaceClasses,
  type FieldSize,
  type FieldState,
} from '../field/field.types';
import { fieldErrorText } from '../forms/field-note';
import { Icon } from '../icon/icon';
import { Button } from '../button/button';
import {
  PREFIX_ICON_OFFSET_CLASSES,
  PREFIX_PADDING_CLASSES,
  SUFFIX_PADDING_CLASS,
  type InputType,
} from './input.types';

export type { InputType } from './input.types';

let nextInputId = 0;

/**
 * Comparte caja con `ewms-select` (field.types.ts) para que una fila se alinee sola. No valida:
 * `state="error"` es solo dibujo. Borde y anillo de foco van en el control nativo.
 */
@Component({
  selector: 'ewms-input',
  templateUrl: './input.html',
  imports: [Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class Input implements FormValueControl<string> {
  /** Con `[formField]` lo llena el formulario; fuera de uno, `[(value)]`. */
  readonly value = model<string>('');

  readonly type = input<InputType>('text');
  readonly size = input<FieldSize>('md');

  /** Un `<label for>` real: el placeholder desaparece al tipear y muchos lectores no lo anuncian. */
  readonly label = input.required<string>();

  /**
   * Etiqueta solo para la ayuda técnica (sigue atada por for/id). Para los filtros de la Tabla:
   * seis etiquetas visibles duplicarían el alto, y un `<th>` dos filas arriba no etiqueta.
   */
  readonly hideLabel = input<boolean>(false);

  readonly placeholder = input<string>('');

  readonly hint = input<string>('');

  /** Solo dibujo, para las demos del catálogo: quien valida es el formulario. */
  readonly state = input<FieldState>('default');

  // Del contrato `FormValueControl`: el `[formField]` las llena solo. Ninguna que no se lea acá.
  readonly errors = input<readonly ValidationError[]>([]);
  readonly invalid = input<boolean>(false);
  readonly touched = input<boolean>(false);
  /** Asterisco junto a la etiqueta, más el atributo nativo. */
  readonly required = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly readonly = input<boolean>(false);

  /** Nombre accesible del botón mostrar/ocultar; sin él no se pinta. Ver vault: Input. */
  readonly showPasswordLabel = input<string>('');
  readonly hidePasswordLabel = input<string>('');

  /** Igual, para el botón que vacía una búsqueda. */
  readonly clearLabel = input<string>('');

  /** Al perder el foco, nunca al ganarlo: el formulario marca «tocado» con esto. */
  readonly touch = output<void>();

  /**
   * Prefijadas: el nombre nativo choca con el evento DOM (no-output-native) y uno de los dos es
   * utilidad de Tailwind, que rompe la compuerta 10. Ver vault: Input.
   */
  readonly fieldFocus = output<void>();
  readonly fieldBlur = output<void>();

  protected readonly fieldId = `ewms-input-${++nextInputId}`;
  protected readonly hintId = `${this.fieldId}-hint`;

  protected readonly baseClasses = FIELD_BASE_CLASSES;
  protected readonly iconSize = FIELD_ICON_SIZE;

  private readonly focused = signal(false);

  private readonly passwordVisible = signal(false);

  /** Se valida al salir del campo y al enviar, nunca mientras se escribe. */
  protected readonly showError = computed(() => this.invalid() && this.touched());

  protected readonly fieldError = fieldErrorText(this.errors, this.showError);

  protected readonly effectiveState = computed<FieldState>(() => {
    if (this.disabled()) {
      return 'disabled';
    }
    // El validador que falló manda sobre `state`: el error es del formulario, no del dibujo.
    if (this.showError() || this.state() === 'error') {
      return 'error';
    }
    return this.readonly() ? 'readonly' : this.state();
  });

  /** El mensaje del validador reemplaza al hint: dos líneas debajo del campo se pisan. */
  protected readonly note = computed(() => this.fieldError() || this.hint());

  protected readonly isTextarea = computed(() => this.type() === 'textarea');
  protected readonly isSearch = computed(() => this.type() === 'search');
  protected readonly isPassword = computed(() => this.type() === 'password');

  /** Mostrar la clave es pasar `password` a `text`; `textarea` pinta otro elemento. */
  protected readonly nativeType = computed(() => {
    if (this.isPassword()) {
      return this.passwordVisible() ? 'text' : 'password';
    }
    return this.type();
  });

  protected readonly hasPrefixIcon = computed(() => this.isSearch());

  protected readonly hasPasswordToggle = computed(
    () =>
      this.isPassword() && Boolean(this.showPasswordLabel()) && Boolean(this.hidePasswordLabel()),
  );

  /** Solo con algo que borrar: sobre un campo vacío sería un control que no hace nada. */
  protected readonly hasClearButton = computed(
    () => this.isSearch() && Boolean(this.clearLabel()) && this.value().length > 0,
  );

  protected readonly hasSuffix = computed(() => this.hasPasswordToggle() || this.hasClearButton());

  /** Lo que hará la próxima pulsación. */
  protected readonly passwordToggleLabel = computed(() =>
    this.passwordVisible() ? this.hidePasswordLabel() : this.showPasswordLabel(),
  );
  protected readonly passwordToggleIcon = computed(() =>
    this.passwordVisible() ? ('eye-off' as const) : ('eye' as const),
  );

  protected readonly heightClass = computed(() => FIELD_HEIGHT_CLASSES[this.size()]);
  protected readonly fontSize = computed(() => FIELD_FONT_SIZES[this.size()]);
  protected readonly prefixIconOffsetClass = computed(
    () => PREFIX_ICON_OFFSET_CLASSES[this.size()],
  );

  /** El relleno de un lado pisa al horizontal: Tailwind lo emite después, sin importar el orden. */
  protected readonly paddingClasses = computed(() => {
    const classes = [FIELD_PADDING_CLASSES[this.size()]];
    if (this.hasPrefixIcon()) {
      classes.push(PREFIX_PADDING_CLASSES[this.size()]);
    }
    if (this.hasSuffix()) {
      classes.push(SUFFIX_PADDING_CLASS);
    }
    return classes.join(' ');
  });

  protected readonly surfaceClasses = computed(() => fieldSurfaceClasses(this.effectiveState()));

  protected readonly borderColor = computed(() =>
    fieldBorderColor(this.effectiveState(), this.focused()),
  );

  /** Los números se comparan dígito a dígito: a la derecha. */
  protected readonly alignmentClass = computed(() =>
    this.type() === 'number' ? 'text-right' : 'text-left',
  );

  protected readonly controlClasses = computed(() =>
    [
      this.baseClasses,
      this.isTextarea() ? 'py-2 min-h-20 resize-none' : this.heightClass(),
      this.paddingClasses(),
      this.surfaceClasses(),
      this.alignmentClass(),
    ].join(' '),
  );

  protected readonly isNativeDisabled = computed(() => this.effectiveState() === 'disabled');
  protected readonly isReadonly = computed(() => this.effectiveState() === 'readonly');
  protected readonly isInvalid = computed(() => this.effectiveState() === 'error');

  protected readonly describedBy = computed(() => (this.note() ? this.hintId : null));

  protected readonly hintClasses = computed(() =>
    this.isInvalid() ? 'text-danger' : 'text-secondary',
  );

  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.value.set(target.value);
  }

  protected onFocus(): void {
    this.focused.set(true);
    this.fieldFocus.emit();
  }

  /** Único lugar que marca «tocado»: antes, la validación aparecería en medio de la escritura. */
  protected onBlur(): void {
    this.focused.set(false);
    this.touch.emit();
    this.fieldBlur.emit();
  }

  /** El foco no se mueve: ya lo tiene el botón pulsado. */
  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected clear(): void {
    this.value.set('');
  }
}
