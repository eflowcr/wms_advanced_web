import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  FEEDBACK_ICON_SIZE,
  FEEDBACK_ICONS,
  feedbackRole,
  feedbackSurfaceClasses,
  type FeedbackVariant,
} from '../feedback/feedback.types';
import { Icon } from '../icon/icon';
import { IconButton } from '../icon-button/icon-button';

export type { FeedbackVariant } from '../feedback/feedback.types';

/**
 * An inline message that stays until someone closes it.
 *
 * IT LIVES IN THE FLOW AND MAKES NO OVERLAY. That is the whole difference
 * between this and the Toast, and it decides which one a screen should use:
 * a banner pushes the layout down and stays there, so it is for a condition
 * that is still true (this warehouse is in stocktake, this order has an
 * incidence). A toast floats, leaves by itself, and is for something that just
 * happened.
 *
 * The icon is chosen from the variant and carries a `label`, because the
 * colour is not allowed to be the only signal (WCAG 1.4.1). Someone who does
 * not tell the four surfaces apart still hears "Error" before the message.
 */
@Component({
  selector: 'ewms-banner',
  templateUrl: './banner.html',
  imports: [Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class Banner {
  readonly variant = input<FeedbackVariant>('info');

  /** The headline, already translated by the consumer (ADR 0008). */
  readonly title = input.required<string>();

  /** Optional second line. A one-line banner is a legitimate banner. */
  readonly description = input<string>('');

  /**
   * The severity, in words, for the icon's accessible name.
   *
   * REQUIRED IN THE TYPE, like the Icon Button's `label` and for the same
   * reason: it is the only cue that does not depend on seeing the colour, so
   * a default would quietly empty the guarantee. It is also the only string
   * here the design system cannot produce -- it speaks no language.
   */
  readonly severityLabel = input.required<string>();

  readonly dismissible = input<boolean>(false);

  /**
   * The accessible name of the close button. Ignored while `dismissible` is
   * false, which is why it has a default instead of being required: making it
   * required would tax every banner that has no button at all.
   */
  readonly dismissLabel = input<string>('');

  /**
   * NOT `(close)`. `close` is a method on `window` and on a `<dialog>`, and
   * the rule of this system is that no public member is named after something
   * native (Nomenclatura). `(dismiss)` says the same thing and collides with
   * nothing.
   *
   * THE BANNER DOES NOT REMOVE ITSELF. It emits, and whoever placed it decides
   * whether it goes away -- because "the user closed it" and "the condition
   * ended" are different facts, and only the consumer knows the second one.
   */
  readonly dismiss = output<void>();

  protected readonly iconSize = FEEDBACK_ICON_SIZE;

  protected readonly iconName = computed(() => FEEDBACK_ICONS[this.variant()]);

  /** `alert` for Danger and Warning, `status` for Success and Info. */
  protected readonly role = computed(() => feedbackRole(this.variant()));

  protected readonly surfaceClasses = computed(() => feedbackSurfaceClasses(this.variant()));

  protected onDismiss(): void {
    this.dismiss.emit();
  }
}
