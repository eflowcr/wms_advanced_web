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
import type { FormValueControl, ValidationError } from '@angular/forms/signals';
import { fieldErrorText, fieldNoteId } from '../forms/field-note';

let nextRadioGroupId = 0;

/**
 * El campo que eligen los radios: `fieldset` con `legend`, una sola parada de Tab y flechas que
 * mueven y eligen. Las tres cosas las da el navegador con radios nativos que comparten `name`
 * (APG *radio group*); acá vive el valor, el nombre del grupo y el mensaje. Ver vault:
 * Checkbox-Radio.
 */
@Component({
  selector: 'ewms-radio-group',
  templateUrl: './radio-group.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class RadioGroup implements FormValueControl<unknown> {
  /** Con `[formField]` lo llena el formulario; fuera de uno, `[(value)]`. */
  readonly value = model<unknown>(null);

  /** El `legend`: el grupo es lo que tiene nombre, no cada opción. */
  readonly label = input.required<string>();

  /** Para lectores solamente, cuando la página ya escribió el nombre encima. */
  readonly hideLabel = input<boolean>(false);

  readonly hint = input<string>('');

  // Del contrato `FormValueControl`: el `[formField]` las llena solo.
  readonly errors = input<readonly ValidationError[]>([]);
  readonly invalid = input<boolean>(false);
  readonly touched = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  /** El `name` que comparten los radios nativos; sin él, uno propio de esta instancia. */
  readonly name = input<string>('');

  /** Al perder el foco, nunca al ganarlo: el formulario marca «tocado» con esto. */
  readonly touch = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly fallbackName = `ewms-radio-group-${++nextRadioGroupId}`;
  protected readonly noteId = fieldNoteId('ewms-radio-group');

  /** Lo leen los `ewms-radio`: sin un `name` compartido cada uno sería su propio grupo. */
  readonly groupName = computed(() => this.name() || this.fallbackName);

  /** Se valida al salir del grupo y al enviar, nunca al mover las flechas. */
  protected readonly showError = computed(() => this.invalid() && this.touched());

  protected readonly fieldError = fieldErrorText(this.errors, this.showError);

  /** El mensaje del validador reemplaza al hint, como en el Input. */
  protected readonly note = computed(() => this.fieldError() || this.hint());

  protected readonly describedBy = computed(() => (this.note() ? this.noteId : null));

  /**
   * Del contrato `FormUiControl`: el radio marcado, o el primero elegible —la misma parada de Tab
   * que elige el navegador—. De acá entra el foco desde el resumen de errores.
   */
  focus(options?: FocusOptions): void {
    const radios = this.host.nativeElement;
    const target =
      radios.querySelector<HTMLElement>('input:checked:not(:disabled)') ??
      radios.querySelector<HTMLElement>('input:not(:disabled)');
    target?.focus(options);
  }

  /** La opción se suma con O: el grupo deshabilitado apaga a todas. */
  memberDisabled(ownDisabled: boolean): boolean {
    return this.disabled() || ownDisabled;
  }

  select(optionValue: unknown): void {
    if (this.disabled()) {
      return;
    }
    this.value.set(optionValue);
  }

  markTouched(): void {
    this.touch.emit();
  }
}
