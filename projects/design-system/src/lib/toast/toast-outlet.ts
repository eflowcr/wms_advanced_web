import { ChangeDetectionStrategy, Component, HostListener, inject, input } from '@angular/core';
import {
  FEEDBACK_ICON_SIZE,
  FEEDBACK_ICONS,
  feedbackAccentClasses,
  feedbackSurfaceClasses,
  type FeedbackVariant,
} from '../feedback/feedback.types';
import { Icon } from '../icon/icon';
import { ToastService } from './toast.service';
import {
  TOAST_BODY_CLASSES,
  TOAST_CLASSES,
  TOAST_OUTLET_CLASSES,
  type Toast,
} from './toast.types';

export type { Toast } from './toast.types';

/**
 * Where the queue is drawn. MOUNTED ONCE, in the root layout, and nowhere else.
 *
 * A second outlet would render the same queue twice and give the screen reader
 * two live regions announcing every message -- which is the failure mode the
 * single-region rule exists to prevent. There is no guard in the code for it:
 * the outlet is cheap and the rule is enforced by where it is written, in the
 * shell's layout and the showroom's, one line each.
 *
 * The severity words arrive as an input rather than being built here, for the
 * usual reason: the design system speaks no language (ADR 0008). They are
 * translated once, at the one place the outlet is mounted, instead of at every
 * `show()` call.
 */
@Component({
  selector: 'ewms-toast-outlet',
  templateUrl: './toast-outlet.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ToastOutlet {
  /**
   * The four severities in words, for the icons' accessible names. The colour
   * is never the only signal (WCAG 1.4.1), and this is the other one.
   */
  readonly severityLabels = input.required<Readonly<Record<FeedbackVariant, string>>>();

  /**
   * Names the live region, so a screen reader announces WHERE the message came
   * from and not only what it says.
   */
  readonly regionLabel = input.required<string>();

  private readonly toastService = inject(ToastService);

  protected readonly toasts = this.toastService.toasts;
  protected readonly iconSize = FEEDBACK_ICON_SIZE;
  protected readonly outletClasses = TOAST_OUTLET_CLASSES;
  protected readonly toastClasses = TOAST_CLASSES;
  protected readonly bodyClasses = TOAST_BODY_CLASSES;

  protected iconName(toast: Toast) {
    return FEEDBACK_ICONS[toast.variant];
  }

  protected surfaceClasses(toast: Toast): string {
    return feedbackSurfaceClasses(toast.variant);
  }

  protected accentClasses(toast: Toast): string {
    return feedbackAccentClasses(toast.variant);
  }

  protected severityLabel(toast: Toast): string {
    return this.severityLabels()[toast.variant];
  }

  /**
   * `Escape` closes the most recent message.
   *
   * ON THE DOCUMENT, because a toast is never focused: it is not a tab stop
   * and it must not steal the focus from what the operator is doing, so there
   * is no element for the key to arrive at. The listener is the only way the
   * key can reach the queue at all.
   *
   * An event somebody already handled is left alone. The CDK's dialog and the
   * Select both answer `Escape` and mark it handled; without this check,
   * closing a dialog would also silently eat the message behind it.
   */
  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (event.defaultPrevented) {
      return;
    }
    this.toastService.dismissLatest();
  }
}
