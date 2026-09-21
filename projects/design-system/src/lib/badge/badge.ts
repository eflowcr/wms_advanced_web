import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { familyBoxClasses, familyIcon, type SemanticFamily } from '../feedback/feedback.types';
import { Icon } from '../icon/icon';

/**
 * Siempre icono y texto (WCAG 1.4.1): `label` obligatoria, sin modo solo-icono. Neutral usa
 * surface + text: el solid neutral llega apenas a 4.19:1 (Fundamentos de Marca).
 */
@Component({
  selector: 'ewms-badge',
  templateUrl: './badge.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class Badge {
  /** Por familia de color, no por vocabulario de mensaje: nadie dice «una fila info». */
  readonly variant = input<SemanticFamily>('neutral');

  /** Ya traducida (ADR 0008). */
  readonly label = input.required<string>();

  protected readonly boxClasses = computed(() => familyBoxClasses(this.variant()));

  protected readonly iconName = computed(() => familyIcon(this.variant()));
}
