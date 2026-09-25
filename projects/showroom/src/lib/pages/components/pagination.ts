import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Button, DESIGN_SYSTEM_VERSION, Pagination } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { TokenValue } from '../../ui/token-value';

/**
 * t(showroom.pagination.props.page, showroom.pagination.props.pageCount,
 *   showroom.pagination.props.total, showroom.pagination.props.messages,
 *   showroom.pagination.props.pageChange)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'page',
    type: 'number',
    default: '—',
    description: 'showroom.pagination.props.page',
  },
  {
    name: 'pageCount',
    type: 'number',
    default: '—',
    description: 'showroom.pagination.props.pageCount',
  },
  {
    name: 'total',
    type: 'number | null',
    default: 'null',
    description: 'showroom.pagination.props.total',
  },
  {
    name: 'messages',
    type: 'Partial<PaginationMessages> | null',
    default: 'null',
    description: 'showroom.pagination.props.messages',
  },
  {
    name: 'pageChange',
    type: 'output<number>',
    default: '—',
    description: 'showroom.pagination.props.pageChange',
  },
];

/**
 * t(showroom.pagination.anatomy.parts.totalText, showroom.pagination.anatomy.parts.pageText,
 *   showroom.pagination.anatomy.parts.chevron, showroom.pagination.anatomy.parts.focusRing)
 */
const ANATOMY: readonly { readonly part: string; readonly token: string }[] = [
  { part: 'showroom.pagination.anatomy.parts.totalText', token: '--color-text-secondary' },
  { part: 'showroom.pagination.anatomy.parts.pageText', token: '--color-text-primary' },
  { part: 'showroom.pagination.anatomy.parts.chevron', token: '--size-icon-sm' },
  { part: 'showroom.pagination.anatomy.parts.focusRing', token: '--focus-ring-shadow' },
];

/** Cuántas páginas tiene la demo. Un número redondo y visiblemente finito. */
const PAGINAS = 7;

/** Cuántas filas dice haber. Ni redondo ni divisible: una cifra de verdad. */
const FILAS = 163;

/**
 * /design-system/components/pagination: ficha de ewms-pagination. Es un componente propio,
 * no parte de la tabla: tarjetas, eventos o colas de picking también paginan.
 */
/**
 * t(showroom.pagination.states.columns.where,
 *   showroom.pagination.states.columns.previous,
 *   showroom.pagination.states.columns.next,
 *   showroom.pagination.states.columns.announced)
 */
const STATE_COLUMNS: readonly DocColumn[] = [
  { id: 'where', label: 'showroom.pagination.states.columns.where' },
  { id: 'previous', label: 'showroom.pagination.states.columns.previous' },
  { id: 'next', label: 'showroom.pagination.states.columns.next' },
  { id: 'announced', label: 'showroom.pagination.states.columns.announced' },
];

@Component({
  selector: 'ewms-showroom-pagination',
  templateUrl: './pagination.html',
  imports: [Button, Pagination, DemoFrame, DocTable, PropTable, Prose, TokenValue, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomPagination {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly stateColumns = STATE_COLUMNS;
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
