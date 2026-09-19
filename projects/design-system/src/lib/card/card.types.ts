import type { Signal } from '@angular/core';

/**
 * What a group needs from the cards inside it, and nothing more.
 *
 * It exists to break a cycle rather than to abstract anything: `ewms-card`
 * injects `CardGroup` to find out whether it is inside one, so the group
 * cannot import the card back to query it. The cards register themselves
 * through this interface instead, in construction order -- which is DOM order
 * within one template, and DOM order is what the arrow keys have to follow.
 */
export interface CardGroupMember {
  /** What this card is worth when it is the chosen one. */
  readonly optionValue: Signal<unknown>;
  /** Its own disabled input, before the group's is OR-ed in. */
  readonly ownDisabled: Signal<boolean>;
  /** Move the keyboard here. */
  focus(): void;
}

/**
 * The box, in both uses.
 *
 * `shadow-sm` is the elevation scale's "card at rest" and the only level a
 * card ever takes: a card that lifts to a dropdown's elevation reads as
 * floating over the page rather than lying on it.
 */
export const CARD_BASE_CLASSES =
  'flex flex-col gap-3 rounded-md border border-solid p-4 shadow-sm';

/**
 * The extra a card takes when it is an option in a group: a hit target, a
 * pointer, and the system's focus ring.
 *
 * `outline-none` is paired with the replacement on the same line, never on its
 * own -- the same rule every other control in this library follows.
 */
export const CARD_SELECTABLE_CLASSES =
  'w-full text-left select-none outline-none focus-visible:shadow-(--focus-ring-shadow)';

/**
 * Surface and border for a selectable card.
 *
 * SELECTED IS BORDER **AND** FILL, and the border is the accent.
 * `--color-row-selected` is never allowed to be the only signal -- Fundamentos
 * de Marca pairs it with an accent bar because the tint alone is within a
 * hair of `--color-ghost-hover`, and a WMS puts ghost buttons inside
 * selectable rows. A card does not need a 3 px bar to satisfy that: its whole
 * outline turns the action blue, which is the same guarantee drawn larger. The
 * check glyph in the corner is the third cue, for whoever reads neither.
 *
 * Disabled comes first and has no hover: a card that cannot be chosen must not
 * light up under the pointer.
 */
export function cardSelectableClasses(selected: boolean, disabled: boolean): string {
  if (disabled) {
    return 'bg-secondary border-default text-disabled cursor-not-allowed';
  }
  if (selected) {
    return 'bg-row-selected border-(--color-bg-primary) text-primary cursor-pointer';
  }
  return 'bg-surface border-default text-primary cursor-pointer hover:border-strong';
}
