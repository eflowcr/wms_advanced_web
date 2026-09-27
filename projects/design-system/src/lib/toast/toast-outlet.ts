import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
} from '@angular/core';
import { Button } from '../button/button';
import {
  FEEDBACK_ICON_SIZE,
  FEEDBACK_ICONS,
  feedbackAccentClasses,
  feedbackSurfaceClasses,
  type FeedbackVariant,
} from '../feedback/feedback.types';
import { Icon } from '../icon/icon';
import { Viewport } from '../navigation/viewport';
import { ToastService } from './toast.service';
import {
  TOAST_BODY_CLASSES,
  TOAST_CLASSES,
  TOAST_OUTLET_CLASSES,
  TOAST_OUTLET_COMPACT_CLASSES,
  TOAST_OUTLET_WIDE_CLASSES,
  type Toast,
} from './toast.types';

export type { Toast } from './toast.types';

/**
 * Se monta una vez, en el layout raíz: dos serían dos regiones vivas. No hay guarda en código.
 * La severidad llega como entrada (ADR 0008): se traduce una vez, no en cada `show()`.
 */
@Component({
  selector: 'ewms-toast-outlet',
  templateUrl: './toast-outlet.html',
  imports: [Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ToastOutlet {
  /** Nombre de los iconos: el color nunca es la única señal (WCAG 1.4.1). */
  readonly severityLabels = input.required<Readonly<Record<FeedbackVariant, string>>>();

  /** Para que un lector diga de dónde vino el mensaje, no solo qué dice. */
  readonly regionLabel = input.required<string>();

  /** Nombre del botón de cerrar de cada mensaje, como el `dismissLabel` del Banner. */
  readonly dismissLabel = input.required<string>();

  private readonly toastService = inject(ToastService);
  private readonly viewport = inject(Viewport);

  private hovered = false;
  private focused = false;

  protected readonly toasts = this.toastService.toasts;
  protected readonly iconSize = FEEDBACK_ICON_SIZE;
  protected readonly toastClasses = TOAST_CLASSES;
  protected readonly bodyClasses = TOAST_BODY_CLASSES;

  /** Bajo el corte de la barra inferior, la pila sube por encima de ella. */
  protected readonly outletClasses = computed(
    () =>
      `${TOAST_OUTLET_CLASSES} ${this.viewport.isWide() ? TOAST_OUTLET_WIDE_CLASSES : TOAST_OUTLET_COMPACT_CLASSES}`,
  );

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

  /** Entrar y salir de la región: pasar de un toast a otro no la suelta. */
  protected onPointerEnter(): void {
    this.hovered = true;
    this.hold();
  }

  protected onPointerLeave(): void {
    this.hovered = false;
    this.hold();
  }

  protected onFocusIn(): void {
    this.focused = true;
    this.hold();
  }

  protected onFocusOut(event: FocusEvent): void {
    if (!inside(event)) {
      this.focused = false;
      this.hold();
    }
  }

  /** El botón se va con su mensaje y el navegador no avisa que el foco salió: se suelta a mano. */
  protected close(toast: Toast): void {
    this.toastService.dismiss(toast.id);
    this.hovered = false;
    this.focused = false;
    this.hold();
  }

  /**
   * En el documento: cierra el más reciente esté donde esté el foco. Un Escape ya atendido
   * (diálogo, Select) se ignora: si no, cerrar un diálogo se comería también el mensaje.
   */
  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (event.defaultPrevented) {
      return;
    }
    const latest = this.toasts().at(-1);
    this.toastService.dismissLatest();
    // Con el foco en el que se fue, el foco salió de la pila aunque el navegador no lo diga.
    if (latest !== undefined && withinToast(event.target, latest)) {
      this.focused = false;
      this.hold();
    }
  }

  private hold(): void {
    if (this.hovered || this.focused) {
      this.toastService.pause();
    } else {
      this.toastService.resume();
    }
  }
}

/** Si el foco se movió a otro lugar de la misma pila. */
function inside(event: FocusEvent): boolean {
  const region = event.currentTarget;
  const next = event.relatedTarget;
  return region instanceof Node && next instanceof Node && region.contains(next);
}

function withinToast(target: EventTarget | null, toast: Toast): boolean {
  return target instanceof Element && target.closest(`[data-toast="${toast.id}"]`) !== null;
}
