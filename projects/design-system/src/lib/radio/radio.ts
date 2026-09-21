import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import {
  SELECTION_BORDER_WIDTH,
  SELECTION_CONTROL_BASE_CLASSES,
  SELECTION_GLYPH_CLASSES,
  SELECTION_ROW_CLASSES,
  selectionBoxClasses,
  selectionRowStateClasses,
} from '../selection/selection.types';

/**
 * Como `ewms-checkbox`, con círculo y punto. Agrupa el navegador por `name`. `value` es lo
 * que aporta esta opción, no el valor del grupo: por eso `checked` se deriva.
 */
@Component({
  selector: 'ewms-radio',
  templateUrl: './radio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  providers: [provideValueAccessor(() => Radio)],
})
export class Radio extends FormControlBase<unknown> {
  readonly value = input.required<unknown>();

  /** Sin `name` compartido sale un radio que se enciende y nunca se apaga. */
  readonly name = input.required<string>();

  readonly label = input<string>('');

  readonly ariaLabel = input<string>('');

  /** No se llama `change`, como en `Checkbox.checkedChange`. */
  readonly valueChange = output<unknown>();

  /** Nada la siembra: `value` es la identidad de la opción, no el valor del grupo. */
  protected readonly valueSource = signal<unknown>(null);

  /** Derivado, nunca guardado: dos fuentes de verdad dejan un grupo con dos puntos. */
  protected readonly isChecked = computed(() => this.controlValue() === this.value());

  protected readonly rowClasses = computed(
    () => `${SELECTION_ROW_CLASSES} ${selectionRowStateClasses(this.isDisabled())}`,
  );

  protected readonly borderWidth = SELECTION_BORDER_WIDTH;

  protected readonly boxClasses = computed(
    () =>
      `${SELECTION_CONTROL_BASE_CLASSES} rounded-full ` +
      selectionBoxClasses(this.isChecked(), this.isDisabled()),
  );

  protected readonly glyphClasses = SELECTION_GLYPH_CLASSES;

  /** Se frena como en el Checkbox: el `<input>` es un detalle interno. */
  protected onNativeChange(event: Event): void {
    event.stopPropagation();
    this.commit(this.value());
    this.valueChange.emit(this.value());
  }

  protected onBlur(): void {
    this.markTouched();
  }
}
