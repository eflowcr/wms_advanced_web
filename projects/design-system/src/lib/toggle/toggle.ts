import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import type { FormCheckboxControl, ValidationError } from '@angular/forms/signals';
import { fieldErrorText, fieldNoteId } from '../forms/field-note';
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
})
export class Toggle implements FormCheckboxControl {
  /** Con `[formField]` lo llena el formulario; fuera de uno, `[(checked)]`. */
  readonly checked = model<boolean>(false);

  readonly label = input<string>('');

  readonly ariaLabel = input<string>('');

  // Del contrato `FormCheckboxControl`: el `[formField]` las llena solo.
  readonly errors = input<readonly ValidationError[]>([]);
  readonly invalid = input<boolean>(false);
  readonly touched = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  /** Al perder el foco, nunca al ganarlo: el formulario marca «tocado» con esto. */
  readonly touch = output<void>();

  /** `checkedChange` no se declara: lo emite `model()`. */
  protected readonly noteId = fieldNoteId('ewms-toggle');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly showError = computed(() => this.invalid() && this.touched());

  protected readonly fieldError = fieldErrorText(this.errors, this.showError);

  /** El blanco es la fila: 44x24 es difícil de acertar con guantes en una tablet. */
  protected readonly rowClasses = computed(
    () => `${SELECTION_ROW_CLASSES} ${selectionRowStateClasses(this.disabled())}`,
  );

  /** La pista es el input nativo; deshabilitado va sin hover. */
  protected readonly trackClasses = computed(() => {
    const base =
      'appearance-none relative shrink-0 w-11 h-6 rounded-full outline-none ' +
      'focus-visible:shadow-(--focus-ring-shadow)';

    if (this.disabled()) {
      return `${base} ${this.checked() ? 'bg-(--color-bg-primary-disabled)' : 'bg-secondary'}`;
    }
    return this.checked()
      ? `${base} bg-primary hover:bg-(--color-bg-primary-hover)`
      : `${base} bg-(--color-border-strong) hover:bg-(--color-border-strong-hover)`;
  });

  /** 20x20 a 2 px del borde (2 + 20 + 2 = 24); 20 px de recorrido. */
  protected readonly thumbClasses = computed(
    () =>
      'absolute top-0.5 left-0.5 size-5 rounded-full pointer-events-none ' +
      'bg-(--color-text-on-primary) ' +
      (this.checked() ? 'translate-x-5' : 'translate-x-0'),
  );


  /**
   * Del contrato `FormUiControl`: el control real y no el host, que no es enfocable. De acá entra
   * el foco cuando el resumen de errores llama a `focusBoundControl()`.
   */
  focus(options?: FocusOptions): void {
    this.host.nativeElement.querySelector<HTMLElement>('input')?.focus(options);
  }
  /** Se frena como en `Checkbox`: el `<input>` es un detalle interno. */
  protected onNativeChange(event: Event): void {
    event.stopPropagation();
    this.checked.set((event.target as HTMLInputElement).checked);
  }

  protected onBlur(): void {
    this.touch.emit();
  }
}
