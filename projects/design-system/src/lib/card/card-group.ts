import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import type { CardGroupMember } from './card.types';

/**
 * Elección única sobre cards, con el contrato de teclado de un grupo de radios.
 * ES UN GRUPO DE RADIOS QUE PARECE CARDS, no una lista de botones que recuerda
 * uno: un grupo de radios es UN solo tab stop, al que se entra por la opción
 * elegida y donde mueven las flechas. Un tab stop por card convertiría un
 * selector de cuatro depósitos en cuatro paradas camino al botón Guardar.
 */
@Component({
  selector: 'ewms-card-group',
  templateUrl: './card-group.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  providers: [provideValueAccessor(() => CardGroup)],
})
export class CardGroup extends FormControlBase<unknown> {
  /** El valor elegido. Siembra el control; después manda `writeValue`. */
  readonly value = input<unknown>(null);

  /** Nombra el grupo para la ayuda técnica. Obligatoria como la de cualquier otro
   * control: un grupo sin nombre es un grupo del que nadie puede hablar. */
  readonly label = input.required<string>();

  protected readonly valueSource = this.value;

  /** Las cards, en orden de construcción, que en una plantilla es orden del DOM. */
  private readonly members = signal<readonly CardGroupMember[]>([]);

  /** Lo que leen las cards para saber si son la elegida. */
  readonly selectedValue = computed(() => this.controlValue());

  /**
   * La única card en el orden de tabulación: la elegida, o la primera elegible
   * cuando no hay ninguna. Devolver `null` sacaría al grupo entero del orden de
   * tabulación justo cuando empieza vacío, que es como empieza siempre.
   */
  readonly tabbableValue = computed<unknown>(() => {
    const enabled = this.members().filter((member) => !this.memberDisabled(member));
    if (enabled.length === 0) {
      return null;
    }
    const selected = enabled.find((member) => member.optionValue() === this.selectedValue());
    return (selected ?? enabled[0])?.optionValue() ?? null;
  });

  /** La llama una card al crearse. */
  register(member: CardGroupMember): void {
    this.members.update((current) => [...current, member]);
  }

  /** La llama una card al destruirse. */
  unregister(member: CardGroupMember): void {
    this.members.update((current) => current.filter((existing) => existing !== member));
  }

  /** Cualquiera de las dos deshabilita: la entrada del grupo o la de la card. */
  memberDisabled(member: CardGroupMember): boolean {
    return this.isDisabled() || member.ownDisabled();
  }

  /** Registra una elección y avisa al formulario. Se ignora si el grupo está off. */
  select(value: unknown): void {
    if (this.isDisabled()) {
      return;
    }
    this.commit(value);
    this.markTouched();
  }

  /**
   * Va a la card siguiente o anterior habilitada, eligiéndola de paso. LA
   * SELECCIÓN SIGUE AL FOCO, que es el comportamiento nativo de un grupo de
   * radios: las flechas cambian la respuesta, no la hojean. Y DA LA VUELTA, al
   * revés que el panel del Select: un panel es una lista que se lee y su final es
   * información; un grupo de radios es un conjunto cerrado.
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
