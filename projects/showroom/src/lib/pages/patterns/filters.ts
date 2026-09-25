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
import { injectEstados } from '../components/expediciones';
import { ALMACENES, CLIENTES, FILAS, type FilaConAlmacen } from './filters.fixtures';

/**
 * Cinco campos: los tres primeros a la vista, los otros dos detrás de «Más filtros». Las
 * etiquetas siguen al idioma; las opciones de almacén y cliente son registros y van tal cual.
 * t(showroom.patternFilters.fields.warehouse, showroom.patternFilters.fields.period,
 *   showroom.patternFilters.fields.status, showroom.patternFilters.fields.customer,
 *   showroom.patternFilters.fields.search)
 */
function campos(t: Translate, estados: BadgeDictionary): readonly FilterField[] {
  return [
    {
      kind: 'select',
      key: 'almacen',
      label: t('showroom.patternFilters.fields.warehouse'),
      options: ALMACENES,
    },
    { kind: 'date-range', key: 'fecha', label: t('showroom.patternFilters.fields.period') },
    {
      kind: 'select',
      key: 'estado',
      label: t('showroom.patternFilters.fields.status'),
      options: Object.entries(estados).map(([value, badge]) => ({ label: badge.label, value })),
    },
    {
      kind: 'select',
      key: 'cliente',
      label: t('showroom.patternFilters.fields.customer'),
      options: CLIENTES,
    },
    { kind: 'search', key: 'texto', label: t('showroom.patternFilters.fields.search') },
  ];
}

const CLAVES = ['almacen', 'fecha', 'estado', 'cliente', 'texto'];

/** Los filtros van a la fuente: la tabla recibe las filas que quedan, no un filtro. */
function filtrar(
  filas: readonly FilaConAlmacen[],
  valores: FilterValues,
): readonly FilaConAlmacen[] {
  return filas.filter((fila) =>
    Object.entries(valores).every(([clave, valor]) => {
      if (clave === 'fecha' && typeof valor === 'object') {
        return (
          (valor.from === undefined || fila.fecha >= valor.from) &&
          (valor.to === undefined || fila.fecha <= valor.to)
        );
      }
      if (clave === 'texto') {
        return fila.codigo.toLowerCase().includes(String(valor).toLowerCase());
      }
      return String(fila[clave as 'almacen' | 'estado' | 'cliente']) === String(valor);
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
  protected readonly estados = injectEstados();
  protected readonly campos = translated((t) => campos(t, this.estados()));

  /** Los filtros viven en la URL: un enlace filtrado se comparte y «atrás» deshace el último. */
  private readonly url = filtersInUrl(CLAVES);
  protected readonly valor = this.url.value;

  protected readonly activos = computed(() => Object.keys(this.valor()).length);

  protected readonly fuente = computed(
    () => new ArrayTableSource<FilaConAlmacen>(filtrar(FILAS, this.valor()), ['codigo', 'cliente']),
  );

  protected readonly porId = (fila: FilaConAlmacen): unknown => fila.id;

  protected aplicar(valores: FilterValues): void {
    this.url.set(valores);
  }

  protected limpiar(): void {
    this.url.set({});
  }

  protected readonly snippet = [
    '<ewms-filter-bar [fields]="filtros" [value]="valor()" (valueChange)="aplicar($event)" />',
    '',
    '<ewms-table [source]="fuente()" [screenFilters]="activos()" (filtersCleared)="limpiar()" …>',
  ].join('\n');
}
