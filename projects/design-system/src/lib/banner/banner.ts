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
 * Un mensaje en línea que se queda hasta que alguien lo cierra.
 *
 * VIVE EN EL FLUJO Y NO HACE NINGUNA CAPA: esa es toda la diferencia con el Toast y
 * lo que decide cuál usar. Un banner empuja el layout y se queda, así que es para
 * una condición que sigue siendo cierta; un toast flota, se va solo, y es para algo
 * que acaba de pasar.
 * El icono sale de la variante y lleva `label`, porque el color no puede ser la
 * única señal (WCAG 1.4.1).
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

  /** El titular, ya traducido por el consumidor (ADR 0008). */
  readonly title = input.required<string>();

  /** Segunda línea opcional. Un banner de una línea es un banner legítimo. */
  readonly description = input<string>('');

  /**
   * La severidad en palabras, para el nombre accesible del icono. OBLIGATORIA en el
   * tipo, como el `label` del Icon Button y por lo mismo: es la única pista que no
   * depende de ver el color, así que un valor por defecto vaciaría la garantía.
   */
  readonly severityLabel = input.required<string>();

  readonly dismissible = input<boolean>(false);

  /** El nombre accesible del botón de cierre. Se ignora con `dismissible` en false,
   * y por eso tiene default en vez de ser obligatorio: exigirlo gravaría a cada
   * banner que no lleva botón. */
  readonly dismissLabel = input<string>('');

  /**
   * NO es `(close)`: `close` es un método de `window` y de `<dialog>`, y la regla es
   * que ningún miembro público se llame como algo nativo (Nomenclatura).
   * EL BANNER NO SE SACA SOLO DE LA PANTALLA: emite, y quien lo puso decide si se
   * va, porque «la persona lo cerró» y «la condición terminó» son hechos distintos
   * y solo el consumidor conoce el segundo.
   */
  readonly dismiss = output<void>();

  protected readonly iconSize = FEEDBACK_ICON_SIZE;

  protected readonly iconName = computed(() => FEEDBACK_ICONS[this.variant()]);

  /** `alert` para Danger y Warning, `status` para Success e Info. */
  protected readonly role = computed(() => feedbackRole(this.variant()));

  protected readonly surfaceClasses = computed(() => feedbackSurfaceClasses(this.variant()));

  protected onDismiss(): void {
    this.dismiss.emit();
  }
}
