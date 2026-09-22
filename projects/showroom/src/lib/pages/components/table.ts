import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import {
  ArrayTableSource,
  Badge,
  Button,
  DESIGN_SYSTEM_VERSION,
  DetailTemplate,
  EmptyTemplate,
  Table,
  TableColumn,
  type RowActivateEvent,
  type RowMenuEvent,
  type TableQuery,
  type TableSource,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { ESTADOS, EXPEDICIONES, type ExpedicionRow } from './expediciones';
import {
  ACCIONES_FILA,
  CABECERAS,
  FuentePaginada,
  hijosPerezosos,
  generarUbicaciones,
  UBICACIONES_MUESTRA,
  UBICACIONES_TOTAL,
  type UbicacionRow,
} from './expediciones-avanzado';
import { NOT_MEASURED } from './measure';

/**
 * Plantilla del consumidor, literal: es lo que table.html renderiza debajo. La página
 * cuenta sus líneas en el DOM; el techo es cuarenta, y si lo pasa se arregla la API.
 */
const CONSUMER_TEMPLATE = [
  '<ewms-table',
  '  [source]="expediciones"',
  '  children="hijos"',
  '  rowState="estado"',
  '  [trackBy]="porId"',
  '  [selectable]="true"',
  '  [quickFilter]="true"',
  '  ariaLabel="Expediciones"',
  '  (rowActivate)="abrir($event)"',
  '  (selectionChange)="seleccion.set($event)"',
  '  (queryChange)="consulta.set($event)"',
  '>',
  '  <ewms-column key="codigo" header="Código" width="md" [sortable]="true" [filterable]="true" />',
  '  <ewms-column key="cliente" header="Cliente / artículo" width="fill" [filterable]="true" />',
  '  <ewms-column key="fecha" header="Fecha" type="date" width="md" [sortable]="true" [filterable]="true" />',
  '  <ewms-column key="bultos" header="Bultos" type="number" width="sm" [sortable]="true" [filterable]="true" />',
  '  <ewms-column key="estado" header="Estado" type="badge" width="md" [badges]="ESTADOS" />',
  '',
  '  <ng-template ewmsEmpty>',
  '    <p>Ninguna expedición coincide con el filtro.</p>',
  '  </ng-template>',
  '</ewms-table>',
].join('\n');

/** Y el componente entero que hay detrás. */
const CONSUMER_COMPONENT = [
  'protected readonly expediciones = new ArrayTableSource(EXPEDICIONES);',
  'protected readonly porId = (row: ExpedicionRow) => row.id;',
].join('\n');

const MATRIX_VARIANTS: readonly MatrixAxis[] = [
  { id: 'neutral', label: 'Pendiente' },
  { id: 'warning', label: 'En proceso' },
  { id: 'success', label: 'Completada' },
  { id: 'danger', label: 'Con incidencia' },
];

const MATRIX_STATES: readonly MatrixAxis[] = [
  { id: 'badge', label: 'Badge de la columna Estado' },
  { id: 'tint', label: 'Tinte de la fila' },
];

/** Tintes de fila escritos completos para que Tailwind vea cada clase. */
const TINTS: Readonly<Record<string, string>> = {
  neutral: 'bg-neutral-surface',
  warning: 'bg-warning-surface',
  success: 'bg-success-surface',
  danger: 'bg-danger-surface',
};

const LABELS: Readonly<Record<string, string>> = {
  neutral: 'Pendiente',
  warning: 'En proceso',
  success: 'Completada',
  danger: 'Con incidencia',
};

/** Verificada contra table.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'source',
    type: 'TableSource<T>',
    default: '— (requerido)',
    description: 'De dónde salen las filas. Una interfaz: la tabla no conoce HTTP.',
  },
  {
    name: 'ariaLabel',
    type: 'string',
    default: '— (requerido)',
    description: 'Nombra la grilla. Una tabla sin nombre es una tabla que nadie puede pedir.',
  },
  {
    name: 'children',
    type: 'fn | keyof T | null',
    default: 'null',
    description:
      'Una función, o el nombre de una propiedad. Con esto hay árbol y el rol es treegrid; sin esto, grid.',
  },
  {
    name: 'rowState',
    type: 'fn | keyof T | null',
    default: 'null',
    description:
      'Una función, o el nombre de una columna badge: entonces un diccionario alimenta el tinte y el badge.',
  },
  {
    name: 'selectable',
    type: 'boolean',
    default: 'false',
    description: 'Columna de checkbox, con el indeterminado en la cabecera.',
  },
  {
    name: 'quickFilter',
    type: 'boolean',
    default: 'false',
    description: 'El campo de búsqueda global sobre la tabla.',
  },
  {
    name: 'density',
    type: "'md' | 'sm'",
    default: "'md'",
    description: 'Alto de fila por token: 40 px o 32 px.',
  },
  {
    name: 'trackBy',
    type: '(row: T) => unknown',
    default: 'identidad',
    description:
      'Identifica la fila, y TAMBIÉN la selección: por eso la selección sobrevive al cambio de página.',
  },
  {
    name: 'pageSize',
    type: 'number',
    default: '50',
    description: 'Cuántas filas raíz pide cada consulta.',
  },
  {
    name: '(rowActivate)',
    type: '{ row: T }',
    default: '—',
    description: 'Doble clic y Enter. Dos caminos, una acción. No se llama (dblclick).',
  },
  {
    name: '(selectionChange)',
    type: 'readonly T[]',
    default: '—',
    description: 'La selección. Una salida, no un valor de formulario: la tabla no es un CVA.',
  },
  {
    name: '(queryChange)',
    type: 'TableQuery',
    default: '—',
    description:
      'La consulta entera en cada cambio: es lo que una vista guardada persistirá cuando haya backend.',
  },
];

const ANATOMY = [
  { part: 'Alto de fila, densidad md', token: '--row-height-md' },
  { part: 'Alto de fila, densidad sm', token: '--row-height-sm' },
  { part: 'Ancho de columna sm / md / lg', token: '--col-width-md' },
  { part: 'Fondo de la cabecera', token: '--color-bg-secondary' },
  { part: 'Borde bajo la cabecera', token: '--color-border-strong' },
  { part: 'Borde entre filas', token: '--color-border' },
  { part: 'Fila seleccionada', token: '--color-row-selected' },
  { part: 'Fila en hover', token: '--color-ghost-hover' },
  { part: 'Tinte de fila «Con incidencia»', token: '--color-danger-surface' },
  { part: 'Tinte de fila «En proceso»', token: '--color-warning-surface' },
  { part: 'Anillo de foco de la celda', token: '--focus-ring-shadow' },
] as const;

/**
 * /design-system/components/table: ficha de ewms-table. Primero la demo y después
 * la plantilla que la produce: juntas son el argumento de la página.
 */
@Component({
  selector: 'ewms-showroom-table',
  imports: [
    Badge,
    Button,
    DetailTemplate,
    EmptyTemplate,
    Table,
    TableColumn,
    DemoFrame,
    PropTable,
    StateMatrix,
    TokenValue,
  ],
  templateUrl: './table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomTable {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixStates = MATRIX_STATES;
  protected readonly estados = ESTADOS;
  protected readonly consumerTemplate = CONSUMER_TEMPLATE;
  protected readonly consumerComponent = CONSUMER_COMPONENT;

  /** Una línea: ArrayTableSource ya filtra, ordena y pagina, por eso vive en la librería. */
  protected readonly expediciones = new ArrayTableSource<ExpedicionRow>(EXPEDICIONES, [
    'codigo',
    'cliente',
  ]);

  protected readonly porId = (row: ExpedicionRow): unknown => row.id;

  // --------------------------------------------------------------- lote D

  protected readonly accionesFila = ACCIONES_FILA;
  protected readonly hijosPerezosos = hijosPerezosos;

  /** Las cabeceras solas, para la demo de detalle y menú. */
  protected readonly cabeceras = new ArrayTableSource<ExpedicionRow>(CABECERAS, [
    'codigo',
    'cliente',
  ]);

  /** La misma lista, con los hijos detrás de un Observable que tarda. */
  protected readonly perezosa = new ArrayTableSource<ExpedicionRow>(CABECERAS, [
    'codigo',
    'cliente',
  ]);

  /**
   * Arranca con una muestra; las cinco mil filas se cargan solo cuando se piden,
   * para no hacer lenta la ficha a quien no mira esta demo.
   */
  protected readonly ubicaciones = signal<TableSource<UbicacionRow>>(
    new ArrayTableSource<UbicacionRow>(generarUbicaciones(UBICACIONES_MUESTRA), [
      'codigo',
      'pasillo',
    ]),
  );

  protected readonly ubicacionesCargadas = signal(UBICACIONES_MUESTRA);
  protected readonly ubicacionesTotal = UBICACIONES_TOTAL;

  protected readonly paginada = new FuentePaginada();

  protected readonly porUbicacion = (row: UbicacionRow): unknown => row.id;

  /** Toda expedición tiene algo que enseñar; una línea suelta no. */
  protected readonly esMaestra = (row: ExpedicionRow): boolean => row.nivel === 'cabecera';

  protected readonly ultimaAccion = signal('(ninguna)');
  protected readonly ultimaDescarga = signal('(ninguna)');

  protected readonly seleccion = signal<readonly ExpedicionRow[]>([]);
  protected readonly consulta = signal<TableQuery | null>(null);
  protected readonly ultimaActivada = signal('(ninguna)');

  /** Líneas del fragmento, leídas del DOM. */
  protected readonly templateLines = signal(NOT_MEASURED);
  protected readonly componentLines = signal(NOT_MEASURED);
  protected readonly underCeiling = signal(false);

  constructor() {
    afterNextRender(() => {
      const snippet = this.host.nativeElement.querySelector('[data-consumer-template]');
      const component = this.host.nativeElement.querySelector('[data-consumer-component]');
      const lines = countLines(snippet);
      this.templateLines.set(lines === null ? NOT_MEASURED : String(lines));
      const componentCount = countLines(component);
      this.componentLines.set(componentCount === null ? NOT_MEASURED : String(componentCount));
      this.underCeiling.set(lines !== null && lines <= 40);
    });
  }

  protected abrir(event: RowActivateEvent<ExpedicionRow>): void {
    this.ultimaActivada.set(`${event.row.codigo} (${event.row.nivel})`);
  }

  protected cargarTodas(): void {
    this.ubicaciones.set(
      new ArrayTableSource<UbicacionRow>(generarUbicaciones(UBICACIONES_TOTAL), [
        'codigo',
        'pasillo',
      ]),
    );
    this.ubicacionesCargadas.set(UBICACIONES_TOTAL);
  }

  protected elegir(event: RowMenuEvent<ExpedicionRow>): void {
    this.ultimaAccion.set(`${event.item.label} · ${event.row.codigo}`);
  }

  /** No descarga nada, solo lo anota: ninguna demo tiene datos reales ni red. */
  protected descargar(row: ExpedicionRow): void {
    this.ultimaDescarga.set(row.codigo);
  }

  /**
   * ewmsDetail entrega la fila como unknown: usada como atributo suelto no hay
   * entrada de la que inferir el tipo. Hueco de ergonomía; se convierte solo acá.
   */
  protected comoExpedicion(row: unknown): ExpedicionRow {
    return row as ExpedicionRow;
  }

  /** Cuántas líneas cuelgan de una cabecera, según la lista completa. */
  protected lineasDe(row: ExpedicionRow): number {
    return EXPEDICIONES.find((expedicion) => expedicion.id === row.id)?.hijos?.length ?? 0;
  }

  protected tintFor(variant: string): string {
    return TINTS[variant] ?? '';
  }

  protected labelFor(variant: string): string {
    return LABELS[variant] ?? '';
  }

  protected isBadge(stateId: string): boolean {
    return stateId === 'badge';
  }

  /** La última consulta, en una línea legible. */
  protected consultaResumen(): string {
    const query = this.consulta();
    if (!query) {
      return '(todavía ninguna)';
    }
    const filters = Object.keys(query.filters);
    const sort = query.sort ? `${query.sort.key} ${query.sort.direction}` : 'sin orden';
    const search = query.search === '' ? 'sin búsqueda' : `«${query.search}»`;
    const byColumn = filters.length === 0 ? 'sin filtros' : `filtros: ${filters.join(', ')}`;
    return `${search} · ${byColumn} · ${sort} · página ${query.page}`;
  }
}

/** Líneas de un pre, o null si no había nada que leer. */
function countLines(element: Element | null): number | null {
  const text = element?.textContent;
  return text ? text.trimEnd().split('\n').length : null;
}
