import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
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
  providers: [provideValueAccessor(() => CardGroup)],
})
export class CardGroup extends FormControlBase<unknown> {
  /** Siembra el control; después manda `writeValue`. */
  readonly value = input<unknown>(null);

  /** Obligatorio, como el nombre de cualquier control. */
  readonly label = input.required<string>();

  protected readonly valueSource = this.value;

  /** Orden de construcción = orden del DOM. */
  private readonly members = signal<readonly CardGroupMember[]>([]);

  readonly selectedValue = computed(() => this.controlValue());

  /** La elegida o la primera elegible: `null` sacaría al grupo del tab justo al empezar vacío. */
  readonly tabbableValue = computed<unknown>(() => {
    const enabled = this.members().filter((member) => !this.memberDisabled(member));
    if (enabled.length === 0) {
      return null;
    }
    const selected = enabled.find((member) => member.optionValue() === this.selectedValue());
    return (selected ?? enabled[0])?.optionValue() ?? null;
  });

  register(member: CardGroupMember): void {
    this.members.update((current) => [...current, member]);
  }

  unregister(member: CardGroupMember): void {
    this.members.update((current) => current.filter((existing) => existing !== member));
  }

  memberDisabled(member: CardGroupMember): boolean {
    return this.isDisabled() || member.ownDisabled();
  }

  /** Se ignora si el grupo está deshabilitado. */
  select(value: unknown): void {
    if (this.isDisabled()) {
      return;
    }
    this.commit(value);
    this.markTouched();
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
