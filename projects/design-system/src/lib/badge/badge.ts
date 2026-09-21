import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { familyBoxClasses, familyIcon, type SemanticFamily } from '../feedback/feedback.types';
import { Icon } from '../icon/icon';

/**
 * Una etiqueta chica que dice en qué estado está algo.
 *
 * NACIÓ DENTRO DE LA TABLA Y A PROPÓSITO NO VIVE AHÍ: nada de esto tiene forma de
 * tabla, y un detalle, una card y una fila de lista tienen que decir «con
 * incidencia» igual.
 * SIEMPRE ICONO Y TEXTO: el color nunca es la única señal (WCAG 1.4.1), y acá no
 * hay lugar para una segunda línea, así que el texto es la etiqueta y el icono va
 * decorativo al lado. Por eso `label` es obligatoria y no hay modo solo-icono.
 * `Badge/Neutral` usa surface + text y no solid + blanco, porque el solid neutral
 * llega apenas a 4.19:1 (Fundamentos de Marca).
 */
@Component({
  selector: 'ewms-badge',
  templateUrl: './badge.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class Badge {
  /** Cuál de las cuatro. Nombrada por la FAMILIA DE COLOR y no por un vocabulario
   * de mensaje: nadie dice «una fila info». */
  readonly variant = input<SemanticFamily>('neutral');

  /** Las palabras. Obligatorias y ya traducidas (ADR 0008). */
  readonly label = input.required<string>();

  protected readonly boxClasses = computed(() => familyBoxClasses(this.variant()));

  protected readonly iconName = computed(() => familyIcon(this.variant()));
}
