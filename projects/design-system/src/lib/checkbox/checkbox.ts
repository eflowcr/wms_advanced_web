import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import type { FormCheckboxControl, ValidationError } from '@angular/forms/signals';
import { fieldErrorText, fieldNoteId } from '../forms/field-note';
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
})
export class Checkbox implements FormCheckboxControl {
  /** Con `[formField]` lo llena el formulario; fuera de uno, `[(checked)]`. */
  readonly checked = model<boolean>(false);

  /** «Seleccionar todo» a medias. Gana sobre `checked` por ser la afirmación más específica. */
  readonly indeterminate = input<boolean>(false);

  /** Opcional, pero `label` o `ariaLabel` tiene que estar: sin nombre falla axe. */
  readonly label = input<string>('');

  /** Sin texto visible, como en una columna de casillas: el nombre dice cuál fila. */
  readonly ariaLabel = input<string>('');

  // Del contrato `FormCheckboxControl`: el `[formField]` las llena solo.
  readonly errors = input<readonly ValidationError[]>([]);
  readonly invalid = input<boolean>(false);
  readonly touched = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  /** Al perder el foco, nunca al ganarlo: el formulario marca «tocado» con esto. */
  readonly touch = output<void>();

  /** `checkedChange` no se declara: lo emite `model()`. Ver vault: Checkbox-Radio. */
  protected readonly noteId = fieldNoteId('ewms-checkbox');

  /** Se valida al salir del campo y al enviar, nunca mientras se marca. */
  protected readonly showError = computed(() => this.invalid() && this.touched());

  protected readonly fieldError = fieldErrorText(this.errors, this.showError);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  protected readonly rowClasses = computed(
    () => `${SELECTION_ROW_CLASSES} ${selectionRowStateClasses(this.disabled())}`,
  );

  protected readonly borderWidth = SELECTION_BORDER_WIDTH;

  protected readonly isOn = computed(() => this.indeterminate() || this.checked());

  protected readonly boxClasses = computed(
    () =>
      // La esquina es lo único de la caja que el radio no comparte.
      `${SELECTION_CONTROL_BASE_CLASSES} rounded-sm ` +
      selectionBoxClasses(this.isOn(), this.disabled()),
  );

  protected readonly glyphClasses = SELECTION_GLYPH_CLASSES;

  /** `mixed`: entre marcado e indeterminado solo cambia el glifo, y quien no ve lo saca de acá. */
  protected readonly ariaChecked = computed(() => {
    if (this.indeterminate()) {
      return 'mixed';
    }
    return this.checked() ? 'true' : 'false';
  });

  constructor() {
    // `indeterminate` solo existe como propiedad del DOM: en la plantilla sería un atributo
    // desconocido que falla en silencio. Effect, porque la entrada cambia en vida.
    effect(() => {
      this.box().nativeElement.indeterminate = this.indeterminate();
    });
  }


  /**
   * Del contrato `FormUiControl`: el control real y no el host, que no es enfocable. De acá entra
   * el foco cuando el resumen de errores llama a `focusBoundControl()`.
   */
  focus(options?: FocusOptions): void {
    this.host.nativeElement.querySelector<HTMLElement>('input')?.focus(options);
  }
  /**
   * El `change` nativo se frena: el `<input>` es un detalle interno. `indeterminate` no se
   * limpia: solo el consumidor sabe si el clic lo resolvió.
   */
  protected onNativeChange(event: Event): void {
    event.stopPropagation();
    this.checked.set((event.target as HTMLInputElement).checked);
  }

  protected onBlur(): void {
    this.touch.emit();
  }
}
