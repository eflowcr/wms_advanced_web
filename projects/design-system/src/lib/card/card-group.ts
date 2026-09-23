import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import type { FormValueControl, ValidationError } from '@angular/forms/signals';
import { fieldErrorText, fieldNoteId } from '../forms/field-note';
import type { CardGroupMember } from './card.types';

/**
 * Un grupo de radios que parece cards: un solo tab stop, se entra por la elegida y mueven
 * las flechas. Un tab stop por card sumaría paradas camino a Guardar.
 */
@Component({
  selector: 'ewms-card-group',
  templateUrl: './card-group.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CardGroup implements FormValueControl<unknown> {
  /** Con `[formField]` lo llena el formulario; fuera de uno, `[(value)]`. */
  readonly value = model<unknown>(null);

  /** Obligatorio, como el nombre de cualquier control. */
  readonly label = input.required<string>();

  readonly hint = input<string>('');

  // Del contrato `FormValueControl`: el `[formField]` las llena solo.
  readonly errors = input<readonly ValidationError[]>([]);
  readonly invalid = input<boolean>(false);
  readonly touched = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  /** Al salir del grupo, nunca al entrar: el formulario marca «tocado» con esto. */
  readonly touch = output<void>();

  protected readonly noteId = fieldNoteId('ewms-card-group');

  /** Se valida al salir del grupo y al enviar, nunca al mover las flechas. */
  protected readonly showError = computed(() => this.invalid() && this.touched());

  protected readonly fieldError = fieldErrorText(this.errors, this.showError);

  /** El mensaje del validador reemplaza al hint, como en el Input. */
  protected readonly note = computed(() => this.fieldError() || this.hint());

  protected readonly describedBy = computed(() => (this.note() ? this.noteId : null));

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Orden de construcción = orden del DOM. */
  private readonly members = signal<readonly CardGroupMember[]>([]);

  readonly selectedValue = this.value.asReadonly();

  /** La elegida o la primera elegible: `null` sacaría al grupo del tab justo al empezar vacío. */
  readonly tabbableValue = computed<unknown>(() => {
    const enabled = this.members().filter((member) => !this.memberDisabled(member));
    if (enabled.length === 0) {
      return null;
    }
    const selected = enabled.find((member) => member.optionValue() === this.selectedValue());
    return (selected ?? enabled[0])?.optionValue() ?? null;
  });

  /**
   * Del contrato `FormUiControl`: la card de la parada de Tab. De acá entra el foco desde el
   * resumen de errores.
   */
  focus(options?: FocusOptions): void {
    this.host.nativeElement
      .querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
      ?.focus(options);
  }

  register(member: CardGroupMember): void {
    this.members.update((current) => [...current, member]);
  }

  unregister(member: CardGroupMember): void {
    this.members.update((current) => current.filter((existing) => existing !== member));
  }

  memberDisabled(member: CardGroupMember): boolean {
    return this.disabled() || member.ownDisabled();
  }

  /** Se ignora si el grupo está deshabilitado. */
  select(value: unknown): void {
    if (this.disabled()) {
      return;
    }
    this.value.set(value);
    this.touch.emit();
  }

  /**
   * La selección sigue al foco, como en radios nativos, y da la vuelta: un grupo de radios
   * es un conjunto cerrado; el panel del Select, no.
   */
  move(delta: number): void {
    const enabled = this.members().filter((member) => !this.memberDisabled(member));
    if (enabled.length === 0) {
      return;
    }
    const current = enabled.findIndex((member) => member.optionValue() === this.selectedValue());
    const from = current < 0 ? (delta > 0 ? -1 : 0) : current;
    const next = enabled[(from + delta + enabled.length) % enabled.length];
    if (!next) {
      return;
    }
    this.select(next.optionValue());
    next.focus();
  }
}
