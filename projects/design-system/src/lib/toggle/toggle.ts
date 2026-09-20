import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import { SELECTION_ROW_CLASSES, selectionRowStateClasses } from '../selection/selection.types';

/**
 * Un interruptor: 44x24, encendido o apagado, aplicado al instante.
 *
 * TOGGLE O CHECKBOX, la confusión más común de esta librería, y no es cómo se
 * ven: un toggle ES ACCIÓN INMEDIATA -no hay Guardar porque no queda nada que
 * guardar- y una casilla es una SELECCIÓN DENTRO DE UN FORMULARIO. Equivocarse
 * deja una preferencia ya aplicada con un Guardar que sugiere que no.
 * `role="switch"` y NUNCA `role="checkbox"`: una casilla se anuncia
 * «marcada/no marcada» y un interruptor «encendido/apagado». Abajo sigue siendo
 * un input de casilla, porque el rol era lo único que había que cambiar.
 * SIN TRANSICIÓN EN EL PULGAR: no hay token de duración y ADR 0009 borró el de
 * Tailwind, así que una utilidad de animación compilaría a cero fingiendo que no.
 */
@Component({
  selector: 'ewms-toggle',
  templateUrl: './toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  providers: [provideValueAccessor(() => Toggle)],
})
export class Toggle extends FormControlBase<boolean> {
  readonly checked = input<boolean>(false);

  /** El texto visible al lado del interruptor, ya traducido. */
  readonly label = input<string>('');

  /** El nombre accesible donde no hay lugar para texto visible. */
  readonly ariaLabel = input<string>('');

  readonly checkedChange = output<boolean>();

  protected readonly valueSource = this.checked;

  /**
   * El blanco es la FILA y no la pista: 44x24 es difícil de acertar con un dedo
   * enguantado sobre una tablet, que es donde se usa este control. Un `<label>`
   * que envuelve al input da la fila entera, texto incluido, gratis.
   */
  protected readonly rowClasses = computed(
    () => `${SELECTION_ROW_CLASSES} ${selectionRowStateClasses(this.isDisabled())}`,
  );

  /** La pista, que es el propio input nativo. Deshabilitado va primero y sin
   * hover: un interruptor que no se puede mover no se enciende bajo el puntero. */
  protected readonly trackClasses = computed(() => {
    const base =
      'appearance-none relative shrink-0 w-11 h-6 rounded-full outline-none ' +
      'focus-visible:shadow-(--focus-ring-shadow)';

    if (this.isDisabled()) {
      return `${base} ${this.controlValue() ? 'bg-(--color-bg-primary-disabled)' : 'bg-secondary'}`;
    }
    return this.controlValue()
      ? `${base} bg-primary hover:bg-(--color-bg-primary-hover)`
      : `${base} bg-(--color-border-strong) hover:bg-(--color-border-strong-hover)`;
  });

  /** El pulgar: 20x20 metido 2 px. 2 + 20 + 2 son los 24 px de alto de la pista, y
   * 20 px de recorrido lo dejan a los mismos 2 px del borde opuesto. */
  protected readonly thumbClasses = computed(
    () =>
      'absolute top-0.5 left-0.5 size-5 rounded-full pointer-events-none ' +
      'bg-(--color-text-on-primary) ' +
      (this.controlValue() ? 'translate-x-5' : 'translate-x-0'),
  );

  /** El `change` nativo se frena adentro, por lo mismo que en `Checkbox`: este
   * control publica `checkedChange` y el `<input>` de abajo es un detalle. */
  protected onNativeChange(event: Event): void {
    event.stopPropagation();
    const value = (event.target as HTMLInputElement).checked;
    this.commit(value);
    this.checkedChange.emit(value);
  }

  protected onBlur(): void {
    this.markTouched();
  }
}
