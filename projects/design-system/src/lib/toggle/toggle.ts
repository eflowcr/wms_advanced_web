import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import { SELECTION_ROW_CLASSES, selectionRowStateClasses } from '../selection/selection.types';

/**
 * Interruptor de 44x24 que aplica al instante; una casilla es selección a confirmar. Ver vault:
 * Toggle. `role="switch"` para anunciar encendido/apagado. Sin transición: no hay token (ADR 0009).
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

  readonly label = input<string>('');

  readonly ariaLabel = input<string>('');

  readonly checkedChange = output<boolean>();

  protected readonly valueSource = this.checked;

  /** El blanco es la fila: 44x24 es difícil de acertar con guantes en una tablet. */
  protected readonly rowClasses = computed(
    () => `${SELECTION_ROW_CLASSES} ${selectionRowStateClasses(this.isDisabled())}`,
  );

  /** La pista es el input nativo; deshabilitado va sin hover. */
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

  /** 20x20 a 2 px del borde (2 + 20 + 2 = 24); 20 px de recorrido. */
  protected readonly thumbClasses = computed(
    () =>
      'absolute top-0.5 left-0.5 size-5 rounded-full pointer-events-none ' +
      'bg-(--color-text-on-primary) ' +
      (this.controlValue() ? 'translate-x-5' : 'translate-x-0'),
  );

  /** Se frena como en `Checkbox`: el `<input>` es un detalle interno. */
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
