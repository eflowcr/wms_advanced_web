import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconButton } from '../icon-button/icon-button';

/** The words the paginator needs. The Table hands it its own. */
export interface PaginationMessages {
  readonly previousPage: string;
  readonly nextPage: string;
  readonly pageOf: (page: number, pages: number) => string;
  readonly rowsTotal: (total: number) => string;
}

/**
 * Previous, next, and where you are.
 *
 * A COMPONENT OF ITS OWN, not a piece of the table, because it closes a gap
 * the catalogue had reserved since DS-2: a list of cards, a log and a picking
 * queue all page, and none of them is a table. The table is simply its first
 * consumer.
 *
 * DELIBERATELY NOT A LIST OF PAGE NUMBERS. Numbered pages need to know how
 * many there are, and a source is allowed not to count (`total: null`); they
 * also need a rule for eliding the middle, which is a decision nobody has
 * asked for. Previous and next work whatever the source knows, and "page 3 of
 * 17" says the rest.
 */
@Component({
  selector: 'ewms-pagination',
  templateUrl: './pagination.html',
  imports: [IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class Pagination {
  /** Zero-based, like everything else that counts pages in this library. */
  readonly page = input.required<number>();

  /** How many pages there are. The component is not rendered without one. */
  readonly pageCount = input.required<number>();

  /** How many rows matched in total, for the readout beside the buttons. */
  readonly total = input<number | null>(null);

  readonly messages = input.required<PaginationMessages>();

  /** Zero-based, like `page`. */
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
