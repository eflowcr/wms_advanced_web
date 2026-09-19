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
 * Single-line and multi-line text field.
 *
 * Shares its box with `ewms-select` through field.types.ts -- the same
 * heights, type scale, radius, border colours and focus ring -- so a form row
 * holding an input, a select and a button lines up without anyone measuring.
 *
 * WHAT IT DOES NOT DO: validate. `state="error"` is a picture, nothing more.
 * The parent form decides whether a value is wrong and says so through that
 * input, which is what keeps this component out of every project's validation
 * conventions.
 *
 * THE BORDER AND THE FOCUS RING LIVE ON THE NATIVE CONTROL, not on a wrapper.
 * The prefix icon and the suffix button are laid over it, absolutely
 * positioned, and the text is pushed out of their way with padding. Wrapping
 * the input in a bordered box would move the ring off the thing that actually
 * has focus and would need `:focus-within` to fake it back.
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
   * Required, without exception, and rendered as a real `<label for>`.
   *
   * A placeholder is not a name: it disappears the moment someone types, and
   * several screen readers never announce it at all. Making this optional
   * would turn "the field has an accessible name" from a guarantee into a
   * convention, and the convention is the one that breaks.
   *
   * Passed already translated -- the design system speaks no language
   * (ADR 0008).
   */
  readonly label = input.required<string>();

  readonly placeholder = input<string>('');

  /** Help text under the field. Turns danger-coloured in `error`. */
  readonly hint = input<string>('');

  readonly state = input<FieldState>('default');

  /** Paints the asterisk beside the label and sets the native attribute. */
  readonly required = input<boolean>(false);

  /**
   * The accessible name of the show/hide button: what pressing it will do.
   * Already translated.
   *
   * Optional, and the button is NOT rendered without both of them.
   * `ewms-icon-button` requires a label in its type and this component has no
   * language of its own to invent one in, so the alternatives were an unnamed
   * button (fails axe, unusable by voice) or a required input on every text
   * field that will never hold a password. The Input ficha does not say where
   * this text comes from -- see the PR report.
   */
  readonly showPasswordLabel = input<string>('');
  readonly hidePasswordLabel = input<string>('');

  /** Same contract, for the button that empties a search field. */
  readonly clearLabel = input<string>('');

  /**
   * PREFIXED, and the prefix is load-bearing -- the same rule the Tooltip's
   * `tooltipDisabled` follows, on the output side.
   *
   * Outputs named after the two native focus events collide with them: a
   * consumer binding either one on `<ewms-input>` is writing something that
   * can resolve to the DOM event instead, and ESLint's no-output-native
   * forbids the pair outright. The Input ficha asks for those two names; they
   * were written before the collision was known, and the prefixed pair is what
   * the collision leaves. Reported.
   *
   * There is a second, smaller reason the prefix is the right answer: gate 10
   * reads every string literal in a .ts file as a possible class name, and one
   * of the two native names is also a stock Tailwind filter utility, so
   * binding it from an INLINE template failed the build. `fieldBlur` is not a
   * utility name, so that goes away too.
   */
  readonly fieldFocus = output<void>();
  readonly fieldBlur = output<void>();

  protected readonly fieldId = `ewms-input-${++nextInputId}`;
  protected readonly hintId = `${this.fieldId}-hint`;

  protected readonly baseClasses = FIELD_BASE_CLASSES;
  protected readonly iconSize = FIELD_ICON_SIZE;

  /**
   * The base seeds its state from the component's value input. The Input has
   * none -- the ficha's contract is label/placeholder/hint/state, and the
   * value arrives through `formControlName` or `ngModel` -- so the seed is the
   * empty string and only `writeValue` ever changes it from outside.
   */
  protected readonly valueSource = signal('');

  private readonly focused = signal(false);

  /** Toggled by the show/hide button; only ever consulted for `password`. */
  private readonly passwordVisible = signal(false);

  /**
   * The state actually rendered.
   *
   * `state="disabled"`, the `disabled` input and `setDisabledState` are three
   * ways to say the same thing, and any one of them is enough -- the same rule
   * as `FormControlBase.isDisabled`, extended to the ficha's `state` API. The
   * restrictive answer wins; see the comment on that class.
   */
  protected readonly effectiveState = computed<FieldState>(() =>
    this.isDisabled() ? 'disabled' : this.state(),
  );

  protected readonly isTextarea = computed(() => this.type() === 'textarea');
  protected readonly isSearch = computed(() => this.type() === 'search');
  protected readonly isPassword = computed(() => this.type() === 'password');

  /**
   * What lands on the native `type` attribute.
   *
   * `textarea` never reaches it (a different element is rendered), and
   * `password` becomes `text` while the value is revealed -- that swap is the
   * whole of the show/hide feature.
   */
  protected readonly nativeType = computed(() => {
    if (this.isPassword()) {
      return this.passwordVisible() ? 'text' : 'password';
    }
    return this.type();
  });

  protected readonly hasPrefixIcon = computed(() => this.isSearch());

  /**
   * The show/hide button, only for `password`, and only once the consumer has
   * supplied both texts for it.
   */
  protected readonly hasPasswordToggle = computed(
    () =>
      this.isPassword() && Boolean(this.showPasswordLabel()) && Boolean(this.hidePasswordLabel()),
  );

  /**
   * The clear button, only for `search`, only with a label, and only when
   * there is something to clear: an `x` over an empty field is a control that
   * does nothing.
   */
  protected readonly hasClearButton = computed(
    () => this.isSearch() && Boolean(this.clearLabel()) && this.controlValue().length > 0,
  );

  protected readonly hasSuffix = computed(() => this.hasPasswordToggle() || this.hasClearButton());

  /** Show or hide, whichever the next press will do. */
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
   * Horizontal padding: the field's own, overridden on whichever side carries
   * an icon. Tailwind emits `pl-*`/`pr-*` after `px-*`, so the side-specific
   * value wins in the cascade regardless of the order written here.
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

  /** Numbers are compared digit by digit, so they are right-aligned. */
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

  /** Present only when there is a hint, so the field is never described by nothing. */
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
   * Blur is where `onTouched` fires, and nowhere else: a control someone typed
   * into but has not left yet is not "touched" in the form's sense, and
   * marking it early makes validation messages appear mid-keystroke.
   */
  protected onBlur(): void {
    this.focused.set(false);
    this.markTouched();
    this.fieldBlur.emit();
  }

  /**
   * Flip between password and text.
   *
   * The focus is NOT moved. The button already has it -- someone pressed it --
   * and nothing here calls `focus()` or swaps the control for a different
   * element, so it stays where it is.
   */
  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  /**
   * Empty the field and tell the form in one call -- `commit`, never a bare
   * signal write, or the form would keep the old value while the box looks
   * empty.
   */
  protected clear(): void {
    this.commit('');
  }
}
