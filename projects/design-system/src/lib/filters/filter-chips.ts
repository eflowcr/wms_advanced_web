import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Icon } from '../icon/icon';

/** Un filtro activo, para su chip: columna o campo, y el valor ya legible. */
export interface FilterChip {
  readonly key: string;
  readonly column: string;
  readonly value: string;
}

/** Textos ya traducidos, provistos una vez por token (ADR 0008). */
export interface FilterChipsMessages {
  /** Nombre del × de un chip: «Quitar el filtro Estado». */
  readonly removeFilter: (column: string) => string;
  readonly clearFilters: string;
}

export const EWMS_FILTER_CHIPS_MESSAGES = new InjectionToken<FilterChipsMessages>(
  'EWMS_FILTER_CHIPS_MESSAGES',
);

/** Sin proveedor los chips andan igual; solo se quedan mudos, como el Select. */
export const NO_FILTER_CHIPS_MESSAGES: FilterChipsMessages = {
  removeFilter: () => '',
  clearFilters: '',
};

/**
 * Los chips de los filtros activos y «Limpiar filtros»: la misma pieza en la barra de la tabla
 * y en la de filtros de pantalla. Solo emite: quien filtra decide. Ver vault: Patron-Filtros.
 */
@Component({
  selector: 'ewms-filter-chips',
  imports: [Icon],
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
              class="inline-flex cursor-pointer rounded-full p-0.5 text-secondary outline-none hover:bg-ghost-hover focus-visible:shadow-(--focus-ring-shadow)"
              [attr.aria-label]="text().removeFilter(chip.column)"
              (click)="remove.emit(chip.key)"
            >
              <ewms-icon name="x" size="sm" />
            </button>
          </li>
        }
        <li>
          <button
            type="button"
            class="cursor-pointer rounded-sm px-2 py-1 text-caption outline-none focus-visible:shadow-(--focus-ring-shadow) text-(color:--color-bg-primary) hover:text-(color:--color-bg-primary-hover)"
            data-clear-filters
            (click)="clearAll.emit()"
          >
            {{ text().clearFilters }}
          </button>
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
