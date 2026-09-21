import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from '../button/button';

/** La Tabla le pasa las suyas. */
export interface PaginationMessages {
  readonly previousPage: string;
  readonly nextPage: string;
  readonly pageOf: (page: number, pages: number) => string;
  readonly rowsTotal: (total: number) => string;
}

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

  readonly messages = input.required<PaginationMessages>();

  /** Base cero. */
  readonly pageChange = output<number>();

  protected readonly humanPage = computed(() => this.page() + 1);

  protected readonly atStart = computed(() => this.page() <= 0);
  protected readonly atEnd = computed(() => this.page() >= this.pageCount() - 1);

  protected readonly label = computed(() =>
    this.messages().pageOf(this.humanPage(), this.pageCount()),
  );

  protected readonly totalLabel = computed(() => {
    const total = this.total();
    return total === null ? '' : this.messages().rowsTotal(total);
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
