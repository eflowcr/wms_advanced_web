import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  SELECTION_BORDER_WIDTH,
  SELECTION_CONTROL_BASE_CLASSES,
  SELECTION_GLYPH_CLASSES,
  SELECTION_ROW_CLASSES,
  selectionBoxClasses,
  selectionRowStateClasses,
} from '../selection/selection.types';
import { RadioGroup } from './radio-group';

/**
 * Una opción de `ewms-radio-group`, con la caja de `ewms-checkbox` en círculo. `value` es lo que
 * aporta esta opción, no el valor del grupo: por eso `checked` se deriva y no se guarda.
 */
@Component({
  selector: 'ewms-radio',
  templateUrl: './radio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class Radio {
  readonly value = input.required<unknown>();

  readonly label = input<string>('');

  readonly ariaLabel = input<string>('');

  /** La del grupo se suma con O, nunca se resta. */
  readonly disabled = input<boolean>(false);

  /** Sin `optional`: un radio fuera de un grupo se enciende y nunca se apaga. */
  private readonly group = inject(RadioGroup);

  protected readonly name = this.group.groupName;
  protected readonly required = this.group.required;

  /** Derivado, nunca guardado: dos fuentes de verdad dejan un grupo con dos puntos. */
  protected readonly isChecked = computed(() => this.group.value() === this.value());

  protected readonly isDisabled = computed(() => this.group.memberDisabled(this.disabled()));

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
    this.group.select(this.value());
  }

  protected onBlur(): void {
    this.group.markTouched();
  }
}
