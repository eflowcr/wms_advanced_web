import { BUTTON_FONT_SIZES, BUTTON_HEIGHT_CLASSES, type ButtonSize } from '../button/button.types';
import type { IconSize } from '../icon/icon';

/**
 * Everything the Input and the Select agree on.
 *
 * The two are separate components with separate public APIs, and they share a
 * box: same heights, same type scale, same radius, same border colours, same
 * focus ring. A form row mixing an input, a select and a button only lines up
 * because none of the three owns those numbers.
 *
 * The heights and the type scale are NOT redefined here -- they are the
 * Button's, imported. They are the control scale of the whole system, and
 * there is one copy of it (button.types.ts).
 */

export type FieldSize = ButtonSize;

/**
 * `error` is PURELY VISUAL. Neither component validates anything: the parent
 * form decides, and says so through this input.
 */
export type FieldState = 'default' | 'error' | 'disabled' | 'readonly';

/** 32 / 40 / 48. The Button's scale, not a second copy of it. */
export const FIELD_HEIGHT_CLASSES = BUTTON_HEIGHT_CLASSES;

/** 13 / 14 / 15. Also the Button's. */
export const FIELD_FONT_SIZES = BUTTON_FONT_SIZES;

/**
 * 10 / 12 / 14, and deliberately NOT the Button's 12 / 16 / 20.
 *
 * A button's padding is what separates its label from its edge; a field's is
 * what separates the caret from its edge, and a field is typically much wider
 * than its content. Copying the Button's padding here would push the text of
 * every field a third of a centimetre further in than the design asks for.
 */
export const FIELD_PADDING_CLASSES: Readonly<Record<FieldSize, string>> = {
  sm: 'px-2.5',
  md: 'px-3',
  lg: 'px-3.5',
};

/**
 * Decorative field icons -- the search glyph, the chevron, the eye -- are
 * `sm` (16 px) at EVERY field size, matching the Small button's icon.
 *
 * The rule is about rows, not about fields: a Small button and a Medium input
 * sit side by side constantly, and two icon sizes on one row read as a
 * mistake. Growing the icon with the field would be internally tidy and worse
 * on screen. See the Input ficha, "Icono -- lo que impone ewms-icon".
 */
export const FIELD_ICON_SIZE: IconSize = 'sm';

/**
 * The box itself. `border-solid` is explicit because Tailwind's preflight
 * resets every element to `0 solid` -- the width comes from `border`, and
 * leaving the style implicit is one reset away from an invisible field.
 *
 * `outline-none` removes the user-agent ring that the focus-ring token
 * replaces; the replacement is on the same line, never removed without one.
 */
export const FIELD_BASE_CLASSES =
  'w-full box-border rounded-control border border-solid outline-none ' +
  'focus-visible:shadow-(--focus-ring-shadow)';

/**
 * Border colour per state.
 *
 * Focus is passed in rather than expressed as a `:focus` variant because there
 * is no border utility for the action blue: the theme maps `--color-bg-primary`
 * as a background role only. The component already tracks focus -- it owes the
 * consumer its two focus outputs and owes the form onTouched -- so the state is
 * there for free, and a computed string is something jsdom can actually assert
 * on, which a `:focus` rule is not.
 *
 * ERROR OUTRANKS FOCUS. A field in error that gains focus keeps the danger
 * border and gets the ordinary focus ring on top: the system has exactly one
 * focus colour, everywhere, and a second one would make the ring mean two
 * different things (Fundamentos de Marca, "Anillo de foco").
 */
export function fieldBorderColor(state: FieldState, focused: boolean): string {
  if (state === 'error') {
    return 'var(--color-bg-danger)';
  }
  if (state === 'disabled' || state === 'readonly') {
    return 'var(--color-border)';
  }
  return focused ? 'var(--color-bg-primary)' : 'var(--color-border-strong)';
}

/**
 * Surface, foreground and cursor per state.
 *
 * DISABLED AND READ-ONLY SHARE A BACKGROUND AND NOTHING ELSE. Read-only text
 * is real content someone may need to read and copy, so it keeps the primary
 * foreground and the ordinary cursor; only the grey surface says "not editable
 * here". Painting it `text-disabled` would make an unmodifiable value look
 * like an unavailable one, and the two mean opposite things to whoever is
 * reading the screen.
 */
export function fieldSurfaceClasses(state: FieldState): string {
  switch (state) {
    case 'disabled':
      return 'bg-secondary text-disabled cursor-not-allowed';
    case 'readonly':
      return 'bg-secondary text-primary cursor-default';
    default:
      return 'bg-surface text-primary';
  }
}
