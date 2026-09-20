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
 * Donde se pinta la cola. SE MONTA UNA VEZ, en el layout raíz, y en ningún otro
 * lado: un segundo outlet pintaría la misma cola dos veces y le daría al lector de
 * pantalla dos regiones vivas anunciando cada mensaje. No hay guarda en el código
 * -el outlet es barato y la regla la impone dónde se escribe, una línea en el
 * layout del shell y otra en el del showroom-.
 * Las palabras de severidad llegan como entrada: la librería no habla ningún
 * idioma (ADR 0008), y así se traducen una vez y no en cada `show()`.
 */
@Component({
  selector: 'ewms-toast-outlet',
  templateUrl: './toast-outlet.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ToastOutlet {
  /** Las cuatro severidades en palabras, para el nombre accesible de los iconos. El
   * color nunca es la única señal (WCAG 1.4.1), y esta es la otra. */
  readonly severityLabels = input.required<Readonly<Record<FeedbackVariant, string>>>();

  /** Nombra la región viva, para que un lector anuncie DE DÓNDE vino el mensaje y
   * no solo qué dice. */
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
   * `Escape` cierra el mensaje más reciente. EN EL DOCUMENTO, porque un toast nunca
   * tiene el foco -no es parada de tabulación y no puede robárselo a lo que el
   * operario está haciendo-, así que no hay elemento al que la tecla pueda llegar.
   * Un evento que alguien ya atendió se deja en paz: el diálogo del CDK y el Select
   * responden `Escape` y lo marcan, y sin esta comprobación cerrar un diálogo se
   * comería además el mensaje de atrás.
   */
  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (event.defaultPrevented) {
      return;
    }
    this.toastService.dismissLatest();
  }
}
