import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import { SELECTION_ROW_CLASSES, selectionRowStateClasses } from '../selection/selection.types';

/**
 * A switch: 44x24, on or off, applied immediately.
 *
 * TOGGLE OR CHECKBOX -- THE MOST COMMON CONFUSION IN THIS LIBRARY, and it is
 * not about how they look.
 *
 *   Toggle   = IMMEDIATE ACTION. It takes effect the moment it is touched.
 *              There is no Save button, because there is nothing left to save.
 *   Checkbox = A SELECTION INSIDE A FORM, confirmed later by something else.
 *
 * Getting it wrong is not cosmetic. A toggle in a form leaves a setting
 * already applied while a Save button suggests it is not; a checkbox used for
 * an immediate setting silently discards the change when someone navigates
 * away without submitting.
 *
 * `role="switch"`, NEVER `role="checkbox"`, whatever it resembles. A checkbox
 * is announced as "checked"/"not checked" -- the vocabulary of a selection --
 * and a switch as "on"/"off", which is what this control actually does. The
 * element underneath is still `<input type="checkbox">`, because the role is
 * the only part that needed changing: the keyboard behaviour, the focus and
 * the tab stop are all correct already.
 *
 * NO TRANSITION ON THE THUMB. The thumb changes side instantly. This library
 * has no duration token and ADR 0009 deleted Tailwind's, so an animation
 * utility here would compile, apply a literal zero and look exactly like this
 * while pretending otherwise (see the note in button.types.ts). Adding one
 * starts with a token. Recorded in the PR report.
 */
@Component({
  selector: 'ewms-toggle',
  templateUrl: './toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  providers: [provideValueAccessor(() => Toggle)],
})
export class Toggle extends FormControlBase<boolean> {
  readonly checked = input<boolean>(false);

  /** The visible text beside the switch, already translated. */
  readonly label = input<string>('');

  /** The accessible name where there is no room for visible text. */
  readonly ariaLabel = input<string>('');

  readonly checkedChange = output<boolean>();

  protected readonly valueSource = this.checked;

  /**
   * The row, not the track, is the hit target -- the same 44x24 rectangle is a
   * hard thing to land on with a gloved finger on a tablet in a warehouse, and
   * that is where this control is actually used. A `<label>` wrapping the
   * input gives the whole row, text included, for free.
   */
  protected readonly rowClasses = computed(
    () => `${SELECTION_ROW_CLASSES} ${selectionRowStateClasses(this.isDisabled())}`,
  );

  /**
   * The track, which is the native input itself.
   *
   * Disabled is checked first and carries no hover: a switch that cannot be
   * flipped must not light up under the pointer.
   */
  protected readonly trackClasses = computed(() => {
    const base =
      'appearance-none relative shrink-0 w-11 h-6 rounded-full outline-none ' +
      'focus-visible:shadow-(--focus-ring-shadow)';

    if (this.isDisabled()) {
      return `${base} ${this.controlValue() ? 'bg-(--color-bg-primary-disabled)' : 'bg-secondary'}`;
    }
    return this.controlValue()
      ? `${base} bg-primary hover:bg-(--color-bg-primary-hover)`
      : `${base} bg-(--color-border-strong) hover:bg-(--color-border-strong-hover)`;
  });

  /**
   * The thumb: 20x20 inset by 2 px, sitting at one end of the track or the
   * other. 2 + 20 + 2 is the track's 24 px height, and 20 px of travel puts it
   * the same 2 px from the far edge.
   */
  protected readonly thumbClasses = computed(
    () =>
      'absolute top-0.5 left-0.5 size-5 rounded-full pointer-events-none ' +
      'bg-(--color-text-on-primary) ' +
      (this.controlValue() ? 'translate-x-5' : 'translate-x-0'),
  );

  /**
   * The native `change` is stopped inside the component for the reason set out
   * on `Checkbox.onNativeChange`: this control publishes `checkedChange`, and
   * the `<input>` under it is an implementation detail whose events are not
   * part of the API.
   */
  protected onNativeChange(event: Event): void {
    event.stopPropagation();
    const value = (event.target as HTMLInputElement).checked;
    this.commit(value);
    this.checkedChange.emit(value);
  }

  protected onBlur(): void {
    this.markTouched();
  }
}
