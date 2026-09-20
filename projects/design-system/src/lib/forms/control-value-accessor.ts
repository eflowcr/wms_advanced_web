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
 * Registers a component as the value accessor of the form control it is bound
 * to, so `formControlName` and `ngModel` reach it.
 *
 * `forwardRef` is not optional here. The provider array is evaluated while the
 * `@Component` decorator runs, which is BEFORE the class binding exists: a
 * bare `useExisting: Input` in the component's own metadata reads `undefined`
 * and the control silently never binds. The argument is a thunk for the same
 * reason -- it must not be evaluated until injection time.
 *
 * One helper, used identically by the four primitives of this PR. Four
 * hand-written provider literals would be four chances to get this wrong.
 */
export function provideValueAccessor(resolve: () => Type<ControlValueAccessor>): Provider {
  return { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(resolve), multi: true };
}

/**
 * The `ControlValueAccessor` half of every form primitive in this library.
 *
 * Written once and inherited by Input, Checkbox, Radio, Toggle and Select, so
 * there is exactly one answer to each of the five questions the interface
 * asks. A per-component implementation would drift on the fifth one within a
 * release.
 *
 * `@Directive()` with no selector is what makes the inherited `disabled`
 * input real: Angular only collects inputs declared on a decorated class.
 * This class is never applied to an element.
 *
 *
 * DISABLED: THE FORM AND THE CONSUMER CAN DISAGREE, AND EITHER ONE WINS
 *
 * Two independent sources can say "not interactive": the `disabled` input,
 * written by whoever placed the component, and `setDisabledState`, called by
 * Angular when the bound `FormControl` is disabled. They are not merged, they
 * are OR-ed: the control is disabled when EITHER says so.
 *
 * The alternative -- letting the form override the input -- means
 * `<ewms-input [disabled]="true" formControlName="sku">` becomes editable the
 * moment the form enables that control, which is the opposite of what the
 * template says. Disabling is a safety property, so the restrictive answer is
 * the right default and the permissive one has to be argued for.
 *
 * Consequence, on purpose: a consumer who hard-codes `[disabled]="true"`
 * cannot be re-enabled by `form.enable()`. The way to let the form drive it is
 * not to pass the input at all -- which is what a form-driven control does.
 *
 * `setDisabledState` is therefore the only writer of its own signal and never
 * touches the input. There is nothing to reconcile and no order dependency
 * between Angular's first `setDisabledState` call and the first binding pass.
 */
@Directive()
export abstract class FormControlBase<TValue> implements ControlValueAccessor {
  /**
   * The component's own value input, whatever it happens to be called:
   * `checked` on Checkbox and Toggle, `value` on Select. The base seeds its
   * internal state from it without knowing the name.
   *
   * Read lazily (see `controlValue`), so a subclass field declared after this
   * one is already initialised by the time it is dereferenced.
   */
  protected abstract readonly valueSource: Signal<TValue>;

  readonly disabled = input<boolean>(false);

  /** Set only by `setDisabledState`; never by the input. */
  private readonly disabledByForm = signal(false);

  /** Either source disables. See the class comment. */
  readonly isDisabled = computed(() => this.disabled() || this.disabledByForm());

  /**
   * The value actually rendered.
   *
   * A `linkedSignal` rather than a plain one: it is writable, so `writeValue`
   * and the user's own interaction can set it, AND it resets when the input it
   * is seeded from changes. A plain signal fed by an effect would need a write
   * from inside an effect and would make the input a one-shot default.
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
   * Record a value the user produced: update what is on screen AND tell the
   * form. Every interaction path in every primitive goes through here, so a
   * component can never update its own display without notifying the form.
   */
  protected commit(value: TValue): void {
    this.controlValue.set(value);
    this.onChange(value);
  }

  /** The control has been visited. Emitted on blur, never on value change. */
  protected markTouched(): void {
    this.onTouched();
  }
}
