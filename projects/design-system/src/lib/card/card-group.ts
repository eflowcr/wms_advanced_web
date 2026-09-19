import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import type { CardGroupMember } from './card.types';

/**
 * Single choice over cards, with the keyboard contract of a radio group.
 *
 * THIS IS A RADIO GROUP THAT LOOKS LIKE CARDS, not a list of buttons that
 * happens to remember one. The sheet says so ("mismo patron de grupo que el
 * radio"), and the consequence is the part people skip: a radio group is ONE
 * tab stop, entered at the chosen option, with the arrows moving inside it.
 * Making each card its own tab stop would turn a four-warehouse selector into
 * four stops on the way to the Save button.
 *
 * The value is the chosen card's `optionValue`, delivered through
 * `ControlValueAccessor` like every other control in this library. The group
 * holds it; the cards only report clicks and draw themselves.
 */
@Component({
  selector: 'ewms-card-group',
  templateUrl: './card-group.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  providers: [provideValueAccessor(() => CardGroup)],
})
export class CardGroup extends FormControlBase<unknown> {
  /** The chosen value. Seeds the control; `writeValue` takes over after that. */
  readonly value = input<unknown>(null);

  /**
   * Names the group for assistive technology. Required for the same reason
   * every other control's label is: a group with no name is a group nobody
   * can be told about. Already translated (ADR 0008).
   */
  readonly label = input.required<string>();

  protected readonly valueSource = this.value;

  /** The cards, in construction order -- which is DOM order in one template. */
  private readonly members = signal<readonly CardGroupMember[]>([]);

  /** What the cards read to know whether they are the chosen one. */
  readonly selectedValue = computed(() => this.controlValue());

  /**
   * The one card that is in the tab order: the chosen one, or the first that
   * can be chosen when nothing is.
   *
   * A group where nothing is selected still has to be reachable, and it has to
   * be reachable at exactly one place. Returning `null` would drop the whole
   * group out of the tab order the moment it starts empty, which is how it
   * starts every time.
   */
  readonly tabbableValue = computed<unknown>(() => {
    const enabled = this.members().filter((member) => !this.memberDisabled(member));
    if (enabled.length === 0) {
      return null;
    }
    const selected = enabled.find((member) => member.optionValue() === this.selectedValue());
    return (selected ?? enabled[0])?.optionValue() ?? null;
  });

  /** Called by a card as it is created. */
  register(member: CardGroupMember): void {
    this.members.update((current) => [...current, member]);
  }

  /** Called by a card as it is destroyed. */
  unregister(member: CardGroupMember): void {
    this.members.update((current) => current.filter((existing) => existing !== member));
  }

  /** Either source disables: the group's own input, or the card's. */
  memberDisabled(member: CardGroupMember): boolean {
    return this.isDisabled() || member.ownDisabled();
  }

  /** Record a choice and tell the form. Ignored while the group is disabled. */
  select(value: unknown): void {
    if (this.isDisabled()) {
      return;
    }
    this.commit(value);
    this.markTouched();
  }

  /**
   * Move to the next or previous enabled card, choosing it on the way.
   *
   * SELECTION FOLLOWS THE FOCUS, which is the native behaviour of a radio
   * group and not an invention: in a group of radios the arrow keys change the
   * answer, they do not merely browse it. Browsing without choosing is the
   * listbox pattern, and this is not one.
   *
   * It WRAPS, unlike the Select's panel. The two are opposite cases: a panel
   * is a list you are reading through and the end of it is information, while
   * a radio group is a closed set of four things and stopping at the last one
   * only makes a person press the other arrow.
   */
  move(delta: number): void {
    const enabled = this.members().filter((member) => !this.memberDisabled(member));
    if (enabled.length === 0) {
      return;
    }
    const current = enabled.findIndex((member) => member.optionValue() === this.selectedValue());
    const from = current < 0 ? (delta > 0 ? -1 : 0) : current;
    const next = enabled[(from + delta + enabled.length) % enabled.length];
    if (!next) {
      return;
    }
    this.select(next.optionValue());
    next.focus();
  }
}
