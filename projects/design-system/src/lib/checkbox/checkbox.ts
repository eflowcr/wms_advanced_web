import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import { Icon } from '../icon/icon';
import {
  SELECTION_BORDER_WIDTH,
  SELECTION_CONTROL_BASE_CLASSES,
  SELECTION_GLYPH_CLASSES,
  SELECTION_ROW_CLASSES,
  selectionBoxClasses,
  selectionRowStateClasses,
} from '../selection/selection.types';

/**
 * Casilla de 18x18: selección que el formulario confirma después; un toggle aplica al tocar
 * (Ver vault: Toggle). El input nativo se conserva: rol, teclado, foco y nombre salen gratis.
 */
@Component({
  selector: 'ewms-checkbox',
  templateUrl: './checkbox.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  providers: [provideValueAccessor(() => Checkbox)],
})
export class Checkbox extends FormControlBase<boolean> {
  readonly checked = input<boolean>(false);

  /** «Seleccionar todo» a medias. Gana sobre `checked` por ser la afirmación más específica. */
  readonly indeterminate = input<boolean>(false);

  /** Opcional, pero `label` o `ariaLabel` tiene que estar: sin nombre falla axe. */
  readonly label = input<string>('');

  /** Sin texto visible, como en una columna de casillas: el nombre dice cuál fila. */
  readonly ariaLabel = input<string>('');

  /** No `change`: el nativo burbujea y el handler correría dos veces. Ver vault: Checkbox-Radio. */
  readonly checkedChange = output<boolean>();

  protected readonly valueSource = this.checked;

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  protected readonly rowClasses = computed(
    () => `${SELECTION_ROW_CLASSES} ${selectionRowStateClasses(this.isDisabled())}`,
  );

  protected readonly borderWidth = SELECTION_BORDER_WIDTH;

  protected readonly isOn = computed(() => this.indeterminate() || this.controlValue());

  protected readonly boxClasses = computed(
    () =>
      // La esquina es lo único de la caja que el radio no comparte.
      `${SELECTION_CONTROL_BASE_CLASSES} rounded-sm ` +
      selectionBoxClasses(this.isOn(), this.isDisabled()),
  );

  protected readonly glyphClasses = SELECTION_GLYPH_CLASSES;

  /** `mixed`: entre marcado e indeterminado solo cambia el glifo, y quien no ve lo saca de acá. */
  protected readonly ariaChecked = computed(() => {
    if (this.indeterminate()) {
      return 'mixed';
    }
    return this.controlValue() ? 'true' : 'false';
  });

  constructor() {
    super();

    // `indeterminate` solo existe como propiedad del DOM: en la plantilla sería un atributo
    // desconocido que falla en silencio. Effect, porque la entrada cambia en vida.
    effect(() => {
      this.box().nativeElement.indeterminate = this.indeterminate();
    });
  }

  /**
   * El `change` nativo se frena: el `<input>` es un detalle interno. `indeterminate` no se
   * limpia: solo el consumidor sabe si el clic lo resolvió.
   */
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
