import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconButton } from '../icon-button/icon-button';

/** Las palabras que necesita el paginador. La Tabla le pasa las suyas. */
export interface PaginationMessages {
  readonly previousPage: string;
  readonly nextPage: string;
  readonly pageOf: (page: number, pages: number) => string;
  readonly rowsTotal: (total: number) => string;
}

/**
 * Anterior, siguiente y dónde estás.
 *
 * COMPONENTE PROPIO y no una pieza de la tabla: una lista de cards, un log y una
 * cola de picking paginan, y ninguno es una tabla. La tabla es su primer consumidor.
 * A PROPÓSITO NO ES UNA LISTA DE NÚMEROS DE PÁGINA: eso necesita saber cuántas hay
 * -y una fuente puede no contar (`total: null`)- y una regla para elidir el medio
 * que nadie pidió. Anterior y siguiente funcionan sepa lo que sepa la fuente.
 */
@Component({
  selector: 'ewms-pagination',
  templateUrl: './pagination.html',
  imports: [IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class Pagination {
  /** Base cero, como todo lo que cuenta páginas en esta librería. */
  readonly page = input.required<number>();

  /** Cuántas páginas hay. Sin eso el componente no se pinta. */
  readonly pageCount = input.required<number>();

  /** Cuántas filas coincidieron, para el texto al lado de los botones. */
  readonly total = input<number | null>(null);

  readonly messages = input.required<PaginationMessages>();

  /** Base cero, como `page`. */
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
