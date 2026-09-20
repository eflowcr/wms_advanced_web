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
 * Una opción entre varias. Misma caja de 18x18, mismo borde, mismo anillo y misma
 * fila-como-blanco que `ewms-checkbox`; un círculo en vez de un cuadrado y un
 * punto en vez de un tilde.
 * EL AGRUPAMIENTO ES EL NATIVO: los radios que comparten `name` se excluyen porque
 * lo hace el navegador, antes de que corra código de Angular. Por eso `name` es
 * obligatorio: un radio sin él es un grupo de uno, o sea una casilla que no se
 * puede apagar.
 * EL VALOR DEL GRUPO NO ES EL `value` DE ESTE COMPONENTE: `value` es lo que aporta
 * ESTA opción al ser la elegida, y por eso `checked` se deriva y no es entrada.
 */
@Component({
  selector: 'ewms-radio',
  templateUrl: './radio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  providers: [provideValueAccessor(() => Radio)],
})
export class Radio extends FormControlBase<unknown> {
  /** En qué se convierte el valor del grupo cuando se elige esta opción. */
  readonly value = input.required<unknown>();

  /** El grupo. Obligatorio: el `name` compartido ES el agrupamiento, y sin él sale
   * un radio que se puede encender y nunca apagar. */
  readonly name = input.required<string>();

  /** Texto visible al lado del punto, ya traducido. */
  readonly label = input<string>('');

  /** El nombre accesible cuando no hay texto visible. */
  readonly ariaLabel = input<string>('');

  /**
   * NO se llama `change`: es un nombre de evento nativo, burbujea, y una salida que
   * lo comparta entrega este valor Y el Event crudo en el mismo enlace. Ver el
   * comentario de `Checkbox.checkedChange`.
   */
  readonly valueChange = output<unknown>();

  /** La base se siembra del valor del componente, salvo acá: `value` es la
   * identidad de esta opción y no el valor del grupo. Nada la siembra. */
  protected readonly valueSource = signal<unknown>(null);

  /** Derivado, nunca guardado: dos fuentes de verdad para «¿es esta la elegida?»
   * es cómo un grupo de radios termina con dos puntos. */
  protected readonly isChecked = computed(() => this.controlValue() === this.value());

  protected readonly rowClasses = computed(
    () => `${SELECTION_ROW_CLASSES} ${selectionRowStateClasses(this.isDisabled())}`,
  );

  protected readonly borderWidth = SELECTION_BORDER_WIDTH;

  protected readonly boxClasses = computed(
    () =>
      // La única diferencia visual con la casilla: un círculo entero.
      `${SELECTION_CONTROL_BASE_CLASSES} rounded-full ` +
      selectionBoxClasses(this.isChecked(), this.isDisabled()),
  );

  protected readonly glyphClasses = SELECTION_GLYPH_CLASSES;

  /** El `change` nativo se frena por lo mismo que en el Checkbox: el `<input>` es
   * un detalle y sus eventos no son parte de la API. */
  protected onNativeChange(event: Event): void {
    event.stopPropagation();
    this.commit(this.value());
    this.valueChange.emit(this.value());
  }

  protected onBlur(): void {
    this.markTouched();
  }
}
