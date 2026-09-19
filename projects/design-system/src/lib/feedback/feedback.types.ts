import type { IconName } from '../../icons/icons.generated';
import type { IconSize } from '../icon/icon';

/**
 * Everything the Banner and the Toast agree on.
 *
 * Two formats of the same message -- one that lives in the layout and one
 * that floats and leaves on its own -- and one vocabulary of severity. Writing
 * the variant table twice is how the two would end up disagreeing about which
 * icon means "warning".
 *
 *
 * INFO IS CALLED INFO AND IS PAINTED NEUTRAL.
 *
 * The name is for whoever uses the component; the colour is not blue because
 * blue means "you click this" (Fundamentos de Marca). There is no `info`
 * family in tokens.css and there is not going to be one: an informative blue
 * measured 1.76:1 against the action blue, which is indistinguishable in
 * practice. So the PUBLIC name and the TOKEN FAMILY are two different things,
 * and `FEEDBACK_FAMILIES` is the only place that maps one to the other.
 */
export type FeedbackVariant = 'success' | 'warning' | 'danger' | 'info';

/** The token family each variant paints with. Info -> neutral, on purpose. */
export const FEEDBACK_FAMILIES: Readonly<Record<FeedbackVariant, string>> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'neutral',
};

/**
 * The icon per severity, CHOSEN BY THE COMPONENT and never passed in.
 *
 * The consumer picks a severity; the drawing that goes with it is a property
 * of the system, not of the call site. Letting it be passed is how one screen
 * ends up with a triangle on a success message.
 */
export const FEEDBACK_ICONS: Readonly<Record<FeedbackVariant, IconName>> = {
  success: 'circle-check',
  warning: 'alert-triangle',
  danger: 'circle-x',
  info: 'info-circle',
};

/**
 * `alert` interrupts, `status` waits its turn -- and the difference is the
 * whole of it.
 *
 * Danger and Warning are conditions someone has to act on, so they are worth
 * cutting into whatever the screen reader is saying. Success and Info are not:
 * announcing "saved" over the top of the sentence a person is listening to is
 * a worse outcome than announcing it a moment later. The Notificaciones sheet
 * is explicit that the four must not share one role.
 */
export function feedbackRole(variant: FeedbackVariant): 'alert' | 'status' {
  return variant === 'danger' || variant === 'warning' ? 'alert' : 'status';
}

/**
 * Surface, border and foreground for one severity.
 *
 * The foreground is the family's `-text`, and the icon inherits it -- which is
 * the whole reason the icon needs no colour of its own. Measured against the
 * family's own `-surface`, `-text` clears the 3:1 of WCAG 1.4.11 in all four
 * families with room to spare (5.58 / 5.34 / 5.34 / 9.04) while `-solid`
 * clears it by much less (4.28 / 4.13 / 4.12 / 3.71). That measurement is what
 * closed the sheet's open question about which token paints the icon; the
 * numbers are recorded in Notificaciones.md.
 */
export function feedbackSurfaceClasses(variant: FeedbackVariant): string {
  switch (variant) {
    case 'success':
      return 'bg-success-surface border-success text-success';
    case 'warning':
      return 'bg-warning-surface border-warning text-warning';
    case 'danger':
      return 'bg-danger-surface border-danger text-danger';
    case 'info':
      return 'bg-neutral-surface border-neutral text-neutral';
  }
}

/**
 * The toast's 4 px leading accent, and it is `-solid` rather than `-border`.
 *
 * The other half of the sheet's open question, and this one the measurement
 * decided the other way. Against the family surface the accent sits on,
 * `-border` measures 1.62 / 1.53 / 1.53 / 1.45 -- an accent nobody can see --
 * while `-solid` measures 4.28 / 4.13 / 4.12 / 3.71. A 4 px bar drawn to be
 * noticed has to be visible, so it takes the solid.
 *
 * This is also the first consumer of the solid family, which the sheet noted
 * had none.
 */
export function feedbackAccentClasses(variant: FeedbackVariant): string {
  switch (variant) {
    case 'success':
      return 'bg-success-solid';
    case 'warning':
      return 'bg-warning-solid';
    case 'danger':
      return 'bg-danger-solid';
    case 'info':
      return 'bg-neutral-solid';
  }
}

/**
 * 18 px, the system's `md`. Big enough to read as a symbol beside a title,
 * small enough not to become the loudest thing in a one-line toast.
 */
export const FEEDBACK_ICON_SIZE: IconSize = 'md';
