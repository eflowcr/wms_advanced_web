import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import {
  SELECTION_BORDER_WIDTH,
  SELECTION_CONTROL_BASE_CLASSES,
  SELECTION_GLYPH_CLASSES,
  SELECTION_ROW_CLASSES,
  selectionBoxClasses,
  selectionRowStateClasses,
} from '../selection/selection.types';

/**
 * One option out of several. Same 18x18 box, same border, same focus ring and
 * same row-as-hit-target as `ewms-checkbox`, through selection.types.ts; a
 * circle instead of a rounded square, and a dot instead of a check.
 *
 * GROUPING IS THE NATIVE ONE. Radios sharing a `name` exclude each other
 * because the browser makes them, not because this component keeps a registry:
 * checking one unchecks its siblings before any Angular code runs. `name` is
 * required for exactly that reason -- a radio without one is a radio in a
 * group of one, which is a checkbox that cannot be switched off.
 *
 * THE VALUE OF THE GROUP IS NOT THIS COMPONENT'S `value`. `value` is what THIS
 * option contributes when it is the chosen one; the control's value is
 * whichever option's `value` is currently selected. That is why `checked` is
 * derived by comparison and is not an input.
 */
@Component({
  selector: 'ewms-radio',
  templateUrl: './radio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  providers: [provideValueAccessor(() => Radio)],
})
export class Radio extends FormControlBase<unknown> {
  /** What the group's value becomes when this option is picked. */
  readonly value = input.required<unknown>();

  /**
   * The group. Required: shared `name` IS the grouping, and leaving it out
   * produces a radio that can be switched on and never off.
   */
  readonly name = input.required<string>();

  /** Visible text beside the dot, already translated. */
  readonly label = input<string>('');

  /** The accessible name when there is no visible text. */
  readonly ariaLabel = input<string>('');

  /**
   * NOT called `change`: it is a native event name, it bubbles, and an output
   * sharing it delivers both this value and the raw DOM Event on one binding.
   * See the comment on `Checkbox.checkedChange` and the PR report.
   *
   * `valueChange` is what the ficha already proposes for the optional radio
   * group wrapper, so the group and the option now speak the same way.
   */
  readonly valueChange = output<unknown>();

  /**
   * The base seeds itself from the component's value input -- except here,
   * where `value` is this option's identity rather than the group's value.
   * Nothing seeds this control: it starts empty and is filled by `writeValue`.
   */
  protected readonly valueSource = signal<unknown>(null);

  /**
   * Derived, never stored. Two sources of truth for "is this the selected
   * one?" is how a radio group ends up with two dots in it.
   */
  protected readonly isChecked = computed(() => this.controlValue() === this.value());

  protected readonly rowClasses = computed(
    () => `${SELECTION_ROW_CLASSES} ${selectionRowStateClasses(this.isDisabled())}`,
  );

  protected readonly borderWidth = SELECTION_BORDER_WIDTH;

  protected readonly boxClasses = computed(
    () =>
      // The only visual difference from the checkbox: a full circle.
      `${SELECTION_CONTROL_BASE_CLASSES} rounded-full ` +
      selectionBoxClasses(this.isChecked(), this.isDisabled()),
  );

  protected readonly glyphClasses = SELECTION_GLYPH_CLASSES;

  /**
   * The native `change` is stopped for the same reason as the Checkbox's: the
   * `<input>` is an implementation detail and its events are not part of this
   * component's API. See the comment on `Checkbox.onNativeChange`.
   */
  protected onNativeChange(event: Event): void {
    event.stopPropagation();
    this.commit(this.value());
    this.valueChange.emit(this.value());
  }

  protected onBlur(): void {
    this.markTouched();
  }
}
