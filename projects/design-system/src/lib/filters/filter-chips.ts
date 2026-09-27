import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import { EWMS_FILTER_CHIPS_MESSAGES, type FilterChipsMessages } from './filter-chips.types';

/** Sin proveedor los chips andan igual; solo se quedan mudos, como el Select. */
const NO_FILTER_CHIPS_MESSAGES: FilterChipsMessages = {
  removeFilter: () => '',
  clearFilters: '',
};

/** Un filtro activo, para su chip: columna o campo, y el valor ya legible. */
export interface FilterChip {
  readonly key: string;
  readonly column: string;
  readonly value: string;
}

/**
 * Los chips de los filtros activos y «Limpiar filtros»: la misma pieza en la barra de la tabla
 * y en la de filtros de pantalla. Solo emite: quien filtra decide. Ver vault: Patron-Filtros.
 */
@Component({
  selector: 'ewms-filter-chips',
  imports: [Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (chips().length > 0) {
      <ul class="flex flex-wrap items-center gap-2" data-filter-chips>
        @for (chip of chips(); track chip.key) {
          <li
            class="inline-flex items-center gap-1 rounded-full border border-default bg-secondary py-0.5 ps-2 pe-1 text-caption text-primary"
            [attr.data-chip]="chip.key"
          >
            <!-- &ngsp;: sin él el lector de pantalla junta «Código:0002». -->
            <span
              ><span class="text-secondary">{{ chip.column }}:</span>&ngsp;{{ chip.value }}</span
            >
            <button
              type="button"
              class="-m-0.5 inline-flex cursor-pointer rounded-full p-1 text-secondary outline-none hover:bg-ghost-hover focus-visible:shadow-(--focus-ring-shadow)"
              [attr.aria-label]="text().removeFilter(chip.column)"
              (click)="remove.emit(chip.key)"
            >
              <ewms-icon name="x" size="sm" />
            </button>
          </li>
        }
        <li>
          <ewms-button variant="link" size="sm" data-clear-filters (click)="clearAll.emit()">
            {{ text().clearFilters }}
          </ewms-button>
        </li>
      </ul>
    }
  `,
})
export class FilterChips {
  readonly chips = input.required<readonly FilterChip[]>();

  /** Pisa, en esta instancia, los textos de `EWMS_FILTER_CHIPS_MESSAGES` (ADR 0008). */
  readonly messages = input<Partial<FilterChipsMessages> | null>(null);

  private readonly providedMessages = inject(EWMS_FILTER_CHIPS_MESSAGES, { optional: true });

  protected readonly text = computed<FilterChipsMessages>(() => ({
    ...(this.providedMessages ?? NO_FILTER_CHIPS_MESSAGES),
    ...(this.messages() ?? {}),
  }));

  /** La clave del chip cuyo × se pulsó. */
  readonly remove = output<string>();
  readonly clearAll = output<void>();
}
