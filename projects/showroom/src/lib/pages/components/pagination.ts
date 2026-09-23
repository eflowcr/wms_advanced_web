import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DESIGN_SYSTEM_VERSION, Pagination } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { TokenValue } from '../../ui/token-value';

const PROPS: readonly PropRow[] = [
  {
    name: 'page',
    type: 'number',
    default: '— (obligatorio)',
    description: 'La página actual, contada desde cero, como en TableQuery.',
  },
  {
    name: 'pageCount',
    type: 'number',
    default: '— (obligatorio)',
    description: 'Cuántas páginas hay. Sin ella el control no se monta.',
  },
  {
    name: 'total',
    type: 'number | null',
    default: 'null',
    description: 'Cuántas filas coincidieron. Con null no se dice nada del total.',
  },
  {
    name: 'messages',
    type: 'Partial<PaginationMessages> | null',
    default: 'null',
    description:
      'Sobrescribe, en esta instancia, los textos de EWMS_PAGINATION_MESSAGES (ADR 0008).',
  },
  {
    name: 'pageChange',
    type: 'output<number>',
    default: '—',
    description: 'La página pedida, contada desde cero. No cambia nada por su cuenta.',
  },
];

const ANATOMY: readonly { readonly part: string; readonly token: string }[] = [
  { part: 'Texto del total', token: '--color-text-secondary' },
  { part: 'Texto «Página N de M»', token: '--color-text-primary' },
  { part: 'Glifo de los chevrones', token: '--size-icon-sm' },
  { part: 'Anillo de foco', token: '--focus-ring-shadow' },
];

/** Cuántas páginas tiene la demo. Un número redondo y visiblemente finito. */
const PAGINAS = 7;

/** Cuántas filas dice haber. Ni redondo ni divisible: una cifra de verdad. */
const FILAS = 163;

/**
 * /design-system/components/pagination: ficha de ewms-pagination. Es un componente propio,
 * no parte de la tabla: tarjetas, eventos o colas de picking también paginan.
 */
@Component({
  selector: 'ewms-showroom-pagination',
  templateUrl: './pagination.html',
  imports: [Pagination, DemoFrame, PropTable, TokenValue],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomPagination {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly paginas = PAGINAS;

  protected readonly pagina = signal(0);
  protected readonly conTotal = signal(true);

  protected readonly total = computed(() => (this.conTotal() ? FILAS : null));

  protected irA(page: number): void {
    this.pagina.set(page);
  }

  protected alternarTotal(): void {
    this.conTotal.update((value) => !value);
  }
}
