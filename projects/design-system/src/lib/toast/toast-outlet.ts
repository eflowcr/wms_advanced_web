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
import { TOAST_BODY_CLASSES, TOAST_CLASSES, TOAST_OUTLET_CLASSES, type Toast } from './toast.types';

export type { Toast } from './toast.types';

/**
 * Se monta una vez, en el layout raíz: dos serían dos regiones vivas. No hay guarda en código.
 * La severidad llega como entrada (ADR 0008): se traduce una vez, no en cada `show()`.
 */
@Component({
  selector: 'ewms-toast-outlet',
  templateUrl: './toast-outlet.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ToastOutlet {
  /** Nombre de los iconos: el color nunca es la única señal (WCAG 1.4.1). */
  readonly severityLabels = input.required<Readonly<Record<FeedbackVariant, string>>>();

  /** Para que un lector diga de dónde vino el mensaje, no solo qué dice. */
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
   * En el documento, porque un toast nunca tiene el foco. Un Escape ya atendido (diálogo,
   * Select) se ignora: si no, cerrar un diálogo se comería también el mensaje.
   */
  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (event.defaultPrevented) {
      return;
    }
    this.toastService.dismissLatest();
  }
}
