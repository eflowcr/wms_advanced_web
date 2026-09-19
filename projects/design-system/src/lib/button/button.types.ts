import type { IconSize } from '../icon/icon';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonIconPosition = 'left' | 'right';

/**
 * Shared icon size mapping for Button and Icon Button.
 * Size 'lg' deliberately uses 'md' icon size to avoid visually unbalanced toolbar icons.
 */
export const BUTTON_ICON_SIZES: Readonly<Record<ButtonSize, IconSize>> = {
  sm: 'sm',
  md: 'md',
  lg: 'md',
};

/**
 * Font size semantic token references per button size.
 */
export const BUTTON_FONT_SIZES: Readonly<Record<ButtonSize, string>> = {
  sm: 'var(--text-control-sm-size)',
  md: 'var(--text-control-md-size)',
  lg: 'var(--text-control-lg-size)',
};

/**
 * Base height utility per size.
 */
export const BUTTON_HEIGHT_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
};

/**
 * Horizontal padding utility per size for text buttons.
 */
export const BUTTON_PADDING_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: 'px-3',
  md: 'px-4',
  lg: 'px-5',
};

/**
 * Square box size utility per size for icon buttons.
 */
export const ICON_BUTTON_SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

/**
 * Utilities every control in this family carries, Button and Icon Button alike.
 *
 * `relative` anchors the absolutely positioned loading spinner, so hiding the
 * content never changes the box.
 *
 * The focus ring is `:focus-visible`, not `:focus`: the browser decides when
 * the ring is warranted, so it appears for keyboard navigation and stays away
 * on a mouse click. `outline-none` removes the user-agent ring that the
 * `--focus-ring-shadow` box-shadow replaces -- never removed without a
 * replacement. The shadow is a box-shadow and not an outline because the token
 * paints two bands, first the surface colour and then the focus colour, which
 * is what keeps the ring separated from the control on all four variants.
 * Both widths live in the token, not here.
 *
 * NO animated colour change, on purpose. Tailwind's utility for that used to
 * be here and did nothing: `--*: initial` deletes the default duration it
 * reads, so the class still compiles and falls back to a literal zero. It
 * looks like it animates and does not -- exactly the silent failure ADR 0009
 * warns about, and one gate 10 cannot catch, because it does produce CSS
 * under our theme.
 *
 * Neither that utility's name nor the bare English word for it appears
 * anywhere in this repository, this comment included. Tailwind scans raw text
 * and has no idea what a comment is, so either one emits a dead rule into the
 * shipped CSS. Both mistakes were made while writing this very comment, and
 * the bundle size is what caught them.
 *
 * Bringing it back needs a duration token in tokens.css mapped into the
 * `@theme` section, which lives in the shell. No component spec asks for one,
 * so the class is gone rather than left in place doing nothing. See the DS-2
 * PR report.
 *
 * This lives here rather than in a component stylesheet because component
 * styles are injected inline and the strict CSP blocks them (ADR 0010).
 */
export const BUTTON_BASE_CLASSES =
  'relative inline-flex items-center justify-center rounded-control outline-none select-none ' +
  'focus-visible:shadow-(--focus-ring-shadow)';

/**
 * Variant colours per state, shared by both components so they cannot drift.
 * Disabled wins over the interactive palette: a disabled control has no hover
 * or active state at all.
 *
 * GHOST CARRIES ITS FOREGROUND HERE, AS A CLASS, AND NOT AS AN INLINE STYLE.
 *
 * Its foreground is the brand blue, which is a background role in the theme,
 * so it has no `text-*` utility of its own and used to be written straight
 * onto the element as `style.color`. An inline declaration cannot express a
 * hover, and Ghost needs one: the brand blue on `--color-ghost-hover` measures
 * 4.38:1, under the 4.5:1 of WCAG 1.4.3, while the hover tone of the same
 * ramp measures 5.65:1. The arbitrary-value utilities below are therefore not
 * a shortcut past the theme -- they name the same semantic tokens the theme
 * would, for a role the theme does not expose.
 *
 * Ghost darkens its TEXT on hover exactly as Primary darkens its background:
 * the same gesture, not an exception (Boton.md, decision of 2026-09-18).
 *
 * The spinner is deliberately NOT part of this move and stays on
 * `--color-bg-primary`: a spinner is not text, and 1.4.11 asks it for 3:1.
 */
export function buttonVariantClasses(variant: ButtonVariant, disabled: boolean): string {
  if (disabled) {
    switch (variant) {
      case 'primary':
        return 'bg-primary-disabled text-disabled cursor-not-allowed';
      case 'secondary':
        return 'bg-surface border border-default text-disabled cursor-not-allowed';
      case 'danger':
        return 'bg-danger-disabled text-disabled cursor-not-allowed';
      case 'ghost':
        return 'bg-transparent text-disabled cursor-not-allowed';
    }
  }

  switch (variant) {
    case 'primary':
      return 'bg-primary hover:bg-primary-hover active:bg-primary-active text-on-primary cursor-pointer';
    case 'secondary':
      return 'bg-secondary hover:bg-secondary-hover border border-strong text-primary cursor-pointer';
    case 'danger':
      return 'bg-danger hover:bg-danger-hover active:bg-danger-active text-on-primary cursor-pointer';
    case 'ghost':
      return (
        'bg-transparent hover:bg-ghost-hover cursor-pointer ' +
        'text-(color:--color-bg-primary) hover:text-(color:--color-bg-primary-hover)'
      );
  }
}

/**
 * The spinner inherits the foreground except where the variant's own text
 * colour is not what should spin.
 */
export function buttonSpinnerColor(variant: ButtonVariant): string {
  switch (variant) {
    case 'secondary':
      return 'var(--color-text-secondary)';
    case 'ghost':
      return 'var(--color-bg-primary)';
    default:
      return 'inherit';
  }
}

/**
 * Whether a pointer or keyboard interaction must not reach the consumer.
 *
 * `loading` is independent of `disabled` (see the Boton spec): a loading
 * button keeps the native focus, so the native `disabled` attribute cannot be
 * what stops the second click. This predicate is what does.
 */
export function isInteractionBlocked(disabled: boolean, loading: boolean): boolean {
  return disabled || loading;
}

/**
 * Stop an event dead, including listeners already bound on the same element
 * and any listener on an ancestor.
 */
export function suppressEvent(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
  event.stopPropagation();
}
