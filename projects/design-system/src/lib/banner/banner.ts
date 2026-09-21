import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  FEEDBACK_ICON_SIZE,
  FEEDBACK_ICONS,
  feedbackRole,
  feedbackSurfaceClasses,
  type FeedbackVariant,
} from '../feedback/feedback.types';
import { Icon } from '../icon/icon';
import { Button } from '../button/button';

export type { FeedbackVariant } from '../feedback/feedback.types';

/**
 * En el flujo y hasta que lo cierren: para una condición que sigue vigente (el Toast es para
 * lo que acaba de pasar). El icono lleva `label`: el color no es la única señal (WCAG 1.4.1).
 */
@Component({
  selector: 'ewms-banner',
  templateUrl: './banner.html',
  imports: [Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class Banner {
  readonly variant = input<FeedbackVariant>('info');

  /** Ya traducido (ADR 0008). */
  readonly title = input.required<string>();

  readonly description = input<string>('');

  /** Nombre del icono; obligatoria porque es la única pista que no depende del color. */
  readonly severityLabel = input.required<string>();

  readonly dismissible = input<boolean>(false);

  /** Con default: exigirlo gravaría a cada banner sin botón de cierre. */
  readonly dismissLabel = input<string>('');

  /**
   * No es `(close)`, nombre nativo (Nomenclatura). Solo emite: quien lo puso decide si se va,
   * porque solo él sabe si la condición terminó.
   */
  readonly dismiss = output<void>();

  protected readonly iconSize = FEEDBACK_ICON_SIZE;

  protected readonly iconName = computed(() => FEEDBACK_ICONS[this.variant()]);

  protected readonly role = computed(() => feedbackRole(this.variant()));

  protected readonly surfaceClasses = computed(() => feedbackSurfaceClasses(this.variant()));

  protected onDismiss(): void {
    this.dismiss.emit();
  }
}
