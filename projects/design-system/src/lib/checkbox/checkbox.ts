import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import { Icon } from '../icon/icon';
import {
  SELECTION_BORDER_WIDTH,
  SELECTION_CONTROL_BASE_CLASSES,
  SELECTION_GLYPH_CLASSES,
  SELECTION_ROW_CLASSES,
  selectionBoxClasses,
  selectionRowStateClasses,
} from '../selection/selection.types';

/**
 * A checkbox: an 18x18 box with a check, a dash or nothing in it.
 *
 * NOT A TOGGLE, and the difference is not how it looks. A checkbox is a
 * SELECTION INSIDE A FORM, confirmed later by something else -- a Save button,
 * a bulk action, a submit. A toggle APPLIES THE MOMENT IT IS TOUCHED. Picking
 * the wrong one puts a Save button next to a setting that was already saved,
 * or silently discards a selection someone thought they had made. See
 * `ewms-toggle`.
 *
 * The native `<input type="checkbox">` is kept and styled with
 * `appearance-none`, rather than hidden behind a painted `<span>`. What that
 * buys, all of it for free and none of it re-implemented: the role, Space to
 * toggle, the tab order, the focus ring on the real focus target, and the name
 * that the wrapping `<label>` gives it.
 */
@Component({
  selector: 'ewms-checkbox',
  templateUrl: './checkbox.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  providers: [provideValueAccessor(() => Checkbox)],
})
export class Checkbox extends FormControlBase<boolean> {
  readonly checked = input<boolean>(false);

  /**
   * Neither on nor off: the "select all" box above a list where some rows are
   * selected and some are not.
   *
   * It outranks `checked` visually and in what is announced, because it is the
   * more specific claim: a box that is both indeterminate and checked is
   * indeterminate.
   */
  readonly indeterminate = input<boolean>(false);

  /**
   * The visible text beside the box, already translated. Optional, because the
   * box is not always labelled in place -- the header of a selectable table is
   * the case that matters -- and then `ariaLabel` carries the name instead.
   *
   * ONE OF THE TWO IS REQUIRED in practice: a checkbox with neither has no
   * accessible name and fails axe. The type cannot say "exactly one of these",
   * so the spec asserts it instead. See the PR report.
   */
  readonly label = input<string>('');

  /**
   * The accessible name when there is no visible text: a column of row
   * checkboxes, where the name has to say WHICH row. Already translated.
   */
  readonly ariaLabel = input<string>('');

  /**
   * NOT called `change`, and the name is load-bearing -- the same rule the
   * Tooltip's `tooltipDisabled` follows, on the output side.
   *
   * `change` is a native event, and it bubbles. An output by that name puts
   * two different things on one binding: a consumer writing it gets this
   * component's boolean AND the raw DOM Event travelling up from the `<input>`
   * inside, and the handler runs twice with two kinds of argument. ESLint's
   * no-output-native forbids it for exactly that reason. The Checkbox ficha
   * asks for `(change)`; that name was written before the collision was known.
   * See the PR report.
   *
   * `checkedChange` is also what the Toggle's ficha already asks for, so the
   * two selection controls now read the same.
   */
  readonly checkedChange = output<boolean>();

  /** The base seeds itself from the component's own value input. */
  protected readonly valueSource = this.checked;

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  protected readonly rowClasses = computed(
    () => `${SELECTION_ROW_CLASSES} ${selectionRowStateClasses(this.isDisabled())}`,
  );

  protected readonly borderWidth = SELECTION_BORDER_WIDTH;

  /** Checked and indeterminate share the filled treatment; only the glyph differs. */
  protected readonly isOn = computed(() => this.indeterminate() || this.controlValue());

  protected readonly boxClasses = computed(
    () =>
      // rounded-sm is 4 px: the checkbox's corner, and the one thing about the
      // box that the radio does not share.
      `${SELECTION_CONTROL_BASE_CLASSES} rounded-sm ` +
      selectionBoxClasses(this.isOn(), this.isDisabled()),
  );

  protected readonly glyphClasses = SELECTION_GLYPH_CLASSES;

  /**
   * `mixed`, not `true` and not `false`.
   *
   * The visual difference between checked and indeterminate is one glyph
   * inside an otherwise identical blue box, so anyone not looking at it gets
   * the state from here and from nowhere else.
   */
  protected readonly ariaChecked = computed(() => {
    if (this.indeterminate()) {
      return 'mixed';
    }
    return this.controlValue() ? 'true' : 'false';
  });

  constructor() {
    super();

    /**
     * `indeterminate` EXISTS ONLY AS A DOM PROPERTY. There is no HTML
     * attribute for it: writing `indeterminate="true"` in a template sets an
     * unknown attribute, the box renders unchecked, and nothing anywhere
     * reports a problem. It has to be assigned to the element.
     *
     * An effect rather than a one-off in ngAfterViewInit, because the input
     * changes over the component's life -- a "select all" box moves in and out
     * of the state every time a row is picked.
     */
    effect(() => {
      this.box().nativeElement.indeterminate = this.indeterminate();
    });
  }

  /**
   * The native control reports what it now is; that value is committed and
   * emitted.
   *
   * THE NATIVE EVENT IS STOPPED HERE, and that is not tidiness. This
   * component publishes `checkedChange`; the `<input>` under it is an
   * implementation detail. Letting its `change` bubble out of the host would
   * hand a consumer a second, undocumented event whose target is that private
   * element -- something to bind to, read the checked flag from, and be broken
   * by the next change in here.
   *
   * `indeterminate` is deliberately NOT cleared. It is the consumer's claim
   * about a set of other things, and only the consumer knows whether this
   * click resolved it -- guessing would make the "select all" box flicker out
   * of the mixed state on a click that did not select everything.
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
