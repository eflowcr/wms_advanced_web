import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import {
  ArrayTableSource,
  DESIGN_SYSTEM_VERSION,
  FilterBar,
  Table,
  TableColumn,
  type BadgeDictionary,
  type FilterField,
  type FilterValues,
} from '@ewms/design-system';
import { filtersInUrl } from '@ewms/shared';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { translated, type Translate } from '../../ui/translated';
import { injectStatuses } from '../components/shipments';
import { WAREHOUSES, CUSTOMERS, ROWS, type RowWithWarehouse } from './filters.fixtures';

/**
 * Cinco campos: los tres primeros a la vista, los otros dos detrás de «Más filtros». Las
 * etiquetas siguen al idioma; las opciones de almacén y cliente son registros y van tal cual.
 * t(showroom.patternFilters.fields.warehouse, showroom.patternFilters.fields.period,
 *   showroom.patternFilters.fields.status, showroom.patternFilters.fields.customer,
 *   showroom.patternFilters.fields.search)
 */
function fields(t: Translate, statuses: BadgeDictionary): readonly FilterField[] {
  return [
    {
      kind: 'select',
      key: 'warehouse',
      label: t('showroom.patternFilters.fields.warehouse'),
      options: WAREHOUSES,
    },
    { kind: 'date-range', key: 'date', label: t('showroom.patternFilters.fields.period') },
    {
      kind: 'select',
      key: 'status',
      label: t('showroom.patternFilters.fields.status'),
      options: Object.entries(statuses).map(([value, badge]) => ({ label: badge.label, value })),
    },
    {
      kind: 'select',
      key: 'customer',
      label: t('showroom.patternFilters.fields.customer'),
      options: CUSTOMERS,
    },
    { kind: 'search', key: 'text', label: t('showroom.patternFilters.fields.search') },
  ];
}

const KEYS = ['warehouse', 'date', 'status', 'customer', 'text'];

/** Los filtros van a la fuente: la tabla recibe las filas que quedan, no un filtro. */
function filterRows(
  rows: readonly RowWithWarehouse[],
  values: FilterValues,
): readonly RowWithWarehouse[] {
  return rows.filter((row) =>
    Object.entries(values).every(([key, value]) => {
      if (key === 'date' && typeof value === 'object') {
        return (
          (value.from === undefined || row.date >= value.from) &&
          (value.to === undefined || row.date <= value.to)
        );
      }
      if (key === 'text') {
        return row.code.toLowerCase().includes(String(value).toLowerCase());
      }
      return String(row[key as 'warehouse' | 'status' | 'customer']) === String(value);
    }),
  );
}

/**
 * Verificada contra filter-bar.ts. Lo obligatorio lo dice la descripción: el default es código
 * literal.
 * t(showroom.patternFilters.props.fields, showroom.patternFilters.props.value,
 *   showroom.patternFilters.props.valueChange, showroom.patternFilters.props.screenFilters,
 *   showroom.patternFilters.props.filtersCleared)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'fields',
    type: 'readonly FilterField[]',
    default: '—',
    description: 'showroom.patternFilters.props.fields',
  },
  {
    name: 'value',
    type: 'FilterValues',
    default: '{}',
    description: 'showroom.patternFilters.props.value',
  },
  {
    name: '(valueChange)',
    type: 'FilterValues',
    default: '—',
    description: 'showroom.patternFilters.props.valueChange',
  },
  {
    name: 'ewms-table: screenFilters',
    type: 'number',
    default: '0',
    description: 'showroom.patternFilters.props.screenFilters',
  },
  {
    name: 'ewms-table: (filtersCleared)',
    type: 'void',
    default: '—',
    description: 'showroom.patternFilters.props.filtersCleared',
  },
];

/**
 * /design-system/patterns/filters: filtros de pantalla sobre la fuente, con la URL al día.
 * El componente no conoce el router: eso lo hace `filtersInUrl` de `@ewms/shared`.
 */
@Component({
  selector: 'ewms-showroom-filters',
  templateUrl: './filters.html',
  imports: [FilterBar, Table, TableColumn, DemoFrame, PropTable, Prose, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomFilters {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly statuses = injectStatuses();
  protected readonly fields = translated((t) => fields(t, this.statuses()));

  /** Los filtros viven en la URL: un enlace filtrado se comparte y «atrás» deshace el último. */
  private readonly url = filtersInUrl(KEYS);
  protected readonly value = this.url.value;

  protected readonly activeCount = computed(() => Object.keys(this.value()).length);

  protected readonly source = computed(
    () => new ArrayTableSource<RowWithWarehouse>(filterRows(ROWS, this.value()), ['code', 'customer']),
  );

  protected readonly byId = (row: RowWithWarehouse): unknown => row.id;

  protected apply(values: FilterValues): void {
    this.url.set(values);
  }

  protected clear(): void {
    this.url.set({});
  }

  protected readonly snippet = [
    '<ewms-filter-bar [fields]="fields()" [value]="value()" (valueChange)="apply($event)" />',
    '',
    '<ewms-table [source]="source()" [screenFilters]="activeCount()" (filtersCleared)="clear()" …>',
  ].join('\n');
}
