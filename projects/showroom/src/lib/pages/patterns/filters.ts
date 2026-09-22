import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import {
  ArrayTableSource,
  DESIGN_SYSTEM_VERSION,
  FilterBar,
  Table,
  TableColumn,
  type FilterField,
  type FilterValues,
} from '@ewms/design-system';
import { filtersInUrl } from '@ewms/shared';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { ESTADOS, EXPEDICIONES, type ExpedicionRow } from '../components/expediciones';

/** La demo de la tabla, con el almacén que un filtro de pantalla necesita y la tabla no tiene. */
interface FilaConAlmacen extends ExpedicionRow {
  readonly almacen: string;
}

const ALMACENES = [
  { label: 'Central', value: 'central' },
  { label: 'Norte', value: 'norte' },
];

const FILAS: readonly FilaConAlmacen[] = EXPEDICIONES.map((fila, indice) => ({
  ...fila,
  almacen: indice % 2 === 0 ? 'central' : 'norte',
}));

const CLIENTES = [...new Set(FILAS.map((fila) => fila.cliente))].map((cliente) => ({
  label: cliente,
  value: cliente,
}));

/** Cinco campos: los tres primeros a la vista, los otros dos detrás de «Más filtros». */
const CAMPOS: readonly FilterField[] = [
  { kind: 'select', key: 'almacen', label: 'Almacén', options: ALMACENES },
  { kind: 'date-range', key: 'fecha', label: 'Período del documento' },
  {
    kind: 'select',
    key: 'estado',
    label: 'Estado del proceso',
    options: Object.entries(ESTADOS).map(([value, badge]) => ({ label: badge.label, value })),
  },
  { kind: 'select', key: 'cliente', label: 'Cliente', options: CLIENTES },
  { kind: 'search', key: 'texto', label: 'Buscar por código' },
];

const CLAVES = CAMPOS.map((campo) => campo.key);

/** Los filtros van a la fuente: la tabla recibe las filas que quedan, no un filtro. */
function filtrar(filas: readonly FilaConAlmacen[], valores: FilterValues): readonly FilaConAlmacen[] {
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

/** Verificada contra filter-bar.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'fields',
    type: 'readonly FilterField[]',
    default: '— (requerido)',
    description: 'select, date-range o search. Los tres primeros a la vista; el resto, en «Más filtros».',
  },
  {
    name: 'value',
    type: 'FilterValues',
    default: '{}',
    description: 'Por clave. Manda el valor: llega de la URL, de un enlace compartido o de limpiar.',
  },
  {
    name: '(valueChange)',
    type: 'FilterValues',
    default: '—',
    description: 'Al cambiar un campo, con la espera por token para el texto. Sin botón «Aplicar».',
  },
  {
    name: 'ewms-table: screenFilters',
    type: 'number',
    default: '0',
    description: 'Cuántos filtros de pantalla hay puestos: con alguno, vacío es «sin resultados».',
  },
  {
    name: 'ewms-table: (filtersCleared)',
    type: 'void',
    default: '—',
    description: '«Limpiar filtros» del estado vacío: la pantalla limpia además los suyos.',
  },
];

/**
 * /design-system/patterns/filters: filtros de pantalla sobre la fuente, con la URL al día.
 * El componente no conoce el router: eso lo hace `filtersInUrl` de `@ewms/shared`.
 */
@Component({
  selector: 'ewms-showroom-filters',
  templateUrl: './filters.html',
  imports: [FilterBar, Table, TableColumn, DemoFrame, PropTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomFilters {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly campos = CAMPOS;
  protected readonly estados = ESTADOS;

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
