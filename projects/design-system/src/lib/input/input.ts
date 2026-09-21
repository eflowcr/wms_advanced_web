import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
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
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
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
  providers: [provideValueAccessor(() => Input)],
})
export class Input extends FormControlBase<string> {
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

  readonly state = input<FieldState>('default');

  /** Asterisco junto a la etiqueta, más el atributo nativo. */
  readonly required = input<boolean>(false);

  /** Nombre accesible del botón mostrar/ocultar; sin él no se pinta. Ver vault: Input. */
  readonly showPasswordLabel = input<string>('');
  readonly hidePasswordLabel = input<string>('');

  /** Igual, para el botón que vacía una búsqueda. */
  readonly clearLabel = input<string>('');

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

  /** Sin entrada de valor: siembra con cadena vacía y la cambia `writeValue`. */
  protected readonly valueSource = signal('');

  private readonly focused = signal(false);

  private readonly passwordVisible = signal(false);

  /** Cualquiera de las tres vías de deshabilitar alcanza, como en `FormControlBase.isDisabled`. */
  protected readonly effectiveState = computed<FieldState>(() =>
    this.isDisabled() ? 'disabled' : this.state(),
  );

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
    () => this.isSearch() && Boolean(this.clearLabel()) && this.controlValue().length > 0,
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

  protected readonly describedBy = computed(() => (this.hint() ? this.hintId : null));

  protected readonly hintClasses = computed(() =>
    this.isInvalid() ? 'text-danger' : 'text-secondary',
  );

  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.commit(target.value);
  }

  protected onFocus(): void {
    this.focused.set(true);
    this.fieldFocus.emit();
  }

  /** Único lugar que marca «tocado»: antes, la validación aparecería en medio de la escritura. */
  protected onBlur(): void {
    this.focused.set(false);
    this.markTouched();
    this.fieldBlur.emit();
  }

  /** El foco no se mueve: ya lo tiene el botón pulsado. */
  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  /** Con `commit`: una escritura suelta dejaría al formulario con el valor viejo. */
  protected clear(): void {
    this.commit('');
  }
}
