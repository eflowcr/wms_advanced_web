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
import { IconButton } from '../icon-button/icon-button';
import {
  PREFIX_ICON_OFFSET_CLASSES,
  PREFIX_PADDING_CLASSES,
  SUFFIX_PADDING_CLASS,
  type InputType,
} from './input.types';

export type { InputType } from './input.types';

let nextInputId = 0;

/**
 * Campo de texto de una o varias líneas. Comparte su caja con `ewms-select` por
 * field.types.ts, así una fila de formulario se alinea sin que nadie mida. NO
 * valida: `state="error"` es un dibujo y decide el formulario de arriba.
 * El borde y el anillo de foco van en el control nativo, no en un envoltorio.
 */
@Component({
  selector: 'ewms-input',
  templateUrl: './input.html',
  imports: [Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  providers: [provideValueAccessor(() => Input)],
})
export class Input extends FormControlBase<string> {
  readonly type = input<InputType>('text');
  readonly size = input<FieldSize>('md');

  /**
   * Obligatoria, sin excepción, y pintada como un `<label for>` de verdad. Un
   * placeholder no es un nombre: desaparece al tipear y varios lectores de
   * pantalla no lo anuncian nunca. Llega ya traducida (ADR 0008).
   */
  readonly label = input.required<string>();

  /**
   * Conserva el nombre para la ayuda técnica y lo saca de la pantalla. Es para la
   * fila de filtros de la Tabla: seis cajas no pueden llevar etiqueta visible sin
   * duplicar el alto, y un `<th>` dos filas arriba no es una etiqueta. La
   * etiqueta se sigue pintando, atando por for/id y leyendo: solo no se ve.
   */
  readonly hideLabel = input<boolean>(false);

  readonly placeholder = input<string>('');

  /** Texto de ayuda bajo el campo. Se pinta de peligro en `error`. */
  readonly hint = input<string>('');

  readonly state = input<FieldState>('default');

  /** Pinta el asterisco junto a la etiqueta y pone el atributo nativo. */
  readonly required = input<boolean>(false);

  /**
   * El nombre accesible del botón mostrar/ocultar: qué hará al pulsarlo, ya
   * traducido. Opcional, y sin él el botón NO se pinta: la alternativa era un
   * botón sin nombre (falla axe, inusable por voz) o una entrada obligatoria en
   * todo campo de texto que nunca tendrá una clave.
   */
  readonly showPasswordLabel = input<string>('');
  readonly hidePasswordLabel = input<string>('');

  /** Mismo contrato, para el botón que vacía un campo de búsqueda. */
  readonly clearLabel = input<string>('');

  /**
   * PREFIJADAS, y el prefijo carga peso. Una salida con el nombre de un evento
   * nativo de foco choca con él -ESLint no-output-native lo prohíbe- y además uno
   * de esos dos nombres es una utilidad de Tailwind, así que atarlo desde una
   * plantilla en línea rompía la compuerta 10. Desviación de la ficha, reportada.
   */
  readonly fieldFocus = output<void>();
  readonly fieldBlur = output<void>();

  protected readonly fieldId = `ewms-input-${++nextInputId}`;
  protected readonly hintId = `${this.fieldId}-hint`;

  protected readonly baseClasses = FIELD_BASE_CLASSES;
  protected readonly iconSize = FIELD_ICON_SIZE;

  /**
   * La base siembra su estado del valor del componente, y el Input no tiene: el
   * valor llega por `formControlName` o `ngModel`, así que la semilla es la
   * cadena vacía y solo `writeValue` la cambia desde afuera.
   */
  protected readonly valueSource = signal('');

  private readonly focused = signal(false);

  /** Lo mueve el botón mostrar/ocultar; solo se consulta para `password`. */
  private readonly passwordVisible = signal(false);

  /**
   * El estado que se pinta de verdad. `state="disabled"`, la entrada `disabled` y
   * `setDisabledState` dicen lo mismo y con cualquiera alcanza: gana la respuesta
   * restrictiva, igual que en `FormControlBase.isDisabled`.
   */
  protected readonly effectiveState = computed<FieldState>(() =>
    this.isDisabled() ? 'disabled' : this.state(),
  );

  protected readonly isTextarea = computed(() => this.type() === 'textarea');
  protected readonly isSearch = computed(() => this.type() === 'search');
  protected readonly isPassword = computed(() => this.type() === 'password');

  /**
   * Lo que cae en el `type` nativo. `textarea` nunca llega (se pinta otro
   * elemento), y `password` pasa a `text` mientras el valor está a la vista: ese
   * cambio es todo el mostrar/ocultar.
   */
  protected readonly nativeType = computed(() => {
    if (this.isPassword()) {
      return this.passwordVisible() ? 'text' : 'password';
    }
    return this.type();
  });

  protected readonly hasPrefixIcon = computed(() => this.isSearch());

  /** Solo para `password`, y solo con los dos textos que el consumidor da. */
  protected readonly hasPasswordToggle = computed(
    () =>
      this.isPassword() && Boolean(this.showPasswordLabel()) && Boolean(this.hidePasswordLabel()),
  );

  /**
   * Solo para `search`, con etiqueta, y solo cuando hay algo que borrar: una `x`
   * sobre un campo vacío es un control que no hace nada.
   */
  protected readonly hasClearButton = computed(
    () => this.isSearch() && Boolean(this.clearLabel()) && this.controlValue().length > 0,
  );

  protected readonly hasSuffix = computed(() => this.hasPasswordToggle() || this.hasClearButton());

  /** Mostrar u ocultar, lo que vaya a hacer la próxima pulsación. */
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

  /**
   * Relleno horizontal: el del campo, pisado del lado que lleva icono. Tailwind
   * emite `pl-*`/`pr-*` después de `px-*`, así que gana el del lado sin importar
   * el orden escrito acá.
   */
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

  /** Los números se comparan dígito a dígito, así que van alineados a la derecha. */
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

  /** Solo cuando hay hint, para que el campo nunca lo describa la nada. */
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

  /**
   * `onTouched` dispara acá y en ningún otro lado: un control que alguien tipeó y
   * todavía no dejó no está «tocado», y marcarlo antes hace aparecer mensajes de
   * validación en medio de la escritura.
   */
  protected onBlur(): void {
    this.focused.set(false);
    this.markTouched();
    this.fieldBlur.emit();
  }

  /**
   * El foco NO se mueve: el botón ya lo tiene -alguien lo pulsó- y nada acá llama
   * a `focus()` ni cambia el control por otro elemento.
   */
  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  /**
   * Vacía el campo y avisa al formulario en una sola llamada: `commit` y nunca
   * una escritura suelta, o el formulario se quedaría con el valor viejo mientras
   * la caja se ve vacía.
   */
  protected clear(): void {
    this.commit('');
  }
}
