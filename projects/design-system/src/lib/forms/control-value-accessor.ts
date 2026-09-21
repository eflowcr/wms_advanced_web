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

/** `forwardRef` obligatorio: los providers se evalúan antes que la clase y fallaría en silencio. */
export function provideValueAccessor(resolve: () => Type<ControlValueAccessor>): Provider {
  return { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(resolve), multi: true };
}

/**
 * `@Directive()` hace real la entrada `disabled` heredada. Entrada y `setDisabledState` se suman
 * con O: gana lo restrictivo, y `form.enable()` no rehabilita un `[disabled]="true"`.
 */
@Directive()
export abstract class FormControlBase<TValue> implements ControlValueAccessor {
  /** `checked` o `value` según el componente; se lee tarde, cuando ya está inicializada. */
  protected abstract readonly valueSource: Signal<TValue>;

  readonly disabled = input<boolean>(false);

  private readonly disabledByForm = signal(false);

  readonly isDisabled = computed(() => this.disabled() || this.disabledByForm());

  /** `linkedSignal`: escribible y además se resiembra cuando cambia la entrada. */
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

  /** Toda interacción pasa por acá: pantalla y formulario nunca discrepan. */
  protected commit(value: TValue): void {
    this.controlValue.set(value);
    this.onChange(value);
  }

  /** En blur, nunca al cambiar de valor. */
  protected markTouched(): void {
    this.onTouched();
  }
}
