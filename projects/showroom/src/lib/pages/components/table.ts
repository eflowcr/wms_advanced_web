import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
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
  Table,
  TableColumn,
  type BulkActionEvent,
  type MenuItem,
  type RowActivateEvent,
  type RowMenuEvent,
  type TableQuery,
  type TableSource,
} from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { translated } from '../../ui/translated';
import { injectStatuses, type ShipmentRow } from './shipments';
import { SHIPMENTS } from './shipments.fixtures';
import {
  HEADER_ROWS,
  PagedSource,
  lazyChildren,
  injectRowActions,
  injectBulkActions,
  SAMPLE_LOCATIONS,
  TOTAL_LOCATIONS,
} from './shipments-advanced';
import { NOT_MEASURED } from './measure';
import { SAMPLE_CODE, generateLocations, type LocationRow } from './table.fixtures';

/**
 * Plantilla del consumidor: es lo que table.html renderiza debajo, textos traducidos incluidos.
 * La página cuenta sus líneas en el DOM; el techo es cuarenta, y si lo pasa se arregla la API.
 */
const TEMPLATE_SNIPPET = [
  '<ewms-table',
  '  [source]="shipments"',
  '  children="children"',
  '  rowState="status"',
  '  [trackBy]="byId"',
  '  [selectable]="true"',
  '  [quickFilter]="true"',
  '  [columnChooser]="true"',
  '  [exportable]="true"',
  '  viewsKey="showroom.shipments"',
  '  [bulkActions]="bulkActions()"',
  "  [ariaLabel]=\"'showroom.table.demo.ariaLabel' | transloco\"",
  '  (rowActivate)="open($event)"',
  '  (selectionChange)="selection.set($event)"',
  '  (bulkAction)="bulk($event)"',
  '  (queryChange)="query.set($event)"',
  '>',
  "  <ewms-column key=\"code\" [header]=\"'showroom.table.columns.code' | transloco\" width=\"md\" pinned=\"start\" [sortable]=\"true\" [filterable]=\"true\" />",
  "  <ewms-column key=\"customer\" [header]=\"'showroom.table.columns.customerItem' | transloco\" width=\"fill\" maxWidth=\"lg\" [filterable]=\"true\" />",
  "  <ewms-column key=\"date\" [header]=\"'showroom.table.columns.date' | transloco\" type=\"date\" width=\"md\" [sortable]=\"true\" [filterable]=\"true\" />",
  "  <ewms-column key=\"packages\" [header]=\"'showroom.table.columns.packages' | transloco\" type=\"number\" width=\"sm\" aggregate=\"sum\" [sortable]=\"true\" [filterable]=\"true\" />",
  "  <ewms-column key=\"status\" [header]=\"'showroom.table.columns.status' | transloco\" type=\"badge\" width=\"md\" [badges]=\"statuses()\" [filterable]=\"true\" />",
  '</ewms-table>',
].join('\n');

/** Y el componente entero que hay detrás. Estados y acciones siguen al idioma: son señales. */
const COMPONENT_SNIPPET = [
  'protected readonly shipments = new ArrayTableSource(SHIPMENTS);',
  'protected readonly byId = (row: ShipmentRow) => row.id;',
  'protected readonly statuses = injectStatuses();',
  'protected readonly bulkActions = injectBulkActions();',
  'protected bulk(event: BulkActionEvent<ShipmentRow>) { /* imprimir, anular… */ }',
].join('\n');

/**
 * Las filas de la matriz: los cuatro estados, con el nombre del diccionario de estados.
 * t(showroom.common.shipments.states.pending, showroom.common.shipments.states.inProgress,
 *   showroom.common.shipments.states.completed, showroom.common.shipments.states.withIssue)
 */
const MATRIX_VARIANTS: readonly MatrixAxis[] = [
  { id: 'neutral', label: 'showroom.common.shipments.states.pending' },
  { id: 'warning', label: 'showroom.common.shipments.states.inProgress' },
  { id: 'success', label: 'showroom.common.shipments.states.completed' },
  { id: 'danger', label: 'showroom.common.shipments.states.withIssue' },
];

/** t(showroom.table.states.axes.badge, showroom.table.states.axes.tint) */
const MATRIX_STATES: readonly MatrixAxis[] = [
  { id: 'badge', label: 'showroom.table.states.axes.badge' },
  { id: 'tint', label: 'showroom.table.states.axes.tint' },
];

/** Tintes de fila escritos completos para que Tailwind vea cada clase. `neutral` no tiñe. */
const TINTS: Readonly<Record<string, string>> = {
  neutral: 'bg-surface',
  warning: 'bg-row-warning',
  success: 'bg-row-success',
  danger: 'bg-row-danger',
};

interface RowMatrixEntry {
  readonly id: string;
  /** Clave del nombre del estado. */
  readonly state: string;
  readonly background: string;
  /** La marca: un token, «—» si no lleva, o `{ label }` con la clave de su descripción. */
  readonly mark: string | { readonly label: string };
  readonly row: string;
  readonly cell: string;
}

/**
 * La matriz de fila (Tabla §23), con las clases que usa la tabla escritas enteras. El foco
 * se muestra con su anillo interior aplicado a mano: `:focus-visible` no se fuerza.
 * t(showroom.table.rowMatrix.states.normal, showroom.common.states.hover,
 *   showroom.table.rowMatrix.states.focus, showroom.table.rowMatrix.innerRing,
 *   showroom.table.rowMatrix.states.selected, showroom.table.rowMatrix.states.danger,
 *   showroom.table.rowMatrix.states.warning, showroom.table.rowMatrix.states.success,
 *   showroom.table.rowMatrix.states.selectedDanger)
 */
const ROW_MATRIX: readonly RowMatrixEntry[] = [
  {
    id: 'normal',
    state: 'showroom.table.rowMatrix.states.normal',
    background: '--color-surface',
    mark: '—',
    row: 'bg-surface',
    cell: '',
  },
  {
    id: 'hover',
    state: 'showroom.common.states.hover',
    background: '--color-row-hover',
    mark: '—',
    row: 'bg-row-hover',
    cell: '',
  },
  {
    id: 'focus',
    state: 'showroom.table.rowMatrix.states.focus',
    background: '--color-row-hover',
    mark: { label: 'showroom.table.rowMatrix.innerRing' },
    row: 'bg-row-hover',
    cell: 'outline-2 -outline-offset-2 outline-focus',
  },
  {
    id: 'selected',
    state: 'showroom.table.rowMatrix.states.selected',
    background: '--color-row-selected',
    mark: '—',
    row: 'bg-row-selected',
    cell: '',
  },
  {
    id: 'danger',
    state: 'showroom.table.rowMatrix.states.danger',
    background: '--color-row-danger',
    mark: '--shadow-row-mark-danger',
    row: 'bg-row-danger',
    cell: 'shadow-row-mark-danger',
  },
  {
    id: 'warning',
    state: 'showroom.table.rowMatrix.states.warning',
    background: '--color-row-warning',
    mark: '--shadow-row-mark-warning',
    row: 'bg-row-warning',
    cell: 'shadow-row-mark-warning',
  },
  {
    id: 'success',
    state: 'showroom.table.rowMatrix.states.success',
    background: '--color-row-success',
    mark: '—',
    row: 'bg-row-success',
    cell: '',
  },
  {
    id: 'selected-danger',
    state: 'showroom.table.rowMatrix.states.selectedDanger',
    background: '--color-row-selected',
    mark: '--shadow-row-mark-danger',
    row: 'bg-row-selected',
    cell: 'shadow-row-mark-danger',
  },
];

const TINTED: ReadonlySet<string> = new Set(['warning', 'success', 'danger']);

/**
 * Verificada contra table.ts. `description` es la clave de su texto.
 * t(showroom.table.props.source, showroom.table.props.ariaLabel, showroom.table.props.children,
 *   showroom.table.props.rowState, showroom.table.props.selectable,
 *   showroom.table.props.quickFilter, showroom.table.props.density,
 *   showroom.table.props.columnChooser, showroom.table.props.exportable,
 *   showroom.table.props.bulkActions, showroom.table.props.columnExtras,
 *   showroom.table.props.columnLimits, showroom.table.props.viewsKey,
 *   showroom.table.props.trackBy, showroom.table.props.pageSize, showroom.table.props.rowActivate,
 *   showroom.table.props.selectionChange, showroom.table.props.viewChange,
 *   showroom.table.props.bulkAction, showroom.table.props.exportRequest,
 *   showroom.table.props.queryChange)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'source',
    type: 'TableSource<T>',
    default: '—',
    description: 'showroom.table.props.source',
  },
  {
    name: 'ariaLabel',
    type: 'string',
    default: '—',
    description: 'showroom.table.props.ariaLabel',
  },
  {
    name: 'children',
    type: 'fn | keyof T | null',
    default: 'null',
    description: 'showroom.table.props.children',
  },
  {
    name: 'rowState',
    type: 'fn | keyof T | null',
    default: 'null',
    description: 'showroom.table.props.rowState',
  },
  {
    name: 'selectable',
    type: 'boolean',
    default: 'false',
    description: 'showroom.table.props.selectable',
  },
  {
    name: 'quickFilter',
    type: 'boolean',
    default: 'false',
    description: 'showroom.table.props.quickFilter',
  },
  {
    name: 'density',
    type: "'md' | 'sm'",
    default: "'md'",
    description: 'showroom.table.props.density',
  },
  {
    name: 'columnChooser',
    type: 'boolean',
    default: 'false',
    description: 'showroom.table.props.columnChooser',
  },
  {
    name: 'exportable',
    type: 'boolean',
    default: 'false',
    description: 'showroom.table.props.exportable',
  },
  {
    name: 'viewsKey',
    type: 'string | null',
    default: 'null',
    description: 'showroom.table.props.viewsKey',
  },
  {
    name: 'bulkActions',
    type: 'readonly MenuItem[]',
    default: '[]',
    description: 'showroom.table.props.bulkActions',
  },
  {
    name: 'ewms-column: pinned · hideable · aggregate',
    type: "'start' | 'end' · boolean · 'sum' | 'avg' | 'count'",
    default: 'null · true · null',
    description: 'showroom.table.props.columnExtras',
  },
  {
    name: 'ewms-column: minWidth · maxWidth',
    type: "'sm' | 'md' | 'lg' · 'sm' | 'md' | 'lg'",
    default: 'null · null',
    description: 'showroom.table.props.columnLimits',
  },
  {
    name: 'trackBy',
    type: '(row: T) => unknown',
    default: '(row) => row',
    description: 'showroom.table.props.trackBy',
  },
  {
    name: 'pageSize',
    type: 'number',
    default: '50',
    description: 'showroom.table.props.pageSize',
  },
  {
    name: '(rowActivate)',
    type: '{ row: T }',
    default: '—',
    description: 'showroom.table.props.rowActivate',
  },
  {
    name: '(selectionChange)',
    type: 'readonly T[]',
    default: '—',
    description: 'showroom.table.props.selectionChange',
  },
  {
    name: '(viewChange)',
    type: 'TableView',
    default: '—',
    description: 'showroom.table.props.viewChange',
  },
  {
    name: '(bulkAction)',
    type: '{ item, rows }',
    default: '—',
    description: 'showroom.table.props.bulkAction',
  },
  {
    name: '(exportRequest)',
    type: '{ query, columns, selectedOnly }',
    default: '—',
    description: 'showroom.table.props.exportRequest',
  },
  {
    name: '(queryChange)',
    type: 'TableQuery',
    default: '—',
    description: 'showroom.table.props.queryChange',
  },
];

/**
 * t(showroom.table.anatomy.parts.rowHeightMd, showroom.table.anatomy.parts.rowHeightSm,
 *   showroom.table.anatomy.parts.columnWidth, showroom.table.anatomy.parts.headerBackground,
 *   showroom.table.anatomy.parts.headerBorder, showroom.table.anatomy.parts.rowBorder,
 *   showroom.table.anatomy.parts.selectedRow, showroom.table.anatomy.parts.hoverRow,
 *   showroom.table.anatomy.parts.dangerTint, showroom.table.anatomy.parts.warningTint,
 *   showroom.table.anatomy.parts.successTint,
 *   showroom.table.anatomy.parts.exceptionMark, showroom.table.anatomy.parts.pinShadow,
 *   showroom.table.anatomy.parts.focusRing, showroom.table.anatomy.parts.maxHeight,
 *   showroom.table.anatomy.parts.resizeStep)
 */
const ANATOMY = [
  { part: 'showroom.table.anatomy.parts.rowHeightMd', token: '--row-height-md' },
  { part: 'showroom.table.anatomy.parts.rowHeightSm', token: '--row-height-sm' },
  { part: 'showroom.table.anatomy.parts.columnWidth', token: '--col-width-md' },
  { part: 'showroom.table.anatomy.parts.headerBackground', token: '--color-bg-secondary' },
  { part: 'showroom.table.anatomy.parts.headerBorder', token: '--color-border-strong' },
  { part: 'showroom.table.anatomy.parts.rowBorder', token: '--color-border' },
  { part: 'showroom.table.anatomy.parts.selectedRow', token: '--color-row-selected' },
  { part: 'showroom.table.anatomy.parts.hoverRow', token: '--color-row-hover' },
  { part: 'showroom.table.anatomy.parts.dangerTint', token: '--color-row-danger' },
  { part: 'showroom.table.anatomy.parts.warningTint', token: '--color-row-warning' },
  { part: 'showroom.table.anatomy.parts.successTint', token: '--color-row-success' },
  { part: 'showroom.table.anatomy.parts.exceptionMark', token: '--row-mark-width' },
  { part: 'showroom.table.anatomy.parts.pinShadow', token: '--shadow-pin-start' },
  { part: 'showroom.table.anatomy.parts.focusRing', token: '--focus-ring-shadow' },
  { part: 'showroom.table.anatomy.parts.maxHeight', token: '--table-max-height' },
  { part: 'showroom.table.anatomy.parts.resizeStep', token: '--col-resize-step' },
] as const;

/**
 * Los cinco tipos de columna: el primer encabezado es el nombre de la entrada, y va igual en
 * todos los idiomas.
 * t(showroom.table.columnTypes.columns.type, showroom.table.columnTypes.columns.align,
 *   showroom.table.columnTypes.columns.font, showroom.table.columnTypes.columns.filter)
 */
const COLUMN_TYPE_COLUMNS: readonly DocColumn[] = [
  { id: 'type', label: 'showroom.table.columnTypes.columns.type' },
  { id: 'align', label: 'showroom.table.columnTypes.columns.align' },
  { id: 'font', label: 'showroom.table.columnTypes.columns.font' },
  { id: 'filter', label: 'showroom.table.columnTypes.columns.filter' },
];

/**
 * t(showroom.table.rowMatrix.columns.state, showroom.table.rowMatrix.columns.background,
 *   showroom.table.rowMatrix.columns.mark, showroom.table.rowMatrix.columns.sample)
 */
const ROW_MATRIX_COLUMNS: readonly DocColumn[] = [
  { id: 'state', label: 'showroom.table.rowMatrix.columns.state' },
  { id: 'background', label: 'showroom.table.rowMatrix.columns.background' },
  { id: 'mark', label: 'showroom.table.rowMatrix.columns.mark' },
  { id: 'sample', label: 'showroom.table.rowMatrix.columns.sample' },
];

/** t(showroom.table.sizes.columns.density, showroom.table.sizes.columns.token) */
const DENSITY_COLUMNS: readonly DocColumn[] = [
  { id: 'density', label: 'showroom.table.sizes.columns.density' },
  { id: 'token', label: 'showroom.table.sizes.columns.token' },
];

/** t(showroom.table.contract.keyboard.columns.key, showroom.table.contract.keyboard.columns.does) */
const KEYBOARD_COLUMNS: readonly DocColumn[] = [
  { id: 'key', label: 'showroom.table.contract.keyboard.columns.key' },
  { id: 'does', label: 'showroom.table.contract.keyboard.columns.does' },
];

/**
 * El nombre que la interfaz da a cada nivel de fila.
 * t(showroom.table.levels.header, showroom.table.levels.line, showroom.table.levels.serial)
 */
const LEVELS: Readonly<Record<ShipmentRow['level'], string>> = {
  'cabecera': 'showroom.table.levels.header',
  'linea': 'showroom.table.levels.line',
  'serie': 'showroom.table.levels.serial',
};

/**
 * Lo que las demos anotan al vuelo: no hacen nada, dicen qué pasó.
 * t(showroom.table.log.none, showroom.table.log.bulkChoice, showroom.table.query.none,
 *   showroom.table.query.search, showroom.table.query.noSearch, showroom.table.query.filters,
 *   showroom.table.query.noFilters, showroom.table.query.noSort, showroom.table.query.page)
 */
const LOG = {
  none: 'showroom.table.log.none',
  bulkChoice: 'showroom.table.log.bulkChoice',
  queryNone: 'showroom.table.query.none',
  search: 'showroom.table.query.search',
  noSearch: 'showroom.table.query.noSearch',
  filters: 'showroom.table.query.filters',
  noFilters: 'showroom.table.query.noFilters',
  noSort: 'showroom.table.query.noSort',
  page: 'showroom.table.query.page',
} as const;

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
    Table,
    TableColumn,
    DemoFrame,
    DocTable,
    PropTable,
    Prose,
    StateMatrix,
    TokenValue,
    TranslocoPipe,
  ],
  templateUrl: './table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomTable {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;
  protected readonly columnTypeColumns = COLUMN_TYPE_COLUMNS;
  protected readonly rowMatrixColumns = ROW_MATRIX_COLUMNS;
  protected readonly densityColumns = DENSITY_COLUMNS;
  protected readonly keyboardColumns = KEYBOARD_COLUMNS;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixStates = MATRIX_STATES;
  protected readonly statuses = injectStatuses();
  protected readonly consumerTemplate = TEMPLATE_SNIPPET;
  protected readonly consumerComponent = COMPONENT_SNIPPET;
  protected readonly sampleCode = SAMPLE_CODE;

  /** La matriz de fila, con los nombres en el idioma activo. */
  protected readonly rowMatrix = translated((translate) =>
    ROW_MATRIX.map((entry) => ({
      ...entry,
      state: translate(entry.state),
      mark: typeof entry.mark === 'string' ? entry.mark : translate(entry.mark.label),
    })),
  );

  /** Una línea: ArrayTableSource ya filtra, ordena y pagina, por eso vive en la librería. */
  protected readonly shipments = new ArrayTableSource<ShipmentRow>(SHIPMENTS, [
    'code',
    'customer',
  ]);

  protected readonly byId = (row: ShipmentRow): unknown => row.id;

  // --------------------------------------------------------------- lote D

  protected readonly rowActions = injectRowActions();
  /** Anular no aplica a lo ya completado: con una función, la tabla lo decide fila por fila. */
  protected readonly rowActionsOf = computed(() => {
    const items = this.rowActions();
    return (row: ShipmentRow): readonly MenuItem[] =>
      items.map((item) =>
        item.id === 'anular' ? { ...item, disabled: row.status === 'completada' } : item,
      );
  });
  protected readonly bulkActions = injectBulkActions();
  protected readonly lazyChildren = lazyChildren;

  /** Las cabeceras solas, para la demo de detalle y menú. */
  protected readonly headers = new ArrayTableSource<ShipmentRow>(HEADER_ROWS, [
    'code',
    'customer',
  ]);

  /** La misma lista, con los hijos detrás de un Observable que tarda. */
  protected readonly lazy = new ArrayTableSource<ShipmentRow>(HEADER_ROWS, [
    'code',
    'customer',
  ]);

  /**
   * Arranca con una muestra; las cinco mil filas se cargan solo cuando se piden,
   * para no hacer lenta la ficha a quien no mira esta demo.
   */
  protected readonly locations = signal<TableSource<LocationRow>>(
    new ArrayTableSource<LocationRow>(generateLocations(SAMPLE_LOCATIONS), [
      'code',
      'aisle',
    ]),
  );

  protected readonly loadedLocations = signal(SAMPLE_LOCATIONS);
  protected readonly totalLocations = TOTAL_LOCATIONS;

  protected readonly paged = new PagedSource();

  protected readonly byLocation = (row: LocationRow): unknown => row.id;

  /** Toda expedición tiene algo que enseñar; una línea suelta no. */
  protected readonly isMaster = (row: ShipmentRow): boolean => row.level === 'cabecera';

  /** Lo último que eligió o pidió cada demo, null mientras no haya nada: el texto sale abajo. */
  private readonly chosenBulk = signal<{ readonly id: string; readonly count: number } | null>(
    null,
  );
  private readonly chosenAction = signal<{ readonly id: string; readonly code: string } | null>(
    null,
  );
  private readonly requestedDownload = signal<string | null>(null);
  private readonly activatedRow = signal<ShipmentRow | null>(null);

  protected readonly selection = signal<readonly ShipmentRow[]>([]);
  protected readonly query = signal<TableQuery | null>(null);

  /** Lo mismo, escrito para quien mira y en el idioma activo: si cambia, se vuelve a escribir. */
  protected readonly lastBulk = translated((translate) => {
    const choice = this.chosenBulk();
    return choice
      ? translate(LOG.bulkChoice, {
          action: labelOf(this.bulkActions(), choice.id),
          count: choice.count,
        })
      : translate(LOG.none);
  });

  protected readonly lastAction = translated((translate) => {
    const choice = this.chosenAction();
    return choice
      ? `${labelOf(this.rowActions(), choice.id)} · ${choice.code}`
      : translate(LOG.none);
  });

  protected readonly lastDownload = translated(
    (translate) => this.requestedDownload() ?? translate(LOG.none),
  );

  protected readonly lastActivated = translated((translate) => {
    const row = this.activatedRow();
    return row ? `${row.code} (${translate(LEVELS[row.level])})` : translate(LOG.none);
  });

  /** La última consulta, en una línea legible. */
  protected readonly querySummary = translated((translate) => {
    const query = this.query();
    if (!query) {
      return translate(LOG.queryNone);
    }
    const filters = Object.keys(query.filters);
    const sort =
      query.sort.length === 0
        ? translate(LOG.noSort)
        : query.sort.map((entry) => `${entry.key} ${entry.direction}`).join(', ');
    const search =
      query.search === ''
        ? translate(LOG.noSearch)
        : translate(LOG.search, { search: query.search });
    const byColumn =
      filters.length === 0
        ? translate(LOG.noFilters)
        : translate(LOG.filters, { keys: filters.join(', ') });
    return `${search} · ${byColumn} · ${sort} · ${translate(LOG.page, { page: query.page })}`;
  });

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

  protected open(event: RowActivateEvent<ShipmentRow>): void {
    this.activatedRow.set(event.row);
  }

  protected loadAll(): void {
    this.locations.set(
      new ArrayTableSource<LocationRow>(generateLocations(TOTAL_LOCATIONS), [
        'code',
        'aisle',
      ]),
    );
    this.loadedLocations.set(TOTAL_LOCATIONS);
  }

  /** No hace nada: lo anota, como el resto de las demos. */
  protected bulk(event: BulkActionEvent<ShipmentRow>): void {
    this.chosenBulk.set({ id: event.item.id, count: event.rows.length });
  }

  protected choose(event: RowMenuEvent<ShipmentRow>): void {
    this.chosenAction.set({ id: event.item.id, code: event.row.code });
  }

  /** No descarga nada, solo lo anota: ninguna demo tiene datos reales ni red. */
  protected download(row: ShipmentRow): void {
    this.requestedDownload.set(row.code);
  }

  /** Cuántas líneas cuelgan de una cabecera, según la lista completa. */
  protected linesOf(row: ShipmentRow): number {
    return SHIPMENTS.find((shipment) => shipment.id === row.id)?.children?.length ?? 0;
  }

  protected tintFor(variant: string): string {
    return TINTS[variant] ?? '';
  }

  protected isTinted(variant: string): boolean {
    return TINTED.has(variant);
  }

  /** El nombre del estado que pinta esa variante, del mismo diccionario que el badge de la tabla. */
  protected labelFor(variant: string): string {
    return Object.values(this.statuses()).find((badge) => badge.variant === variant)?.label ?? '';
  }

  protected isBadge(stateId: string): boolean {
    return stateId === 'badge';
  }
}

/** Líneas de un pre, o null si no había nada que leer. */
function countLines(element: Element | null): number | null {
  const text = element?.textContent;
  return text ? text.trimEnd().split('\n').length : null;
}

/** El texto de una acción por su id, del menú ya traducido; el id si ya no está. */
function labelOf(items: readonly MenuItem[], id: string): string {
  return items.find((item) => item.id === id)?.label ?? id;
}
