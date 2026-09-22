import {
  computed,
  DestroyRef,
  Directive,
  forwardRef,
  inject,
  Injector,
  input,
  linkedSignal,
  signal,
  type Provider,
  type Signal,
  type Type,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NG_VALUE_ACCESSOR,
  NgControl,
  Validators,
  type ControlValueAccessor,
} from '@angular/forms';
import { EWMS_FORM_MESSAGES } from './form.types';

let nextFieldId = 0;

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

  /** Id del mensaje de error para los controles que no tienen uno propio (casilla, radio, toggle). */
  readonly fieldErrorId = `ewms-field-error-${++nextFieldId}`;

  /** Protegido: Select y Date picker ya tenían el suyo para crear su overlay. */
  protected readonly injector = inject(Injector);
  private readonly formMessages = inject(EWMS_FORM_MESSAGES, { optional: true });
  private readonly control = signal<NgControl | null>(null);
  /** Los errores de `ReactiveForms` no son señales: cada evento del control repinta el campo. */
  private readonly revision = signal(0);

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Tarde a propósito: pedir `NgControl` en el constructor, proveyendo NG_VALUE_ACCESSOR, es
    // una dependencia circular; y el control de la directiva todavía no existe.
    queueMicrotask(() => {
      const ngControl = this.injector.get(NgControl, null, { optional: true, self: true });
      this.control.set(ngControl);
      ngControl?.control?.events
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(() => this.revision.update((count) => count + 1));
    });
  }

  /**
   * El mensaje del validador que falló, ya traducido, **una vez que el campo fue tocado**: se
   * valida al salir del campo y al enviar, nunca mientras se escribe. Ver vault: Patron-Formulario.
   */
  readonly fieldError = computed<string>(() => {
    this.revision();
    const control = this.control()?.control;
    const errors = control?.errors;
    if (!control?.touched || !errors) {
      return '';
    }
    const [key, detail] = Object.entries(errors)[0] ?? [];
    if (key === undefined) {
      return '';
    }
    // Los nombres de `ReactiveForms` no son los `kind` de Signal Forms. Se va con este archivo.
    const kind = key === 'minlength' ? 'minLength' : key === 'maxlength' ? 'maxLength' : key;
    const write = this.formMessages?.errors[kind] ?? this.formMessages?.customError;
    const limit = (detail as Record<string, unknown> | null)?.['requiredLength'] ?? detail;
    return write === undefined ? '' : write(limit);
  });

  /** Obligatorio según el formulario: el asterisco no se escribe a mano en cada campo. */
  readonly requiredByForm = computed(() => {
    this.revision();
    return this.control()?.control?.hasValidator(Validators.required) ?? false;
  });

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
