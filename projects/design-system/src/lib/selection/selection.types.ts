/**
 * Everything the Checkbox and the Radio agree on.
 *
 * Two components, one job: an 18x18 box with a border, a glyph that appears
 * when it is on, and a label that is part of the hit target. Only the corner
 * radius and the glyph differ, so only those are written twice.
 *
 * They deliberately do NOT use the 32 / 40 / 48 control scale. A checkbox is
 * not sized to line up with a button -- it is sized to sit beside a line of
 * text -- and there is exactly one size of it.
 */

/** 18x18. `size-*` is 4px-based, so 4.5 steps is 18 px. */
export const SELECTION_BOX_SIZE_CLASS = 'size-4.5';

/**
 * The 1.5 px border, from the token. Applied as a style binding rather than a
 * utility: Tailwind's border widths are whole pixels, and `border-[1.5 px]` is
 * a raw value gate 10 rejects. See `--border-width-selection` in tokens.css.
 */
export const SELECTION_BORDER_WIDTH = 'var(--border-width-selection)';

/**
 * The whole row is the hit target, label included -- that is what a `<label>`
 * wrapping the native control buys, with no JavaScript and no `for`/`id` pair
 * to keep in sync.
 *
 * `cursor-pointer` is on the row for the same reason: the label is not
 * decoration next to the control, it IS part of the control.
 */
export const SELECTION_ROW_CLASSES = 'inline-flex items-center gap-2 select-none';

/**
 * The native control, styled directly.
 *
 * `appearance-none` strips the platform widget and leaves an ordinary box we
 * paint -- and, crucially, it is still an `<input type="checkbox">`: real
 * focus, real keyboard behaviour (Space toggles), real role, real name from
 * the wrapping label. The glyph is a sibling laid over it with
 * `pointer-events-none`, because an input cannot have children.
 *
 * The alternative -- hiding the input and styling a `<span>` -- is the same
 * picture with every one of those guarantees re-implemented by hand.
 */
export const SELECTION_CONTROL_BASE_CLASSES =
  'appearance-none shrink-0 border-solid outline-none ' +
  'focus-visible:shadow-(--focus-ring-shadow) ' +
  SELECTION_BOX_SIZE_CLASS;

/**
 * Surface and border for the box.
 *
 * `on` covers Checked AND Indeterminate: the ficha gives them the same
 * treatment on purpose, and only the glyph tells them apart. That is also why
 * the state can never be read from the colour alone, and why `aria-checked`
 * carries `mixed` rather than a boolean.
 *
 * Disabled comes first and has no hover: a control that cannot be operated
 * must not light up under the pointer.
 */
export function selectionBoxClasses(on: boolean, disabled: boolean): string {
  if (disabled) {
    return on
      ? 'bg-(--color-text-disabled) border-(--color-text-disabled)'
      : 'bg-secondary border-(--color-border)';
  }
  return on
    ? 'bg-primary border-(--color-bg-primary)'
    : 'bg-surface border-(--color-border-strong) hover:border-(--color-bg-primary)';
}

/** The row's text and pointer, which follow the control's own state. */
export function selectionRowStateClasses(disabled: boolean): string {
  return disabled ? 'text-disabled cursor-not-allowed' : 'text-primary cursor-pointer';
}

/**
 * The glyph laid over the box: the check, the indeterminate dash, the radio
 * dot. Never interactive -- every pointer event belongs to the input under it.
 */
export const SELECTION_GLYPH_CLASSES =
  'absolute inset-0 flex items-center justify-center pointer-events-none text-on-primary';
