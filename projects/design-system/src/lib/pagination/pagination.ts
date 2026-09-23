import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Button } from '../button/button';

/** Textos ya traducidos, provistos una vez por token (ADR 0008). */
export interface PaginationMessages {
  readonly previousPage: string;
  readonly nextPage: string;
  readonly pageOf: (page: number, pages: number) => string;
  readonly rowsTotal: (total: number) => string;
}

export const EWMS_PAGINATION_MESSAGES = new InjectionToken<PaginationMessages>(
  'EWMS_PAGINATION_MESSAGES',
);

/** Sin proveedor el paginador anda igual; solo se queda mudo, como el Select. */
export const NO_PAGINATION_MESSAGES: PaginationMessages = {
  previousPage: '',
  nextPage: '',
  pageOf: () => '',
  rowsTotal: () => '',
};

/**
 * Aparte de la tabla: cards, logs y colas de picking también paginan. Sin números de página a
 * propósito: exigen un total, que una fuente puede no dar (`total: null`).
 */
@Component({
  selector: 'ewms-pagination',
  templateUrl: './pagination.html',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class Pagination {
  /** Base cero, como en toda la librería. */
  readonly page = input.required<number>();

  readonly pageCount = input.required<number>();

  readonly total = input<number | null>(null);

  /** Pisa, en esta instancia, los textos de `EWMS_PAGINATION_MESSAGES` (ADR 0008). */
  readonly messages = input<Partial<PaginationMessages> | null>(null);

  /** Base cero. */
  readonly pageChange = output<number>();

  private readonly providedMessages = inject(EWMS_PAGINATION_MESSAGES, { optional: true });

  protected readonly text = computed<PaginationMessages>(() => ({
    ...(this.providedMessages ?? NO_PAGINATION_MESSAGES),
    ...(this.messages() ?? {}),
  }));

  protected readonly humanPage = computed(() => this.page() + 1);

  protected readonly atStart = computed(() => this.page() <= 0);
  protected readonly atEnd = computed(() => this.page() >= this.pageCount() - 1);

  protected readonly label = computed(() => this.text().pageOf(this.humanPage(), this.pageCount()));

  protected readonly totalLabel = computed(() => {
    const total = this.total();
    return total === null ? '' : this.text().rowsTotal(total);
  });

  protected previous(): void {
    if (!this.atStart()) {
      this.pageChange.emit(this.page() - 1);
    }
  }

  protected next(): void {
    if (!this.atEnd()) {
      this.pageChange.emit(this.page() + 1);
    }
  }
}
