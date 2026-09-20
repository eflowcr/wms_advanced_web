import {
  computed,
  Directive,
  forwardRef,
  input,
  linkedSignal,
  signal,
  type Provider,
  type Signal,
  type Type,
  type WritableSignal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

/**
 * Registra un componente como value accessor del control al que se ata.
 * `forwardRef` NO es opcional: el arreglo de providers se evalúa mientras corre
 * el decorador, ANTES de que exista el binding de la clase, así que un
 * `useExisting` pelado lee `undefined` y el control nunca se ata, en silencio.
 */
export function provideValueAccessor(resolve: () => Type<ControlValueAccessor>): Provider {
  return { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(resolve), multi: true };
}

/**
 * La mitad `ControlValueAccessor` de toda primitiva de formulario, escrita una vez
 * y heredada por Input, Checkbox, Radio, Toggle y Select. `@Directive()` sin
 * selector es lo que hace real la entrada `disabled` heredada: Angular solo junta
 * entradas de una clase decorada.
 *
 * DESHABILITADO: LA ENTRADA `disabled` Y `setDisabledState` NO SE MEZCLAN, SE
 * SUMAN CON O. Dejar que el formulario pise la entrada haría que
 * `[disabled]="true"` se volviera editable en cuanto el formulario habilite el
 * control, que es lo contrario de lo que dice la plantilla. Deshabilitar es una
 * propiedad de seguridad: gana la respuesta restrictiva.
 * Consecuencia buscada: quien fija la entrada no se re-habilita con
 * `form.enable()`; para que mande el formulario, no se pasa la entrada.
 */
@Directive()
export abstract class FormControlBase<TValue> implements ControlValueAccessor {
  /**
   * La entrada de valor del componente, se llame como se llame: `checked` en
   * Checkbox y Toggle, `value` en Select. Se lee tarde (ver `controlValue`) para
   * que un campo declarado después ya esté inicializado.
   */
  protected abstract readonly valueSource: Signal<TValue>;

  readonly disabled = input<boolean>(false);

  /** Lo escribe solo `setDisabledState`; nunca la entrada. */
  private readonly disabledByForm = signal(false);

  /** Cualquiera de las dos deshabilita. Ver el comentario de la clase. */
  readonly isDisabled = computed(() => this.disabled() || this.disabledByForm());

  /**
   * El valor que se pinta. Un `linkedSignal` y no uno común: es escribible para
   * `writeValue` y para la interacción, Y se resiembra cuando cambia la entrada.
   * Uno común alimentado por un effect haría de la entrada un valor de una sola vez.
   */
  protected readonly controlValue: WritableSignal<TValue> = linkedSignal(() => this.valueSource());

  private onChange: (value: TValue) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: TValue): void {
    this.controlValue.set(value);
  }

  registerOnChange(fn: (value: TValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledByForm.set(isDisabled);
  }

  /**
   * Registra un valor que produjo la persona: actualiza la pantalla Y avisa al
   * formulario. Toda interacción pasa por acá, así ningún componente puede
   * cambiar lo que muestra sin notificar.
   */
  protected commit(value: TValue): void {
    this.controlValue.set(value);
    this.onChange(value);
  }

  /** El control fue visitado. Se emite en blur, nunca al cambiar de valor. */
  protected markTouched(): void {
    this.onTouched();
  }
}
