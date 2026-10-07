import { DialogModule } from '@angular/cdk/dialog';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations, pixels } from '@ewms/testing';
import { By } from '@angular/platform-browser';
import { defer, Observable, of, Subject, throwError } from 'rxjs';
import { EWMS_DATE_PICKER_MESSAGES } from '../date-picker/date-picker.types';
import { EWMS_FILTER_CHIPS_MESSAGES, type FilterChipsMessages } from '../filters/filter-chips.types';
import { EWMS_PAGINATION_MESSAGES, type PaginationMessages } from '../pagination/pagination.types';
import { EWMS_SPLIT_BUTTON_MESSAGES } from '../split-button/split-button.types';
import { ShortcutsHost } from '../keyboard/shortcuts-host';
import {
  EWMS_SHORTCUT_HELP_MESSAGES,
  EWMS_SHORTCUT_MAP,
  type ShortcutHelpMessages,
  type ShortcutMap,
} from '../keyboard/shortcuts.types';
import { ArrayTableSource } from './array-table-source';
import { TableColumn } from './column';
import { DetailTemplate, EmptyTemplate, Table } from './table';
import type { TablePage, TableQuery, TableSource } from './table-source';
import {
  EWMS_TABLE_VIEW_STORE,
  InMemoryTableViewStore,
  TABLE_VIEWS_VERSION,
} from './table-saved-views.types';
import {
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  type TableFormatters,
  type TableMessages,
} from './table.tokens';
import type {
  BadgeDictionary,
  BulkActionEvent,
  ExportRequest,
  MenuItem,
  TableAggregate,
  TableView,
} from './table.types';

interface Row {
  readonly id: string;
  readonly code: string;
  readonly packages: number;
  readonly date: string;
  readonly status: string;
  readonly children?: readonly Row[];
}

const STATUSES: BadgeDictionary = {
  'pendiente': { variant: 'neutral', label: 'Pendiente' },
  'con-incidencia': { variant: 'danger', label: 'Con incidencia' },
};

const ROWS: readonly Row[] = [
  {
    id: '1',
    code: 'EXP-0001',
    packages: 1200,
    date: '2026-01-15',
    status: 'pendiente',
    children: [
      { id: '1a', code: 'SKU-1', packages: 900, date: '2026-01-16', status: 'pendiente' },
      { id: '1b', code: 'SKU-2', packages: 300, date: '2026-01-17', status: 'con-incidencia' },
    ],
  },
  { id: '2', code: 'EXP-0002', packages: 900, date: '2026-02-03', status: 'con-incidencia' },
  { id: '3', code: 'EXP-0003', packages: 40, date: '2026-03-21', status: 'pendiente' },
];

const MESSAGES: TableMessages = {
  search: 'Buscar en la tabla',
  filterPlaceholder: 'Filtrar',
  filterFrom: 'Desde',
  filterTo: 'Hasta',
  selectAll: 'Seleccionar todas',
  selectRow: 'Seleccionar la fila',
  expand: 'Expandir',
  collapse: 'Contraer',
  rowMenu: 'Acciones',
  loadingChildren: 'Cargando…',
  childrenFailed: 'No se pudo cargar',
  retry: 'Reintentar',
  sortedAscending: 'Orden ascendente',
  sortedDescending: 'Orden descendente',
  filters: (active) => (active === 0 ? 'Filtros' : `Filtros (${active})`),
  clearFilters: 'Limpiar filtros',
  searchChip: 'Búsqueda',
  view: 'Vista',
  resetView: 'Restablecer vista',
  expandAll: 'Expandir todo',
  collapseAll: 'Contraer todo',
  density: 'Densidad',
  views: 'Vistas guardadas',
  viewInitial: 'Vista inicial',
  viewName: 'Nombre de la vista',
  saveAsNew: 'Guardar como nueva',
  saveChanges: 'Guardar cambios',
  renameView: 'Renombrar',
  duplicateView: 'Duplicar',
  deleteView: 'Eliminar vista',
  defaultView: 'Abrir por defecto',
  deleteViewTitle: (name) => `¿Eliminar la vista ${name}?`,
  viewModified: (name) => `${name} (modificada)`,
  viewCopyName: (name) => `${name} (copia)`,
  viewDefaultLabel: (name) => `${name} (por defecto)`,
  densityMd: 'Media',
  densitySm: 'Compacta',
  setAll: 'Todos',
  setNone: 'Ninguno',
  setSummary: (column, chosen, total) =>
    chosen === total ? `${column}: todos` : `${column}: ${chosen} de ${total}`,
  setChosen: (chosen, total) =>
    chosen === total ? 'Todos' : chosen === 0 ? 'Ninguno' : `${chosen} de ${total}`,
  columns: 'Columnas',
  resizeColumn: (column) => `Ancho de la columna ${column}`,
  moveEarlier: (column) => `Subir ${column}`,
  moveLater: (column) => `Bajar ${column}`,
  columnMoved: (column, position, total) => `${column}, posición ${position} de ${total}`,
  columnMenu: (column) => `Opciones de la columna ${column}`,
  columnActions: {
    sortAsc: 'Ordenar ascendente',
    sortDesc: 'Ordenar descendente',
    sortClear: 'Quitar orden',
    pinStart: 'Fijar a la izquierda',
    pinEnd: 'Fijar a la derecha',
    unpin: 'Soltar',
    fit: 'Ajustar al contenido',
    moveLeft: 'Mover a la izquierda',
    moveRight: 'Mover a la derecha',
    hide: 'Ocultar columna',
  },
  sortPriority: (sorted, priority) => `${sorted}, prioridad ${priority}`,
  selectedCount: (count) => `${count} seleccionadas`,
  clearSelection: 'Quitar selección',
  confirmTitle: (action, rows) => `¿${action} ${rows} ${rows === 1 ? 'fila' : 'filas'}?`,
  confirmBody: 'Esta acción no se puede deshacer.',
  confirmCancel: 'Cancelar',
  copied: (rows) => `${rows} filas copiadas`,
  loading: 'Cargando…',
  loadFailed: 'No se pudo cargar la tabla.',
  noData: 'Todavía no hay filas.',
  noResults: 'Ninguna fila coincide.',
  noResultsHint: 'Pruebe con otra búsqueda.',
  export: 'Exportar',
  exportSelected: 'CSV de lo seleccionado',
  copyAll: 'Copiar al portapapeles',
  rowsShown: (shown, total) => (total === null ? `${shown} filas` : `${shown} de ${total} filas`),
  aggregate: (kind) => kind,
  totalsScope: (scope, rows) => `${scope} ${rows}`,
  totalUnavailable: 'sin total',
};

// El paginador y los chips piden los suyos por su propio token, como el Select.
const PAGE_WORDS: PaginationMessages = {
  previousPage: 'Anterior',
  nextPage: 'Siguiente',
  pageOf: (page, pages) => `Página ${page} de ${pages}`,
  rowsTotal: (total) => `${total} filas`,
};

const CHIP_WORDS: FilterChipsMessages = {
  clearFilters: 'Limpiar filtros',
  removeFilter: (column) => `Quitar el filtro ${column}`,
  activeCount: (count) =>
    count === 0 ? 'Sin filtros activos' : count === 1 ? '1 filtro activo' : `${count} filtros activos`,
};

const DATE_WORDS = {
  chooseDate: 'Elegir fecha',
  previousMonth: 'Mes anterior',
  nextMonth: 'Mes siguiente',
  locale: 'es-CR',
};

// Invierte el orden del texto frente al número: solo así la prueba distingue orden crudo de
// orden formateado. Prefijo con letra: la compuerta 10 lee numeral + 3-4 dígitos como color
// crudo, incluso dentro de un comentario (ya rompió la build una vez).
const FORMATTERS: TableFormatters = {
  number: (value) => `n:${String(value)}`,
  date: (value) => `d:${String(value)}`,
};

/** Dos pasadas: la segunda pinta lo que la primera dejó pendiente. Estaba copiada seis veces. */
async function stabilise(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

/** Los tokens que piden la tabla y sus piezas. Estaban copiados en los nueve `TestBed` del archivo. */
const TABLE_PROVIDERS = [
  { provide: EWMS_TABLE_MESSAGES, useValue: MESSAGES },
  { provide: EWMS_PAGINATION_MESSAGES, useValue: PAGE_WORDS },
  { provide: EWMS_FILTER_CHIPS_MESSAGES, useValue: CHIP_WORDS },
  { provide: EWMS_DATE_PICKER_MESSAGES, useValue: DATE_WORDS },
  { provide: EWMS_TABLE_FORMATTERS, useValue: FORMATTERS },
];

@Component({
  template: `
    <ewms-table
      [source]="source()"
      [children]="withTree() ? 'children' : null"
      rowState="status"
      [trackBy]="byId"
      [selectable]="selectable()"
      [quickFilter]="true"
      [allowExport]="allowExport()"
      [density]="density()"
      ariaLabel="Expediciones"
      (rowActivate)="activated = $event.row.code"
      (selectionChange)="selection = $event"
      (queryChange)="lastQuery = $event"
      (filtersCleared)="cleared = cleared + 1"
      [bulkActions]="bulk"
      (bulkAction)="lastBulk = $event"
    >
      <ewms-column key="code" header="Código" [sortable]="true" [filterable]="true" />
      <ewms-column
        key="packages"
        header="Bultos"
        type="number"
        [sortable]="true"
        [filterable]="true"
        [aggregate]="aggregate()"
      />
      <ewms-column key="date" header="Fecha" type="date" [filterable]="true" />
      <ewms-column
        key="status"
        header="Estado"
        type="badge"
        [badges]="statuses"
        [filterable]="true"
      />

      <ng-template ewmsEmpty>
        <p>Ninguna expedición coincide.</p>
      </ng-template>
    </ewms-table>
  `,
  imports: [Table, TableColumn, EmptyTemplate],
})
class TestHost {
  readonly allowExport = signal<() => boolean>(() => true);
  readonly statuses = STATUSES;
  readonly source = signal<TableSource<Row>>(new ArrayTableSource(ROWS, ['code']));
  readonly withTree = signal(true);
  readonly selectable = signal(true);
  readonly density = signal<'md' | 'sm'>('md');
  readonly aggregate = signal<TableAggregate | null>('sum');
  readonly byId = (row: Row): unknown => row.id;

  activated = '';
  selection: readonly Row[] = [];
  lastQuery: TableQuery | null = null;
  cleared = 0;
  readonly bulk: readonly MenuItem[] = [
    { id: 'imprimir', label: 'Imprimir etiquetas' },
    { id: 'anular', label: 'Anular', variant: 'danger' },
  ];
  lastBulk: BulkActionEvent<Row> | null = null;
}

function clearOverlays(): void {
  for (const container of document.querySelectorAll('.cdk-overlay-container')) {
    container.remove();
  }
}

class LazySource implements TableSource<Row> {
  load(): Observable<TablePage<Row>> {
    return of({ rows: ROWS, page: 0, pageSize: 50, total: ROWS.length });
  }
}

describe('Table', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost, Table, TableColumn, EmptyTemplate],
      providers: TABLE_PROVIDERS,
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const settle = (): Promise<void> => stabilise(fixture);

  it('checks the export gate for direct and keyboard copies', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const component = fixture.debugElement.query(By.directive(Table));
    host.allowExport.set(() => false);
    await settle();
    const table = component.componentInstance as Table<Row>;
    table.runExport('csv');
    table.runExport('csv-selected');
    table.runExport('copy');
    const row = fixture.nativeElement.querySelector('tbody tr td') as HTMLElement;
    expect(row).not.toBeNull();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
    expect(writeText).not.toHaveBeenCalled();
  });

  function grid(): HTMLElement {
    return fixture.nativeElement.querySelector('table') as HTMLElement;
  }

  /** Las filas de datos; la fila de estado vacío no cuenta. */
  function bodyRows(): HTMLElement[] {
    return [
      ...fixture.nativeElement.querySelectorAll('tbody tr:not([data-empty-row])'),
    ] as HTMLElement[];
  }

  function emptyRow(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-empty-row]');
  }

  function cellsOf(rowIndex: number): HTMLElement[] {
    return [...(bodyRows()[rowIndex]?.querySelectorAll('td') ?? [])] as HTMLElement[];
  }

  function textOf(rowIndex: number): string {
    return bodyRows()[rowIndex]?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  describe('the grid', () => {
    it('is a treegrid when there are children, and a grid when there are not', async () => {
      expect(grid().getAttribute('role')).toBe('treegrid');

      host.withTree.set(false);
      await settle();
      expect(grid().getAttribute('role')).toBe('grid');
    });

    it('is named, says how many rows and columns it has, and draws one row per root', () => {
      expect(grid().getAttribute('aria-label')).toBe('Expediciones');
      expect(grid().getAttribute('aria-rowcount')).toBe('3');
      // Cuatro columnas declaradas más la casilla.
      expect(grid().getAttribute('aria-colcount')).toBe('5');
      expect(bodyRows().length).toBe(3);
    });

    it('with a search nothing matches: no-results, and its action clears search and filters', async () => {
      const search = fixture.nativeElement.querySelector(
        '[data-quick-filter] input',
      ) as HTMLInputElement;
      search.value = 'no-existe';
      search.dispatchEvent(new Event('input'));
      await settle();

      // `ewmsEmpty` es el «todavía no hay»: con búsqueda activa habla la tabla.
      const empty = emptyRow()?.querySelector('[data-empty-state]') as HTMLElement;
      expect(empty.dataset['emptyState']).toBe('no-results');
      expect(empty.getAttribute('role')).toBe('status');
      expect(bodyRows().length).toBe(0);

      (empty.querySelector('[data-empty-action] button') as HTMLButtonElement).click();
      await settle();
      expect(search.value).toBe('');
      expect(bodyRows().length).toBe(3);
    });
  });

  describe('one frame', () => {
    /** jsdom no maqueta: la caja dice cuánto mide y cuánto desplaza, como un navegador. */
    async function scrollTo(left: number): Promise<void> {
      const box = fixture.nativeElement.querySelector('[data-scroll-box]') as HTMLElement;
      Object.defineProperty(box, 'clientWidth', { configurable: true, value: 300 });
      Object.defineProperty(box, 'scrollWidth', { configurable: true, value: 500 });
      box.scrollLeft = left;
      box.dispatchEvent(new Event('scroll'));
      await settle();
    }
    const edge = (side: string): HTMLElement | null =>
      fixture.nativeElement.querySelector(`[data-edge="${side}"]`);

    it('is the only border around the table, with the status bar inside', () => {
      const frames = fixture.nativeElement.querySelectorAll('[data-table-frame]');
      expect(frames.length).toBe(1);
      expect(frames[0].querySelector('[data-scroll-box]')).not.toBeNull();
      expect(frames[0].querySelector('ewms-table-status')).not.toBeNull();
    });

    it('SAYS THERE ARE MORE COLUMNS on the side they are, and hides it from the reader', async () => {
      await scrollTo(0);
      expect(edge('start')).toBeNull();
      expect(edge('end')?.getAttribute('aria-hidden')).toBe('true');
      expect(edge('end')?.className).toContain('pointer-events-none');

      await scrollTo(100);
      expect(edge('start')).not.toBeNull();
      expect(edge('end')).not.toBeNull();

      await scrollTo(200);
      expect(edge('start')).not.toBeNull();
      expect(edge('end')).toBeNull();
    });
  });

  describe('the tree', () => {
    it('Vista expands everything that needs no request, and folds it all back', async () => {
      (fixture.nativeElement.querySelector('[data-view-menu] button') as HTMLElement).click();
      await settle();
      (document.querySelector('[data-expand-all] button') as HTMLButtonElement).click();
      await settle();
      expect(bodyRows().length).toBe(5);
      (document.querySelector('[data-collapse-all] button') as HTMLButtonElement).click();
      await settle();
      expect(bodyRows().length).toBe(3);
      clearOverlays();
    });

    function toggle(rowIndex: number): void {
      (
        fixture.nativeElement.querySelector(`[data-toggle="${rowIndex}"]`) as HTMLButtonElement
      )?.click();
    }

    it('draws a toggle only on a row that has children', () => {
      expect(fixture.nativeElement.querySelector('[data-toggle="0"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-toggle="1"]')).toBeNull();
    });

    it('expands into the SAME loop one level deeper, says where each row sits, and collapses', async () => {
      toggle(0);
      await settle();
      expect(bodyRows().length).toBe(5);
      expect(bodyRows()[0]?.getAttribute('aria-expanded')).toBe('true');
      expect(bodyRows()[1]?.getAttribute('aria-level')).toBe('2');
      expect(bodyRows()[1]?.classList.contains('is-child')).toBe(true);
      expect(fixture.nativeElement.querySelectorAll('table').length).toBe(1);
      expect(bodyRows()[1]?.getAttribute('aria-setsize')).toBe('2');
      expect(bodyRows()[1]?.getAttribute('aria-posinset')).toBe('1');
      expect(bodyRows()[3]?.getAttribute('aria-setsize')).toBe('3');

      toggle(0);
      await settle();
      expect(bodyRows().length).toBe(3);
    });
  });

  describe('the columns', () => {
    it('formats what it shows, and only what it shows', () => {
      expect(textOf(0)).toContain('n:1200');
      expect(textOf(0)).toContain('d:2026-01-15');
    });

    it('draws a badge from the dictionary; tints the row from THE SAME one, never a neutral one', () => {
      const badge = bodyRows()[1]?.querySelector('ewms-badge');
      expect(badge?.textContent).toContain('Con incidencia');
      expect(badge?.querySelector('svg')).not.toBeNull();
      // `rowState="estado"` lee los badges de la columna `estado`: no pueden discrepar.
      expect(bodyRows()[1]?.className).toContain('bg-row-danger');
      // La barra lateral va en la primera celda (la casilla), no en la fila.
      expect(cellsOf(1)[0]?.className).toContain('shadow-row-mark-danger');
      // Pendiente es `neutral`: solo el badge, sin tinte ni barra.
      expect(bodyRows()[0]?.className).toContain('hover:bg-row-hover');
      expect(cellsOf(0)[0]?.className).not.toContain('shadow-row-mark');
    });

    it('A CUT TEXT SHOWS WHOLE on focus; one that fits has no tooltip', async () => {
      const cut = cellsOf(0)[1]!.querySelector('.truncate') as HTMLElement;
      Object.defineProperty(cut, 'scrollWidth', { configurable: true, value: 300 });
      host.density.set('sm');
      await settle();
      const overlay = (): string => document.querySelector('.cdk-overlay-container')?.textContent ?? '';
      cellsOf(0)[1]!.dispatchEvent(new FocusEvent('focusin'));
      expect(overlay()).toContain('EXP-0001');
      cellsOf(0)[1]!.dispatchEvent(new FocusEvent('focusout'));
      cellsOf(1)[1]!.dispatchEvent(new FocusEvent('focusin'));
      expect(overlay()).not.toContain('EXP-0002');
      clearOverlays();
    });

    it('aligns numbers to the end with even digits, in the body font', () => {
      const numberCell = cellsOf(0)[2];
      expect(numberCell?.className).toContain('tabular-nums');
      expect(numberCell?.className).not.toContain('font-mono');
    });
  });

  describe('sorting', () => {
    function header(key: string): HTMLButtonElement {
      return fixture.nativeElement.querySelector(`[data-sort="${key}"]`) as HTMLButtonElement;
    }

    function ariaSortOf(key: string): string | null {
      return header(key).closest('th')?.getAttribute('aria-sort') ?? null;
    }

    it('SORTS BY THE RAW VALUE, not by the formatted text', async () => {
      // El formateador prefija ambos números: como cadenas ordenan al revés que como números.
      header('packages').click();
      await settle();

      expect(bodyRows().map((row) => row.textContent?.match(/n:\d+/)?.[0])).toEqual([
        'n:40',
        'n:900',
        'n:1200',
      ]);
    });

    it('goes ascending, descending, then back to none', async () => {
      expect(ariaSortOf('packages')).toBeNull();

      header('packages').click();
      await settle();
      expect(ariaSortOf('packages')).toBe('ascending');

      header('packages').click();
      await settle();
      expect(ariaSortOf('packages')).toBe('descending');

      header('packages').click();
      await settle();
      expect(ariaSortOf('packages')).toBeNull();
    });

    it('SHIFT ADDS A COLUMN TO THE SORT, with its priority; aria-sort stays on the first', async () => {
      header('packages').click();
      header('code').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
      await settle();
      expect(host.lastQuery?.sort.map((sort) => sort.key)).toEqual(['packages', 'code']);
      expect(ariaSortOf('code')).toBeNull();
      expect(header('code').querySelector('[data-sort-priority]')?.textContent?.trim()).toBe('2');
      // Ordenadas en primario; las demás, en el secundario de la cabecera.
      expect(header('code').className).toContain('text-primary');
      expect(header('code').querySelector('svg[aria-label]')?.getAttribute('aria-label')).toBe(
        'Orden ascendente, prioridad 2',
      );

      // Shift+Enter la cicla en su lugar; un clic simple deja solo esa (y la tercera vez, ninguna).
      const shiftEnter = { key: 'Enter', shiftKey: true, bubbles: true };
      header('code').dispatchEvent(new KeyboardEvent('keydown', shiftEnter));
      await settle();
      expect(host.lastQuery?.sort[1]).toEqual({ key: 'code', direction: 'desc' });
      header('code').click();
      await settle();
      expect(host.lastQuery?.sort).toEqual([]);
    });
  });

  describe('the filter row', () => {
    function boxes(key: string): HTMLInputElement[] {
      return [
        ...fixture.nativeElement.querySelectorAll(`[data-filter="${key}"] input`),
      ] as HTMLInputElement[];
    }

    function type(input: HTMLInputElement, value: string): void {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }

    it('THE SHAPE COMES FROM THE COLUMN TYPE: one box for text and dates, two for numbers', () => {
      expect(boxes('code').length).toBe(1);
      expect(boxes('packages').length).toBe(2);
      // La fecha es un date picker de rango: un campo, la fila queda en una altura.
      expect(boxes('date').length).toBe(1);
    });

    it('filters text by substring (the whole query goes out), and a number range', async () => {
      type(boxes('code')[0]!, '0002');
      await settle();
      expect(bodyRows().length).toBe(1);
      expect(host.lastQuery?.filters).toEqual({ code: '0002' });
      expect(host.lastQuery?.page).toBe(0);
      // Un control reconstruido en cada ciclo borraría lo tipeado.
      expect(boxes('code')[0]?.value).toBe('0002');
      type(boxes('code')[0]!, '');
      const [min, max] = boxes('packages');
      type(min!, '100');
      type(max!, '1000');
      await settle();
      expect(bodyRows().length).toBe(1);
      expect(textOf(0)).toContain('EXP-0002');
    });

    it('A CLEARED BOX IS UNBOUNDED, NOT ZERO', async () => {
      const [min, max] = boxes('packages');
      type(max!, '1000');
      await settle();
      expect(bodyRows().length).toBe(2);

      type(min!, '950');
      await settle();
      expect(bodyRows().length).toBe(0);

      type(min!, '');
      await settle();
      expect(bodyRows().length).toBe(2);
    });

    it('filters a date range, written in the language of the app', async () => {
      const [range] = boxes('date');
      type(range!, '1/2/2026 – 28/2/2026');
      range!.focus();
      range!.blur();
      await settle();
      expect(bodyRows().length).toBe(1);
      expect(textOf(0)).toContain('EXP-0002');
      expect(host.lastQuery?.filters).toEqual({ date: { from: '2026-02-01', to: '2026-02-28' } });

      type(range!, '');
      range!.focus();
      range!.blur();
      await settle();
      expect(bodyRows().length).toBe(3);
    });

  });

  describe('selection', () => {
    function checkboxes(): HTMLInputElement[] {
      return [
        ...fixture.nativeElement.querySelectorAll('tbody input[type="checkbox"]'),
      ] as HTMLInputElement[];
    }

    function selectAll(): HTMLInputElement {
      return fixture.nativeElement.querySelector(
        'thead input[type="checkbox"]',
      ) as HTMLInputElement;
    }

    /** Como el navegador: primero da vuelta la casilla, después avisa. */
    function tick(box: HTMLInputElement): void {
      box.checked = !box.checked;
      box.dispatchEvent(new Event('change'));
    }

    it('emits the chosen rows, and SELECTED WINS OVER THE STATE TINT', async () => {
      tick(checkboxes()[1]!);
      await settle();
      expect(host.selection.map((row) => row.code)).toEqual(['EXP-0002']);
      expect(bodyRows()[1]?.getAttribute('aria-selected')).toBe('true');
      // El estado ya lo dice el badge (ícono y texto); la selección, solo tinte y casilla.
      expect(bodyRows()[1]?.className).toContain('bg-row-selected');
      expect(bodyRows()[1]?.className).not.toContain('bg-row-danger');
      // …y la excepción conserva su marca lateral.
      expect(cellsOf(1)[0]?.className).toContain('shadow-row-mark-danger');
    });

    it('the header box ticks what is on screen, and goes mixed in between', async () => {
      tick(checkboxes()[0]!);
      await settle();
      expect(selectAll().getAttribute('aria-checked')).toBe('mixed');

      tick(selectAll());
      await settle();
      expect(host.selection.length).toBe(3);

      tick(selectAll());
      await settle();
      expect(host.selection.length).toBe(0);
    });

    it('SHIFT MARKS A RANGE from the last one touched, by click and by Space', async () => {
      checkboxes()[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      checkboxes()[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
      await settle();
      expect(host.selection.map((row) => row.code)).toEqual(['EXP-0001', 'EXP-0002', 'EXP-0003']);

      // Con el teclado: se limpia y el rango va de la fila 2 a la 0.
      (fixture.nativeElement.querySelector('[data-clear-selection] button') as HTMLElement).click();
      await settle();
      const space = (row: number, shiftKey: boolean): void => {
        const cell = fixture.nativeElement.querySelector(`[data-cell="${row}-0"]`) as HTMLElement;
        cell.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', shiftKey, bubbles: true }));
      };
      space(2, false);
      space(0, true);
      await settle();
      expect(host.selection.length).toBe(3);
    });

    it('the bulk bar says how many, runs the declared actions and clears, out loud', async () => {
      tick(checkboxes()[0]!);
      tick(checkboxes()[2]!);
      await settle();
      const bar = fixture.nativeElement.querySelector('[data-bulk-bar]') as HTMLElement;
      expect(bar.querySelector('[data-selected-count]')?.textContent?.trim()).toBe(
        '2 seleccionadas',
      );
      expect(fixture.nativeElement.querySelector('[data-table-announce]')?.textContent).toBe(
        '2 seleccionadas',
      );
      expect(bar.querySelector('[data-bulk-action="anular"] button')?.className).toContain(
        'danger',
      );

      (bar.querySelector('[data-bulk-action="imprimir"] button') as HTMLElement).click();
      await settle();
      expect(host.lastBulk?.item.id).toBe('imprimir');
      expect(host.lastBulk?.rows.map((row) => row.code)).toEqual(['EXP-0001', 'EXP-0003']);

      // Una acción deshabilitada se ve y no hace nada.
      host.lastBulk = null;
      (fixture.debugElement.query(By.directive(Table)).componentInstance as Table<Row>).runBulk({
        id: 'x',
        label: 'Deshabilitada',
        disabled: true,
      });
      expect(host.lastBulk).toBeNull();

      (bar.querySelector('[data-clear-selection] button') as HTMLElement).click();
      await settle();
      expect(host.selection).toEqual([]);
      expect(fixture.nativeElement.querySelector('[data-bulk-bar]')).toBeNull();
    });

    it('Ctrl+C copies what is selected, or the focused row, as tab-separated text', async () => {
      const copied: string[] = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (text: string) => (copied.push(text), Promise.resolve()) },
      });
      const press = (row: number): void => {
        const cell = fixture.nativeElement.querySelector(`[data-cell="${row}-1"]`) as HTMLElement;
        cell.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }),
        );
      };

      press(1);
      await settle();
      // Encabezados y datos crudos: el número sin formato, la fecha ISO, el estado por su etiqueta.
      expect(copied[0]).toBe(
        'Código\tBultos\tFecha\tEstado\nEXP-0002\t900\t2026-02-03\tCon incidencia',
      );
      expect(fixture.nativeElement.querySelector('[data-table-announce]')?.textContent).toBe(
        '1 filas copiadas',
      );

      tick(checkboxes()[0]!);
      tick(checkboxes()[2]!);
      await settle();
      press(1);
      await settle();
      expect(copied[1]?.split('\n').map((line) => line.split('\t')[0])).toEqual([
        'Código',
        'EXP-0001',
        'EXP-0003',
      ]);
    });

    it('is not rendered at all when the table is not selectable', async () => {
      host.selectable.set(false);
      await settle();
      expect(fixture.nativeElement.querySelector('tbody input[type="checkbox"]')).toBeNull();
      expect(bodyRows()[0]?.getAttribute('aria-selected')).toBeNull();
    });
  });

  describe('the keyboard', () => {
    function press(rowIndex: number, columnIndex: number, key: string, ctrlKey = false): void {
      const cell = fixture.nativeElement.querySelector(
        `[data-cell="${rowIndex}-${columnIndex}"]`,
      ) as HTMLElement;
      cell.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true }));
    }

    // La parada puede ser la celda o, en la de selección, su checkbox (APG grid): se lee su celda.
    function tabbable(): string[] {
      return [...fixture.nativeElement.querySelectorAll('tbody [tabindex="0"]')].map(
        (stop) => (stop as HTMLElement).closest<HTMLElement>('[data-cell]')?.dataset['cell'] ?? '',
      );
    }

    // La casilla marca la parada rotatoria pero sigue en el orden de Tab, como todo control de una
    // celda: con -1 en las demás, la E2E del orden de Tab encontró 11 inalcanzables.
    it('leaves every row checkbox reachable by Tab', () => {
      const boxes = [
        ...fixture.nativeElement.querySelectorAll('tbody input[type="checkbox"]'),
      ] as HTMLInputElement[];
      expect(boxes.length).toBeGreaterThan(1);
      expect(boxes.filter((box) => box.tabIndex < 0).length).toBe(0);
    });

    it('is ONE tab stop; moves down a column, and stops at the ends instead of wrapping', async () => {
      expect(tabbable()).toEqual(['0-0']);
      press(0, 1, 'ArrowDown');
      await settle();
      expect(tabbable()).toEqual(['1-0']);
      press(1, 0, 'ArrowUp');
      press(0, 0, 'ArrowUp');
      await settle();
      expect(tabbable()).toEqual(['0-0']);
    });

    it('ARROW RIGHT EXPANDS A PARENT before moving; left goes to the parent, then collapses', async () => {
      press(0, 0, 'ArrowRight');
      await settle();
      expect(bodyRows().length).toBe(5);
      press(0, 0, 'ArrowRight');
      await settle();
      expect(tabbable()).toEqual(['0-1']);

      press(1, 1, 'ArrowLeft');
      press(1, 0, 'ArrowLeft');
      await settle();
      expect(tabbable()).toEqual(['0-0']);

      press(0, 0, 'ArrowLeft');
      await settle();
      expect(bodyRows().length).toBe(3);
    });

    it('Home and End walk the row, and with Ctrl the table', async () => {
      press(0, 0, 'End');
      await settle();
      expect(tabbable()).toEqual(['0-4']);

      press(0, 4, 'Home');
      await settle();
      expect(tabbable()).toEqual(['0-0']);

      press(0, 0, 'End', true);
      await settle();
      expect(tabbable()).toEqual(['2-4']);
    });

    it('Enter activates the row, and so does a double click; Space ticks it', async () => {
      press(1, 0, 'Enter');
      await settle();
      expect(host.activated).toBe('EXP-0002');

      host.activated = '';
      bodyRows()[2]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      expect(host.activated).toBe('EXP-0003');

      // Espacio marca la fila, y no desplaza la página.
      const cell = fixture.nativeElement.querySelector('[data-cell="1-0"]') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      cell.dispatchEvent(event);
      await settle();

      expect(host.selection.map((row) => row.code)).toEqual(['EXP-0002']);
      expect(event.defaultPrevented).toBe(true);
    });

  });

  describe('density', () => {
    it('takes its height from a token; chosen in Vista, «Restablecer vista» brings it back', async () => {
      expect(bodyRows()[0]?.style.height).toBe('var(--row-height-md)');
      (fixture.nativeElement.querySelector('[data-view-menu] button') as HTMLElement).click();
      await settle();
      const reset = (): HTMLButtonElement =>
        document.querySelector('[data-reset-view] button') as HTMLButtonElement;
      expect(reset().disabled).toBe(true);
      (document.querySelector('[data-density="sm"] input') as HTMLInputElement).click();
      await settle();
      expect(bodyRows()[0]?.style.height).toBe('var(--row-height-sm)');
      expect(reset().disabled).toBe(false);
      reset().click();
      await settle();
      expect(bodyRows()[0]?.style.height).toBe('var(--row-height-md)');
      expect(reset().disabled).toBe(true);
      clearOverlays();
    });

    it('the panel closes on Escape back to its button, on a click outside and on Tab away', async () => {
      const button = fixture.nativeElement.querySelector(
        '[data-view-menu] button',
      ) as HTMLButtonElement;
      const panel = (): HTMLElement | null => document.querySelector('[role="dialog"]');
      const open = async (): Promise<void> => {
        button.click();
        await settle();
        await Promise.resolve();
      };

      await open();
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(document.querySelector('[data-density="md"] input'));
      panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(button);

      await open();
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(panel()).toBeNull();

      await open();
      panel()!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: button }));
      await settle();
      expect(panel()).toBeNull();

      await open();
      button.click();
      await settle();
      expect(panel()).toBeNull();
      clearOverlays();
    });
  });

  describe('the toolbar and the hidden filters', () => {
    const toggle = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('[data-filters-toggle] button') as HTMLButtonElement;
    const filterRow = (): HTMLElement =>
      fixture.nativeElement.querySelector('[data-filter-row]') as HTMLElement;
    const chips = (): HTMLElement[] =>
      [...fixture.nativeElement.querySelectorAll('[data-chip]')] as HTMLElement[];

    async function filterCode(value: string): Promise<void> {
      const box = fixture.nativeElement.querySelector(
        '[data-filter="code"] input',
      ) as HTMLInputElement;
      box.value = value;
      box.dispatchEvent(new Event('input'));
      await settle();
    }

    it('hides the filter row by default, says what it controls, and HIDING NEVER HIDES A FILTER', async () => {
      expect(filterRow().hidden).toBe(true);
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(toggle().getAttribute('aria-controls')).toBe(filterRow().id);

      toggle().click();
      await settle();
      expect(filterRow().hidden).toBe(false);
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      toggle().click();
      await filterCode('0002');
      expect(toggle().textContent?.trim()).toBe('Filtros (1)');
      expect(chips().map((chip) => chip.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        'Código: 0002',
      ]);
      expect(bodyRows().length).toBe(1);
    });

    it('THE FILTER ROW WEIGHS LESS THAN THE HEADER, and the strong line goes down with it', async () => {
      const head = (): HTMLElement =>
        fixture.nativeElement.querySelector('thead th[data-col="code"]') as HTMLElement;
      expect(head().className).toContain('border-strong');

      toggle().click();
      await settle();
      // Arriba una línea sutil; abajo, la fuerte que separa del cuerpo. Aire arriba y abajo.
      expect(head().className).toContain('border-default');
      expect(head().className).not.toContain('border-strong');
      const cell = filterRow().querySelector('td:last-child') as HTMLElement;
      expect(cell.className).toContain('border-strong');
      expect(cell.className).toContain('bg-canvas');
      expect(cell.className).toContain('py-2');
      // Los campos son Small y conservan su borde de control.
      expect(filterRow().querySelector('[data-filter="code"] input')?.className).toContain('h-8');
    });

    it('the chip × takes that filter off, box included; «Limpiar filtros» takes them all', async () => {
      await filterCode('0002');
      chips()[0]!.querySelector('button')!.click();
      await settle();
      expect(bodyRows().length).toBe(3);
      expect(chips().length).toBe(0);
      expect(
        (fixture.nativeElement.querySelector('[data-filter="code"] input') as HTMLInputElement)
          .value,
      ).toBe('');

      await filterCode('EXP');
      (fixture.nativeElement.querySelector('[data-clear-filters]') as HTMLButtonElement).click();
      await settle();
      expect(host.lastQuery?.filters).toEqual({});
      expect(toggle().textContent?.trim()).toBe('Filtros');
    });

    it('THE CHIPS SAY HOW MANY, and the reader hears the count only when it changes', async () => {
      const live = (): string =>
        fixture.nativeElement.querySelector('[data-filter-count-live]')?.textContent?.trim() ?? '';
      const count = (): string =>
        fixture.nativeElement.querySelector('[data-filter-count]')?.textContent?.trim() ?? '';
      // Al nacer la región existe y está callada: una tabla que carga no anuncia nada.
      expect(fixture.nativeElement.querySelector('[data-filter-count-live]').getAttribute('role')).toBe(
        'status',
      );
      expect(live()).toBe('');
      expect(count()).toBe('');

      await filterCode('EXP');
      expect(count()).toBe('1 filtro activo');
      expect(live()).toBe('1 filtro activo');

      const min = fixture.nativeElement.querySelector(
        '[data-filter="packages"] input',
      ) as HTMLInputElement;
      min.value = '100';
      min.dispatchEvent(new Event('input'));
      await settle();
      expect(count()).toBe('2 filtros activos');
      expect(live()).toBe('2 filtros activos');

      // Cambiar el valor de un filtro puesto no mueve la cuenta: nada nuevo que decir.
      await filterCode('EXP-0');
      expect(live()).toBe('2 filtros activos');

      (fixture.nativeElement.querySelector('[data-clear-filters]') as HTMLButtonElement).click();
      await settle();
      expect(count()).toBe('');
      expect(live()).toBe('Sin filtros activos');
    });

    it('THE SEARCH IS A CHIP TOO: its × empties the box; «Limpiar filtros» takes search and columns', async () => {
      const search = (): HTMLInputElement =>
        fixture.nativeElement.querySelector('[data-quick-filter] input') as HTMLInputElement;
      search().value = '0002';
      search().dispatchEvent(new Event('input'));
      await settle();
      expect(chips().map((chip) => chip.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        'Búsqueda: 0002',
      ]);
      expect(host.lastQuery?.search).toBe('0002');

      chips()[0]!.querySelector('button')!.click();
      await settle();
      expect(search().value).toBe('');
      expect(host.lastQuery?.search).toBe('');
      expect(chips().length).toBe(0);

      search().value = 'EXP';
      search().dispatchEvent(new Event('input'));
      await filterCode('0001');
      expect(chips().map((chip) => chip.dataset['chip'])).toEqual([':search', 'code']);
      (fixture.nativeElement.querySelector('[data-clear-filters]') as HTMLButtonElement).click();
      await settle();
      expect(host.lastQuery?.search).toBe('');
      expect(host.lastQuery?.filters).toEqual({});
      expect(search().value).toBe('');
      // Los chips no limpian lo de la pantalla: eso es del estado vacío (`filtersCleared`).
      expect(host.cleared).toBe(0);
    });

    it('writes each chip in the shape of its column: ranges with their bounds', async () => {
      const [min, max] = [
        ...fixture.nativeElement.querySelectorAll('[data-filter="packages"] input'),
      ] as HTMLInputElement[];
      min!.value = '100';
      min!.dispatchEvent(new Event('input'));
      await settle();
      expect(chips()[0]?.textContent).toContain('≥ n:100');

      max!.value = '1000';
      max!.dispatchEvent(new Event('input'));
      await settle();
      expect(chips()[0]?.textContent).toContain('n:100 – n:1000');

      min!.value = '';
      min!.dispatchEvent(new Event('input'));
      await settle();
      expect(chips()[0]?.textContent).toContain('≤ n:1000');

      const range = fixture.nativeElement.querySelector(
        '[data-filter="date"] input',
      ) as HTMLInputElement;
      range.value = '1/2/2026 – 28/2/2026';
      range.dispatchEvent(new Event('input'));
      range.focus();
      range.blur();
      await settle();
      expect(chips()[1]?.textContent).toContain('d:2026-02-01 – d:2026-02-28');
    });

    describe('a badge column: a set of its states', () => {
      const trigger = (): HTMLButtonElement =>
        fixture.nativeElement.querySelector('[data-filter="status"] button') as HTMLButtonElement;
      const box = (selector: string): HTMLInputElement =>
        document.querySelector(`${selector} input`) as HTMLInputElement;
      /** El nombre accesible entero, y lo que se ve: la cuenta sola, bajo la cabecera que nombra. */
      const name = (): string => trigger().querySelector('.sr-only')?.textContent?.trim() ?? '';
      const caption = (): string =>
        trigger().querySelector('.sr-only')?.nextElementSibling?.textContent?.trim() ?? '';

      async function openSet(): Promise<void> {
        toggle().click();
        await settle();
        trigger().click();
        await settle();
      }

      afterEach(clearOverlays);

      it('opens with every state ticked, and unticking one drops its rows', async () => {
        await openSet();
        expect(name()).toBe('Estado: todos');
        expect(caption()).toBe('Todos');
        expect(box('[data-set-all]').checked).toBe(true);

        box('[data-set-option="pendiente"]').click();
        await settle();
        expect(bodyRows().map((row) => row.textContent)).toEqual([
          expect.stringContaining('EXP-0002'),
        ]);
        expect(host.lastQuery?.filters).toEqual({ status: ['con-incidencia'] });
        // Lo que se ve está dentro del nombre (WCAG 2.5.3): la cabecera ya dice la columna.
        expect(name()).toBe('Estado: 1 de 2');
        expect(caption()).toBe('1 de 2');
        expect(box('[data-set-all]').getAttribute('aria-checked')).toBe('mixed');
        expect(chips()[0]?.textContent).toContain('Estado: Con incidencia');
        await expectNoAxeViolations(document.querySelector('.cdk-overlay-container')!);
      });

      it('«Todos» unticked is none at all; ticked again, the filter is gone', async () => {
        await openSet();
        box('[data-set-all]').click();
        await settle();
        expect(bodyRows().length).toBe(0);
        expect(chips()[0]?.textContent).toContain('Estado: Ninguno');
        expect(caption()).toBe('Ninguno');

        box('[data-set-all]').click();
        await settle();
        expect(host.lastQuery?.filters).toEqual({});
        expect(bodyRows().length).toBe(3);

        // Volver a marcar la última que faltaba también borra el filtro: «todas» no filtra.
        box('[data-set-option="pendiente"]').click();
        await settle();
        box('[data-set-option="pendiente"]').click();
        await settle();
        expect(host.lastQuery?.filters).toEqual({});
      });
    });

    // Expandida, con selección, filtros abiertos y un chip: todo lo que la barra suma, junto.
    it('has no axe violations expanded, with a selection, the filters open and a chip', async () => {
      (fixture.nativeElement.querySelector('[data-toggle="0"]') as HTMLButtonElement).click();
      const box = fixture.nativeElement.querySelector('tbody input[type="checkbox"]');
      box.checked = true;
      box.dispatchEvent(new Event('change'));
      toggle().click();
      await filterCode('EXP');
      await expectNoAxeViolations(fixture.nativeElement);
    });
  });

  describe('the status bar and the totals row', () => {
    const status = (): string =>
      (fixture.nativeElement.querySelector('[data-table-status]') as HTMLElement).textContent
        ?.replace(/\s+/g, ' ')
        .trim() ?? '';
    const total = (key: string): HTMLElement =>
      fixture.nativeElement.querySelector(`tfoot [data-total="${key}"]`) as HTMLElement;
    const said = (key: string): string =>
      total(key).textContent?.replace(/\s+/g, ' ').trim() ?? '';

    it('the status bar counts rows; the totals sit in a footer, one cell per column', () => {
      expect(status()).toBe('3 de 3 filas');
      const foot = fixture.nativeElement.querySelector('tfoot[data-totals]') as HTMLElement;
      expect(foot.className).toContain('sticky');
      expect(foot.className).toContain('bottom-0');
      // Alineada: tantas celdas como la cabecera, en el mismo orden.
      const heads = [...fixture.nativeElement.querySelectorAll('thead tr:first-child th')];
      expect(foot.querySelectorAll('td').length).toBe(heads.length);
      // Todo lo filtrado de la fuente en memoria, sin contar dos veces las hijas: 1200 + 900 + 40.
      expect(said('packages')).toBe('sum: n:2140');
      expect(total('code').textContent?.trim()).toBe('all 3');
    });

    it('OVER THE SELECTION WHEN THERE IS ONE, and says whose total it is', async () => {
      const boxes = [
        ...fixture.nativeElement.querySelectorAll('tbody input[type="checkbox"]'),
      ] as HTMLInputElement[];
      for (const box of [boxes[0]!, boxes[2]!]) {
        box.checked = true;
        box.dispatchEvent(new Event('change'));
      }
      await settle();
      expect(status()).toBe('3 de 3 filas 2 seleccionadas');
      expect(said('packages')).toBe('sum: n:1240');
      expect(total('code').textContent?.trim()).toBe('selected 2');
    });

    it('with a filter it is the total of the filtered rows, not only the page', async () => {
      const box = fixture.nativeElement.querySelector('[data-filter="code"] input') as HTMLInputElement;
      box.value = '0002';
      box.dispatchEvent(new Event('input'));
      await settle();
      expect(total('code').textContent?.trim()).toBe('filtered 1');
      expect(said('packages')).toBe('sum: n:900');
    });

    it('averages, counts, and a remote source that does not count shows a dash, never a number', async () => {
      host.aggregate.set('avg');
      await settle();
      expect(said('packages')).toBe('avg: n:713.3333333333334');
      host.aggregate.set('max');
      await settle();
      expect(said('packages')).toBe('max: n:1200');

      // Remota con total: la página, y lo dice.
      host.aggregate.set('count');
      host.source.set({ load: () => of({ rows: ROWS, page: 0, pageSize: 3, total: 30 }) });
      await settle();
      expect(total('code').textContent?.trim()).toBe('page 3');
      expect(said('packages')).toBe('count: n:3');

      // Remota que no cuenta: «—», y el lector oye por qué.
      host.source.set({ load: () => of({ rows: ROWS, page: 0, pageSize: 50, total: null }) });
      await settle();
      expect(status()).toBe('3 filas');
      expect(said('packages')).toBe('count: —sin total');
      expect(total('packages').querySelector('[aria-hidden="true"]')?.textContent).toBe('—');
    });

    it('has no footer when no column adds up, and no axe violations when it has one', async () => {
      await expectNoAxeViolations(fixture.nativeElement);
      host.aggregate.set(null);
      await settle();
      expect(fixture.nativeElement.querySelector('tfoot')).toBeNull();
    });
  });

  describe('a source that misbehaves', () => {
    it('an empty page is the projected no-data; with no total it keeps working', async () => {
      host.source.set({ load: () => of({ rows: [], page: 0, pageSize: 50, total: 0 }) });
      await settle();
      expect(fixture.nativeElement.textContent).toContain('Ninguna expedición coincide');
      host.source.set(new LazySource());
      await settle();
      expect(bodyRows().length).toBe(3);
    });
  });
});

describe('Table with a failing source', () => {
  async function mount(source: TableSource<Row>): Promise<ComponentFixture<TestHost>> {
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: TABLE_PROVIDERS,
    }).compileComponents();
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.source.set(source);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  // El reintento pasa por el mismo switchMap: prueba también que el error no mató la suscripción.
  it('says the table failed and offers a retry, instead of an empty page', async () => {
    let calls = 0;
    const fixture = await mount({
      // La primera falla; el reintento contesta.
      load: () =>
        (calls += 1) === 1
          ? throwError(() => new Error('boom'))
          : of({ rows: ROWS, page: 0, pageSize: 50, total: 3 }),
    });

    const failure = fixture.nativeElement.querySelector('[data-load-error]') as HTMLElement;
    expect(failure.textContent).toContain('No se pudo cargar la tabla.');
    expect(fixture.nativeElement.querySelector('[data-empty-row]')).toBeNull();

    (failure.querySelector('[data-empty-action] button') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(calls).toBe(2);
    expect(fixture.nativeElement.querySelector('[data-load-error]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('tbody tr:not([data-empty-row])').length).toBe(3);
  });

  it('LOADING NEVER EMPTIES THE TABLE: the rows stay, dimmed, and it says it is busy', async () => {
    const pending = new Subject<TablePage<Row>>();
    const fixture = await mount({ load: () => pending });

    const table = fixture.nativeElement.querySelector('table') as HTMLElement;
    expect(table.getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('[data-loading-table]')?.textContent).toContain(
      'Cargando…',
    );

    pending.next({ rows: ROWS, page: 0, pageSize: 50, total: 3 });
    fixture.detectChanges();
    expect(table.hasAttribute('aria-busy')).toBe(false);

    // Otra consulta en camino: las filas se quedan, atenuadas, en vez de vaciar la tabla.
    const next = new Subject<TablePage<Row>>();
    fixture.componentInstance.source.set({ load: () => next });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr:not([data-empty-row])').length).toBe(3);
    expect(fixture.nativeElement.querySelector('tbody').className).toContain('opacity-60');
  });
});

// `[children]` como Observable es parte del contrato: cientos de líneas no viajan con la lista.
describe('Table with lazy children', () => {
  interface Lazy {
    readonly id: string;
    readonly code: string;
  }

  const ROOTS: readonly Lazy[] = [{ id: 'r1', code: 'EXP-1' }];
  const KIDS: readonly Lazy[] = [
    { id: 'k1', code: 'SKU-1' },
    { id: 'k2', code: 'SKU-2' },
  ];

  @Component({
    template: `
      <ewms-table [source]="source" [children]="children" [trackBy]="byId" ariaLabel="Perezosa">
        <ewms-column key="code" header="Código" />
      </ewms-table>
    `,
    imports: [Table, TableColumn],
  })
  class LazyHost {
    readonly source = new ArrayTableSource(ROOTS);
    readonly byId = (row: Lazy): unknown => row.id;
    pending = new Subject<readonly Lazy[]>();
    // Cuenta suscripciones, no llamadas: la tabla llama al resolvedor en cada render.
    subscriptions = 0;
    readonly children = (): Observable<readonly Lazy[]> =>
      defer(() => {
        this.subscriptions += 1;
        return this.pending;
      });
  }

  let fixture: ComponentFixture<LazyHost>;
  let host: LazyHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LazyHost, Table, TableColumn],
      providers: TABLE_PROVIDERS,
    }).compileComponents();
    fixture = TestBed.createComponent(LazyHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const settle = (): Promise<void> => stabilise(fixture);

  function toggle(): void {
    (fixture.nativeElement.querySelector('[data-toggle="0"]') as HTMLButtonElement).click();
  }

  it('draws the toggle before any child exists, a busy row on the way, then the children', async () => {
    // Devolver un Observable ya afirma que hay hijos: si no, nadie podría pedirlos.
    expect(fixture.nativeElement.querySelector('[data-toggle="0"]')).not.toBeNull();
    toggle();
    await settle();
    const loading = fixture.nativeElement.querySelector('[data-loading="0"]');
    expect(loading?.getAttribute('aria-busy')).toBe('true');
    expect(loading?.textContent).toContain('Cargando…');

    host.pending.next(KIDS);
    host.pending.complete();
    await settle();

    expect(fixture.nativeElement.querySelector('[data-loading="0"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('tbody tr:not([data-empty-row])').length).toBe(3);

    // Pide una sola vez, por más que se abra la fila.
    toggle();
    await settle();
    toggle();
    await settle();
    expect(host.subscriptions).toBe(1);
  });

  it('shows the failure in line, expanded; folded it goes away; the retry can succeed', async () => {
    toggle();
    await settle();

    host.pending.error(new Error('boom'));
    await settle();

    const failed = fixture.nativeElement.querySelector('[data-failed="0"]');
    expect(failed?.textContent).toContain('No se pudo cargar');
    expect(fixture.nativeElement.querySelector('[data-retry="0"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('tbody tr')?.getAttribute('aria-expanded')).toBe(
      'true',
    );

    toggle();
    await settle();
    // El fallo se recuerda (el reintento sigue andando), pero no se pinta bajo un padre plegado.
    expect(fixture.nativeElement.querySelector('[data-failed="0"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-loading="0"]')).toBeNull();

    // Reabierta, reintenta, y el segundo intento puede salir bien.
    toggle();
    await settle();
    host.pending = new Subject<readonly Lazy[]>();
    (fixture.nativeElement.querySelector('[data-retry="0"]') as HTMLButtonElement).click();
    await settle();
    expect(fixture.nativeElement.querySelector('[data-loading="0"]')).not.toBeNull();

    host.pending.next(KIDS);
    host.pending.complete();
    await settle();

    expect(fixture.nativeElement.querySelector('[data-failed="0"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('tbody tr:not([data-empty-row])').length).toBe(3);
  });
});

describe('Table paging', () => {
  interface Small {
    readonly id: number;
  }

  const MANY: readonly Small[] = Array.from({ length: 7 }, (_, index) => ({ id: index }));

  @Component({
    template: `
      <ewms-table [source]="source" [pageSize]="3" [trackBy]="byId" ariaLabel="Paginada">
        <ewms-column key="id" header="Id" type="number" />
      </ewms-table>
    `,
    imports: [Table, TableColumn],
  })
  class PagedHost {
    readonly source = new ArrayTableSource(MANY);
    readonly byId = (row: Small): unknown => row.id;
  }

  it('asks for one page at a time, moves between them, and without a total has no count', async () => {
    await TestBed.configureTestingModule({
      imports: [PagedHost],
      providers: TABLE_PROVIDERS,
    }).compileComponents();
    const fixture = TestBed.createComponent(PagedHost);
    const table = fixture.debugElement.query(By.directive(Table)).componentInstance as {
      goToPage(page: number): void;
      pageCount(): number | null;
      page: { set(value: TablePage<Small>): void };
    };
    const rows = async (page?: number): Promise<number> => {
      if (page !== undefined) {
        table.goToPage(page);
      }
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture.nativeElement.querySelectorAll('tbody tr:not([data-empty-row])').length;
    };
    expect(await rows()).toBe(3);
    expect(table.pageCount()).toBe(3);
    expect(await rows(2)).toBe(1);
    // Fuera de rango se acota: una página inalcanzable es una pantalla vacía sin salida.
    expect(await rows(99)).toBe(1);
    expect(await rows(-5)).toBe(3);

    // Sin total no hay paginador: no puede prometer una última página.
    table.page.set({ rows: MANY.slice(0, 3), page: 0, pageSize: 3, total: null });
    fixture.detectChanges();
    expect(table.pageCount()).toBeNull();
    table.goToPage(2);
    expect(table.pageCount()).toBeNull();
  });
});

const MENU: readonly MenuItem[] = [
  { id: 'ver', label: 'Ver detalle' },
  { id: 'imprimir', label: 'Imprimir', disabled: true },
  { id: 'duplicar', label: 'Duplicar' },
  { id: 'anular', label: 'Anular', variant: 'danger', separatorBefore: true },
];

@Component({
  template: `
    <ewms-table
      [source]="source"
      [trackBy]="byId"
      [isRowMaster]="isMaster"
      [menuItems]="perRow ?? menu()"
      ariaLabel="Expediciones"
      (rowMenu)="chosen = $event.item.id + ':' + $event.row.code"
    >
      <ewms-column key="code" header="Código" />
      <ewms-column key="packages" header="Bultos" type="number" />
      <ewms-column key="actions" header="Acciones" type="actions" />

      <!-- codigoOf y no row.codigo: ewmsDetail tipa la fila como unknown (hueco reportado, ver vault: Tabla). -->
      <ng-template ewmsDetail let-row>
        <p data-detail-body>Detalle de {{ codeOf(row) }}</p>
      </ng-template>
    </ewms-table>
  `,
  imports: [Table, TableColumn, DetailTemplate],
})
class DetailHost {
  readonly source = new ArrayTableSource<Row>(ROWS, ['code']);
  readonly byId = (row: Row): unknown => row.id;
  readonly isMaster = (row: Row): boolean => row.packages > 100;
  readonly menu = signal<readonly MenuItem[]>(MENU);
  perRow: ((row: Row) => readonly MenuItem[]) | null = null;

  readonly codeOf = (row: unknown): string => (row as Row).code;

  chosen = '';
}

describe('Table master/detail', () => {
  let fixture: ComponentFixture<DetailHost>;
  let host: DetailHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailHost, Table, TableColumn, DetailTemplate],
      providers: TABLE_PROVIDERS,
    }).compileComponents();
    fixture = TestBed.createComponent(DetailHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const settle = (): Promise<void> => stabilise(fixture);

  function toggle(rowIndex: number): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(`[data-detail-toggle="${rowIndex}"] button`);
  }

  function panels(): HTMLElement[] {
    return [...fixture.nativeElement.querySelectorAll('[data-detail]')] as HTMLElement[];
  }

  it('offers the panel only where there is one; it unfolds one cell spanning the table', async () => {
    expect(toggle(1)).not.toBeNull();
    // Sin control, ni siquiera deshabilitado: prometería algo que la fila no hace.
    expect(toggle(2)).toBeNull();
    toggle(0)?.click();
    await settle();

    expect(panels().length).toBe(1);
    const cell = panels()[0]?.querySelector('td') as HTMLTableCellElement;
    // Tres columnas y sin casilla: el panel no repite las columnas.
    expect(cell.getAttribute('colspan')).toBe('3');
    expect(cell.textContent).toContain('Detalle de EXP-0001');
  });

  it('says on the BUTTON that it is open and what it opened; panels open and fold alone', async () => {
    const button = toggle(0) as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBeNull();

    button.click();
    await settle();

    // En el botón, no en el envoltorio `ewms-button`: sin rol, nadie lo anuncia.
    const opened = toggle(0) as HTMLButtonElement;
    expect(opened.getAttribute('aria-expanded')).toBe('true');
    const cell = panels()[0]?.querySelector('td') as HTMLElement;
    expect(opened.getAttribute('aria-controls')).toBe(cell.id);

    // Abre tantos paneles como se pidan, cada uno con su fila, y pliega cada uno solo.
    toggle(1)?.click();
    await settle();
    expect(panels().length).toBe(2);

    toggle(0)?.click();
    await settle();
    expect(panels().length).toBe(1);
    expect(fixture.nativeElement.querySelector('[data-detail-body]')?.textContent).toContain(
      'EXP-0002',
    );
  });

  it('has no axe violations with a panel open, which is no row of the table', async () => {
    toggle(0)?.click();
    await settle();
    // Fila del DOM, no de la tabla: contarla leería cuatro expediciones donde hay tres.
    expect(fixture.nativeElement.querySelector('table').getAttribute('aria-rowcount')).toBe('3');
    await expectNoAxeViolations(fixture.nativeElement);
  });

  function kebab(rowIndex: number): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(`[data-kebab="${rowIndex}"] button`);
  }

  function menu(): HTMLElement | null {
    return document.querySelector('[role="menu"]');
  }

  function entries(): HTMLElement[] {
    return [...(menu()?.querySelectorAll('[role="menuitem"]') ?? [])] as HTMLElement[];
  }

  function rowOf(rowIndex: number): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-row="${rowIndex}"]`) as HTMLElement;
  }

  function press(key: string): void {
    menu()?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  it('opens on the kebab, with the entries it was given', async () => {
    kebab(0)?.click();
    await settle();
    expect(menu()).not.toBeNull();
    expect(entries().map((entry) => entry.textContent?.trim())).toEqual([
      'Ver detalle',
      'Imprimir',
      'Duplicar',
      'Anular',
    ]);
  });

  it('replaces the browser menu on a right click rather than adding a second', async () => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    rowOf(1).dispatchEvent(event);
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(menu()).not.toBeNull();
  });

  it('survives the auxclick of its own right click, and closes on a new gesture', async () => {
    // Orden X11 de Chromium (el de CI): `contextmenu` al pulsar, `auxclick` al soltar; el CDK
    // tomaba ese `auxclick` como clic afuera. Costó nueve pruebas rojas solo en CI.
    rowOf(1).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await settle();
    expect(menu()).not.toBeNull();

    rowOf(1).dispatchEvent(
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 }),
    );
    await settle();
    expect(menu(), 'the menu closed itself on the tail of its own click').not.toBeNull();

    // La guarda no puede volverse «nunca cierra»: un gesto nuevo afuera cierra el menú.
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(menu()).toBeNull();
  });

  it('offers nothing when there is nothing to offer', async () => {
    host.menu.set([]);
    await settle();
    expect(kebab(0)).toBeNull();

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    rowOf(0).dispatchEvent(event);
    await settle();
    // Sin acciones no se quita el menú del navegador (copiar y pegar).
    expect(event.defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
  });

  it('takes the focus, points at the active entry, and walks past what cannot be chosen', async () => {
    kebab(0)?.click();
    await settle();
    await Promise.resolve();
    expect(document.activeElement).toBe(menu());
    expect(menu()?.getAttribute('aria-activedescendant')).toBeNull();

    press('ArrowDown');
    await settle();
    expect(menu()?.getAttribute('aria-activedescendant')).toBe(entries()[0]?.id);

    // Salta lo que no se puede elegir, y un clic en eso no emite nada.
    entries()[1]?.click();
    await settle();
    expect(host.chosen).toBe('');
    expect(menu()).not.toBeNull();
    press('ArrowDown');
    await settle();
    // Imprimir está deshabilitado: desde Ver, la flecha cae en Duplicar.
    expect(menu()?.getAttribute('aria-activedescendant')).toBe(entries()[2]?.id);

    press('ArrowUp');
    await settle();
    expect(menu()?.getAttribute('aria-activedescendant')).toBe(entries()[0]?.id);
  });

  it('emits the row AND the entry, and closes', async () => {
    kebab(1)?.click();
    await settle();
    press('ArrowDown');
    await settle();
    press('Enter');
    await settle();

    expect(host.chosen).toBe('ver:EXP-0002');
    expect(menu()).toBeNull();

    // Y con un clic.
    kebab(0)?.click();
    await settle();
    entries()[2]?.click();
    await settle();
    expect(host.chosen).toBe('duplicar:EXP-0001');
  });

  it('A DESTRUCTIVE ENTRY ASKS FIRST, with the system dialog; cancelled, nothing is emitted', async () => {
    const answer = async (which: 0 | 1): Promise<void> => {
      await settle();
      const buttons = [...document.querySelectorAll('ewms-confirm-dialog button')] as HTMLElement[];
      expect(document.querySelector('ewms-confirm-dialog h2')?.textContent).toBe('¿Anular 1 fila?');
      buttons[which]!.click();
      await settle();
      await new Promise((resolve) => setTimeout(resolve));
    };

    kebab(0)?.click();
    await settle();
    entries()[3]?.click();
    await answer(0);
    expect(host.chosen).toBe('');

    kebab(0)?.click();
    await settle();
    entries()[3]?.click();
    await answer(1);
    expect(host.chosen).toBe('anular:EXP-0001');
  });

  it('gives the focus back to the ⋯ that opened it on Escape', async () => {
    kebab(0)?.click();
    await settle();
    press('Escape');
    await settle();
    await Promise.resolve();

    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(kebab(0));
  });

  it('ENTER AND SPACE ON THE ⋯ ARE THE BUTTON’S: the grid lets them through', () => {
    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      kebab(0)!.dispatchEvent(event);
      // Sin `preventDefault`, el navegador convierte la tecla en el clic que abre el menú.
      expect(event.defaultPrevented, key).toBe(false);
    }
  });

  it('decides its entries row by row when given a function', async () => {
    host.perRow = (row) => [{ id: 'anular', label: 'Anular', disabled: row.packages > 100 }];
    await settle();
    kebab(0)?.click();
    await settle();
    expect(entries()[0]?.getAttribute('aria-disabled')).toBe('true');
    press('Escape');
    await settle();
    kebab(2)?.click();
    await settle();
    expect(entries()[0]?.getAttribute('aria-disabled')).toBeNull();
  });

  it('opens from the keyboard with Shift+F10 and with the menu key', async () => {
    const cell = rowOf(0).querySelector('td') as HTMLElement;
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }));
    await settle();
    expect(menu()).not.toBeNull();

    press('Escape');
    await settle();

    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true }));
    await settle();
    expect(menu()).not.toBeNull();
  });

  it('leaves a bare F10 to the browser', async () => {
    const cell = rowOf(0).querySelector('td') as HTMLElement;
    const event = new KeyboardEvent('keydown', { key: 'F10', bubbles: true, cancelable: true });
    cell.dispatchEvent(event);
    await settle();
    expect(menu()).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  it('takes the menu with it when the table goes', async () => {
    kebab(0)?.click();
    await settle();
    expect(menu()).not.toBeNull();

    fixture.destroy();
    expect(menu()).toBeNull();
  });

  it('has no axe violations with the menu open', async () => {
    kebab(0)?.click();
    await settle();
    await expectNoAxeViolations(document.querySelector('.cdk-overlay-container') as Element);
  });
});

interface Big {
  readonly id: number;
  readonly code: string;
}

function bigRows(count: number): readonly Big[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: index,
    code: `EXP-${String(index).padStart(5, '0')}`,
  }));
}

const HUGE = bigRows(5000);

@Component({
  template: `
    <ewms-table
      [source]="source()"
      [trackBy]="byId"
      [virtual]="true"
      [pageSize]="5000"
      ariaLabel="Expediciones"
    >
      <ewms-column key="code" header="Código" />
    </ewms-table>
  `,
  imports: [Table, TableColumn],
})
class HugeHost {
  readonly source = signal<TableSource<Big>>(new ArrayTableSource(HUGE, ['code']));
  readonly byId = (row: Big): unknown => row.id;
}

const ROW_HEIGHT_TOKEN = '--row-height-md';

const ROW_PIXELS = 40;

async function hugeFixture(rows: readonly Big[]): Promise<ComponentFixture<HugeHost>> {
  await TestBed.configureTestingModule({
    imports: [HugeHost, Table, TableColumn],
    providers: TABLE_PROVIDERS,
  }).compileComponents();

  const fixture = TestBed.createComponent(HugeHost);
  // Antes del primer render: la ventana decide si hay una docena de filas en el DOM o todas.
  fixture.componentInstance.source.set(new ArrayTableSource(rows, ['code']));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('Table virtualisation', () => {
  let fixture: ComponentFixture<HugeHost>;

  beforeEach(async () => {
    // La altura sale de la hoja, que ninguna prueba unitaria carga; sin ella no hay ventana.
    document.documentElement.style.setProperty(ROW_HEIGHT_TOKEN, pixels(ROW_PIXELS));
    fixture = await hugeFixture(HUGE);
  });

  afterEach(() => {
    document.documentElement.style.removeProperty(ROW_HEIGHT_TOKEN);
  });

  const settle = (): Promise<void> => stabilise(fixture);

  function drawn(): HTMLElement[] {
    return [...fixture.nativeElement.querySelectorAll('[data-row]')] as HTMLElement[];
  }

  function spacerHeight(which: 'before' | 'after'): number {
    const cell = fixture.nativeElement.querySelector(
      `[data-spacer="${which}"] td`,
    ) as HTMLElement | null;
    return cell ? Number.parseInt(cell.style.height, 10) : 0;
  }

  function box(): HTMLElement {
    return fixture.nativeElement.querySelector('[data-scroll-box]') as HTMLElement;
  }

  // jsdom no tiene layout. `scrollTop` es un accesor real: la tabla lo escribe al llevar el
  // teclado fuera de la ventana, y uno de solo lectura explotaría.
  let scrollTop = 0;

  function scrollTo(top: number, height: number): void {
    scrollTop = top;
    Object.defineProperty(box(), 'clientHeight', { value: height, configurable: true });
    Object.defineProperty(box(), 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    box().dispatchEvent(new Event('scroll'));
  }

  it('says how many rows there are while drawing a handful', () => {
    // La cuenta es de la tabla, no de la ventana.
    const table = fixture.nativeElement.querySelector('table') as HTMLElement;
    expect(table.getAttribute('aria-rowcount')).toBe('5000');
    expect(drawn().length).toBeGreaterThan(0);
    expect(drawn().length).toBeLessThan(60);
    // La barra de desplazamiento mide la tabla entera.
    expect(spacerHeight('before') + drawn().length * ROW_PIXELS + spacerHeight('after')).toBe(
      5000 * ROW_PIXELS,
    );
  });

  it('moves the window when scrolled, keeping the absolute index, never past the last', async () => {
    scrollTo(4000, 400);
    await settle();

    // 4000 px es la fila 100, menos 6 de overscan.
    const first = drawn()[0] as HTMLElement;
    expect(first.dataset['row']).toBe('94');
    expect(first.getAttribute('aria-rowindex')).toBe('95');
    expect(first.textContent).toContain('EXP-00094');
    expect(spacerHeight('before')).toBe(94 * ROW_PIXELS);

    // Diez filas a la vista, más 6 de overscan a cada lado.
    expect(drawn().length).toBe(22);

    // Y nunca dibuja más allá de la última.
    scrollTo(5000 * ROW_PIXELS, 400);
    await settle();
    expect(spacerHeight('after')).toBe(0);
    expect(drawn()[drawn().length - 1]?.dataset['row']).toBe('4999');
  });

  it('scrolls a windowed row into view before the keyboard lands on it', async () => {
    scrollTo(0, 400);
    await settle();

    const cell = drawn()[0]?.querySelector('td') as HTMLElement;
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true }));
    await settle();

    // Ctrl+End va a la última fila, lejos de la ventana.
    expect(drawn().some((row) => row.dataset['row'] === '4999')).toBe(true);
  });
});

describe('Table with no row height declared', () => {
  it('draws every row rather than inventing a height', async () => {
    document.documentElement.style.removeProperty(ROW_HEIGHT_TOKEN);

    const fixture = await hugeFixture(bigRows(20));

    // `[virtual]` activo y aun así dibuja las veinte, sin espaciadores.
    expect(fixture.nativeElement.querySelectorAll('[data-row]').length).toBe(20);
    expect(fixture.nativeElement.querySelector('[data-spacer]')).toBeNull();
  });
});

// El atajo `filters` sale del mapa y del único listener del motor: la tabla no escucha teclas.
describe('Table and the `filters` shortcut', () => {
  const MAP: ShortcutMap = {
    search: { key: '/', chord: ['/'] },
    create: { key: 'n', alt: true, chord: ['Alt', 'N'] },
    save: { key: 's', ctrl: true, chord: ['Ctrl', 'S'] },
    cancel: { key: 'Escape', insideTextFields: true, chord: ['Esc'] },
    filters: { key: 'r', alt: true, chord: ['Alt', 'R'] },
    moveColumnLeft: { key: 'ArrowLeft', alt: true, shift: true, chord: ['Alt', 'Shift', '←'] },
    moveColumnRight: { key: 'ArrowRight', alt: true, shift: true, chord: ['Alt', 'Shift', '→'] },
    help: { key: '?', chord: ['?'] },
  };

  @Component({
    template: `
      <div ewmsShortcutsHost>
        <button id="outside" type="button">afuera</button>
        <ewms-table id="plain" [source]="source" ariaLabel="Sin filtros">
          <ewms-column key="code" header="Código" />
        </ewms-table>
        <ewms-table id="filtered" [source]="source" [quickFilter]="true" ariaLabel="Con filtros">
          <ewms-column key="code" header="Código" [filterable]="true" />
          <ewms-column key="packages" header="Bultos" type="number" />
        </ewms-table>
      </div>
    `,
    imports: [ShortcutsHost, Table, TableColumn],
    providers: [
      { provide: EWMS_SHORTCUT_MAP, useValue: MAP },
      { provide: EWMS_SHORTCUT_HELP_MESSAGES, useValue: {} as ShortcutHelpMessages },
    ],
  })
  class ShortcutHost {
    readonly source = new ArrayTableSource(ROWS, ['code']);
  }

  let fixture: ComponentFixture<ShortcutHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShortcutHost, DialogModule],
      providers: TABLE_PROVIDERS,
    }).compileComponents();
    fixture = TestBed.createComponent(ShortcutHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
  });

  const filterRow = (): HTMLElement =>
    fixture.nativeElement.querySelector('#filtered [data-filter-row]') as HTMLElement;

  async function pressFrom(target: HTMLElement): Promise<void> {
    target.focus();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', altKey: true, bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('toggles the filters of the table that has the focus', async () => {
    const cell = fixture.nativeElement.querySelector('#filtered [data-cell="0-0"]') as HTMLElement;
    await pressFrom(cell);
    expect(filterRow().hidden).toBe(false);
    await pressFrom(cell);
    expect(filterRow().hidden).toBe(true);
  });

  it('from outside every table it goes to the first one that filters; from a field, nowhere', async () => {
    // `#plain` va primero en el documento, pero no filtra: contesta `#filtered`.
    await pressFrom(fixture.nativeElement.querySelector('#outside') as HTMLElement);
    expect(filterRow().hidden).toBe(false);

    // Con el foco en una tabla que no filtra, nadie contesta.
    const plainCell = fixture.nativeElement.querySelector(
      '#plain [data-cell="0-0"]',
    ) as HTMLElement;
    await pressFrom(plainCell);
    expect(filterRow().hidden).toBe(false);

    // En un campo, Alt+R es del navegador (RFE-04).
    await pressFrom(fixture.nativeElement.querySelector('#filtered [data-quick-filter] input'));
    expect(filterRow().hidden).toBe(false);
  });

  it('Alt+Shift+→ moves the column whose header has the focus, and the focus follows it', async () => {
    const handle = fixture.nativeElement.querySelector('#filtered [data-resize="code"]');
    handle.focus();
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, shiftKey: true, bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const keys = [...fixture.nativeElement.querySelectorAll('#filtered th[data-col]')].map(
      (th) => (th as HTMLElement).dataset['col'],
    );
    expect(keys).toEqual(['packages', 'code']);
    expect(document.activeElement?.getAttribute('data-resize')).toBe('code');
    expect(fixture.nativeElement.querySelector('#filtered [data-table-announce]').textContent).toBe(
      'Código, posición 2 de 2',
    );
  });
});

// Columnas que el usuario configura: mostrar, fijar y redimensionar. Todo sale por (viewChange).
describe('Table columns', () => {
  /** Los dos tokens, con valores de prueba: el paso y el mínimo que la tabla lee al redimensionar. */
  const STEP = 16;
  const MIN = 72;
  const FIT = 400;
  /** El ancho `md`, que `maxWidth="md"` lee como tope de la columna. */
  const MD = 160;

  @Component({
    template: `
      <ewms-table
        [source]="source"
        [trackBy]="byId"
        [selectable]="true"
        [columnChooser]="true"
        ariaLabel="Columnas"
        (viewChange)="view = $event"
      >
        <ewms-column key="packages" header="Bultos" type="number" />
        <ewms-column key="code" header="Código" pinned="start" [hideable]="false" maxWidth="md" />
        <ewms-column key="date" header="Fecha" type="date" />
        <ewms-column key="actions" header="Acciones" type="actions" pinned="end" />
      </ewms-table>
    `,
    imports: [Table, TableColumn],
  })
  class ColumnsHost {
    readonly source = new ArrayTableSource(ROWS, ['code']);
    readonly byId = (row: Row): unknown => row.id;
    view: TableView | null = null;
  }

  let fixture: ComponentFixture<ColumnsHost>;

  /** jsdom no tiene ResizeObserver: uno que cuenta lo que observa prueba que la tabla lo usa. */
  const observed: Element[] = [];

  beforeEach(async () => {
    observed.length = 0;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(target: Element): void {
          observed.push(target);
        }
        disconnect(): void {
          observed.length = 0;
        }
      },
    );
    document.documentElement.style.setProperty('--col-resize-step', pixels(STEP));
    document.documentElement.style.setProperty('--col-filter-min-width', pixels(MIN));
    document.documentElement.style.setProperty('--col-fit-max-width', pixels(FIT));
    document.documentElement.style.setProperty('--col-width-md', pixels(MD));
    await TestBed.configureTestingModule({
      imports: [ColumnsHost],
      providers: TABLE_PROVIDERS,
    }).compileComponents();
    fixture = TestBed.createComponent(ColumnsHost);
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty('--col-resize-step');
    document.documentElement.style.removeProperty('--col-filter-min-width');
    document.documentElement.style.removeProperty('--col-fit-max-width');
    document.documentElement.style.removeProperty('--col-width-md');
    fixture.nativeElement.remove();
    clearOverlays();
  });

  const settle = (): Promise<void> => stabilise(fixture);

  const headers = (): string[] =>
    [...fixture.nativeElement.querySelectorAll('thead tr:first-child th[data-col]')].map(
      (th) => (th as HTMLElement).dataset['col'] ?? '',
    );
  const header = (key: string): HTMLElement =>
    fixture.nativeElement.querySelector(`th[data-col="${key}"]`) as HTMLElement;
  const separator = (key: string): HTMLElement =>
    fixture.nativeElement.querySelector(`[data-resize="${key}"]`) as HTMLElement;
  const option = (key: string): HTMLInputElement =>
    document.querySelector(`[data-column-option="${key}"] input`) as HTMLInputElement;

  async function openChooser(): Promise<void> {
    (fixture.nativeElement.querySelector('[data-view-menu] button') as HTMLElement).click();
    await settle();
  }

  it('PINNED GOES TO THE EDGES, sticky; the separator only with something under it', async () => {
    // Vuelve a medir cuando la tabla cambia de tamaño (y la barra, para compactarse).
    expect(observed).toContain(fixture.nativeElement.querySelector('table'));
    expect(observed).toContain(fixture.nativeElement.querySelector('ewms-table-toolbar'));
    expect(headers()).toEqual(['code', 'packages', 'date', 'actions']);
    expect(header('code').className).toContain('sticky');
    expect(header('code').className).not.toContain('border-e');
    const box = fixture.nativeElement.querySelector('[data-scroll-box]') as HTMLElement;
    box.scrollLeft = 40;
    box.dispatchEvent(new Event('scroll'));
    await settle();
    expect(header('code').className).toContain('after:shadow-pin-start');
    // Con fijadas en los dos bordes, su sombra ya avisa: no hay degradado encima.
    expect(fixture.nativeElement.querySelector('[data-edge]')).toBeNull();
    expect(header('actions').className).toContain('sticky');
    expect(header('actions').style.right).toBe(pixels(0));
    // La casilla se queda con ellas, a la izquierda.
    expect(fixture.nativeElement.querySelector('th[data-col-select]').className).toContain(
      'sticky',
    );
    const firstRow = fixture.nativeElement.querySelector('tbody tr') as HTMLElement;
    expect(firstRow.querySelector('[data-cell="0-1"]')?.className).toContain('bg-inherit');
  });

  it('hides and shows from the chooser, and never lets go of one that says no', async () => {
    await openChooser();
    expect(option('code').disabled).toBe(true);

    option('packages').click();
    await settle();
    expect(headers()).toEqual(['code', 'date', 'actions']);
    expect(fixture.nativeElement.querySelector('table').getAttribute('aria-colcount')).toBe('4');
    expect(fixture.componentInstance.view?.hidden).toEqual(['packages']);

    option('packages').click();
    await settle();
    expect(headers()).toEqual(['code', 'packages', 'date', 'actions']);
  });

  it('NEVER HIDES THE LAST VISIBLE ONE: its box goes disabled', async () => {
    @Component({
      template: `
        <ewms-table [source]="source" [columnChooser]="true" ariaLabel="Dos">
          <ewms-column key="code" header="Código" />
          <ewms-column key="packages" header="Bultos" type="number" />
        </ewms-table>
      `,
      imports: [Table, TableColumn],
    })
    class TwoHost {
      readonly source = new ArrayTableSource(ROWS, ['code']);
    }
    const two = TestBed.createComponent(TwoHost);
    document.body.appendChild(two.nativeElement);
    two.detectChanges();
    await two.whenStable();
    (two.nativeElement.querySelector('[data-view-menu] button') as HTMLElement).click();
    two.detectChanges();
    await two.whenStable();

    option('code').click();
    two.detectChanges();
    await two.whenStable();
    expect(option('packages').disabled).toBe(true);
    option('packages').click();
    two.detectChanges();
    expect(two.nativeElement.querySelectorAll('th[data-col]').length).toBe(1);
    two.nativeElement.remove();
  });

  it('THE COLUMN MENU: ⋮ or Shift+F10, what is done disabled; it pins and hides', async () => {
    const entry = (id: string): HTMLElement =>
      document.querySelector(`[data-menu-item="${id}"]`) as HTMLElement;
    const open = header('packages').querySelector('[data-column-menu] button') as HTMLElement;
    open.click();
    await settle();
    expect(document.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe(
      'Opciones de la columna Bultos',
    );
    // No ordena: sin entradas de orden. Suelta ya, y no se mueve a la izquierda de la fijada.
    expect(entry('sortAsc')).toBeNull();
    expect(entry('unpin').getAttribute('aria-disabled')).toBe('true');
    expect(entry('moveLeft').getAttribute('aria-disabled')).toBe('true');
    entry('pinStart').click();
    await settle();
    expect(headers()).toEqual(['packages', 'code', 'date', 'actions']);
    expect(fixture.componentInstance.view?.pinned).toEqual({
      packages: 'start',
      code: 'start',
      actions: 'end',
    });
    expect(document.activeElement).toBe(open);

    separator('date').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }),
    );
    await settle();
    entry('hide').click();
    await settle();
    expect(fixture.componentInstance.view?.hidden).toEqual(['date']);

    // «Restablecer vista» vuelve a lo declarado: orden, visibles y fijadas.
    await openChooser();
    (document.querySelector('[data-reset-view] button') as HTMLButtonElement).click();
    await settle();
    expect(headers()).toEqual(['code', 'packages', 'date', 'actions']);
    expect(fixture.componentInstance.view?.pinned).toEqual({ code: 'start', actions: 'end' });
  });

  it('REORDERS INSIDE ITS PIN GROUP, from the chooser and by dragging, and says where', async () => {
    const dataTransfer = { setData: () => undefined, effectAllowed: 'none' };
    const drag = (type: string, key: string, clientX = 0): void => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX });
      header(key).dispatchEvent(Object.assign(event, { dataTransfer }));
    };
    await openChooser();
    const row = (key: string, button: string): HTMLButtonElement =>
      document.querySelector(`[data-column-row="${key}"] ${button} button`) as HTMLButtonElement;
    // Bultos es la primera normal: no sube por encima de la fijada.
    expect(row('packages', '[data-column-up]').disabled).toBe(true);
    row('packages', '[data-column-down]').click();
    await settle();
    expect(headers()).toEqual(['code', 'date', 'packages', 'actions']);
    expect(fixture.componentInstance.view?.order).toEqual(['code', 'date', 'packages', 'actions']);
    expect(fixture.nativeElement.querySelector('[data-table-announce]').textContent).toBe(
      'Bultos, posición 3 de 4',
    );
    // jsdom mide cero: a la izquierda del centro es «antes»; la línea marca el lado.
    drag('dragstart', 'packages');
    drag('dragover', 'date', -1);
    drag('dragover', 'date', -1);
    await settle();
    expect(header('date').className).toContain('before:start-0');
    drag('drop', 'date', -1);
    await settle();
    expect(headers()).toEqual(['code', 'packages', 'date', 'actions']);

    // Desde el separador se redimensiona; una normal no cae entre las fijadas.
    separator('packages').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    drag('dragstart', 'packages');
    drag('drop', 'date', -1);
    header('packages').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    drag('dragstart', 'packages');
    drag('dragover', 'code', -1);
    drag('drop', 'code', -1);
    await settle();
    expect(header('code').className).not.toContain('before:');
    expect(headers()).toEqual(['code', 'packages', 'date', 'actions']);
  });

  it('is a window splitter: named, vertical, with its width; arrows step by token; it drags', async () => {
    const handle = separator('date');
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-label')).toBe('Ancho de la columna Fecha');
    expect(handle.getAttribute('tabindex')).toBe('0');
    // Una columna de acciones no se redimensiona.
    expect(separator('actions')).toBeNull();

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle();
    // jsdom mide cero: el mínimo manda.
    expect(fixture.componentInstance.view?.widths).toEqual({ date: MIN });
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle();
    expect(header('date').style.width).toBe(pixels(MIN + STEP));
    expect(handle.getAttribute('aria-valuenow')).toBe(String(MIN + STEP));

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await settle();
    expect(header('date').style.width).toBe(pixels(MIN));

    // Doble clic: ajusta a lo que pide la celda más ancha, con el tope del token.
    const widest = fixture.nativeElement.querySelector('td[data-col="date"] .truncate');
    Object.defineProperty(widest, 'scrollWidth', { configurable: true, value: 900 });
    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await settle();
    expect(fixture.componentInstance.view?.widths).toEqual({ date: FIT });

    // Con el puntero, y nunca bajo el mínimo.
    const grip = separator('packages');
    grip.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, bubbles: true }));
    grip.dispatchEvent(new MouseEvent('pointermove', { clientX: 260, bubbles: true }));
    grip.dispatchEvent(new MouseEvent('pointerup', { clientX: 260, bubbles: true }));
    await settle();
    expect(header('packages').style.width).toBe(pixels(160));

    grip.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, bubbles: true }));
    grip.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, bubbles: true }));
    await settle();
    expect(header('packages').style.width).toBe(pixels(MIN));
  });

  it('EACH COLUMN HAS ITS OWN LIMITS: Home and End go to them, and nothing passes them', async () => {
    // Sin tope propio, los de la tabla: el mínimo de los filtros y el de «Ajustar al contenido».
    expect(separator('date').getAttribute('aria-valuemin')).toBe(String(MIN));
    expect(separator('date').getAttribute('aria-valuemax')).toBe(String(FIT));
    // Con `maxWidth="md"`, el ancho de ese nombre.
    const handle = separator('code');
    expect(handle.getAttribute('aria-valuemax')).toBe(String(MD));

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await settle();
    expect(header('code').style.width).toBe(pixels(MD));
    expect(handle.getAttribute('aria-valuenow')).toBe(String(MD));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle();
    expect(header('code').style.width).toBe(pixels(MD));

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await settle();
    expect(fixture.componentInstance.view?.widths).toEqual({ code: MIN });

    // El arrastre tampoco lo pasa, y el ancho sale en la vista: es lo que se recuerda.
    handle.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, bubbles: true }));
    handle.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, bubbles: true }));
    handle.dispatchEvent(new MouseEvent('pointerup', { clientX: 900, bubbles: true }));
    await settle();
    expect(fixture.componentInstance.view?.widths).toEqual({ code: MD });
    // Sigue fijada, con su separador intacto.
    expect(header('code').className).toContain('sticky');
  });

  it('LETS GO OF THE PINS when they would take more than half the box', async () => {
    const box = fixture.nativeElement.querySelector('[data-scroll-box]') as HTMLElement;
    Object.defineProperty(box, 'clientWidth', { configurable: true, value: 274 });
    header('code').getBoundingClientRect = () => ({ width: 160 }) as DOMRect;
    // Cualquier cambio de la vista vuelve a medir.
    separator('date').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    await settle();

    expect(header('code').className).not.toContain('sticky');
    expect(fixture.nativeElement.querySelector('th[data-col-select]').className).not.toContain(
      'sticky',
    );
    // El orden no cambia: lo fijado sigue en su borde, solo deja de pegarse.
    expect(headers()[0]).toBe('code');
  });

  it('has no axe violations with the chooser open', async () => {
    await openChooser();
    await expectNoAxeViolations(fixture.nativeElement);
    await expectNoAxeViolations(document.querySelector('.cdk-overlay-container')!);
  });
});

// Exportar: CSV en el cliente con una fuente en memoria; con una remota, solo la petición.
describe('Table saved views', () => {
  @Component({
    template: `
      <ewms-table
        [source]="source"
        [trackBy]="byId"
        [columnChooser]="true"
        viewsKey="expediciones"
        ariaLabel="Expediciones"
      >
        <ewms-column key="code" header="Código" [sortable]="true" [filterable]="true" />
        <ewms-column key="packages" header="Bultos" type="number" [filterable]="true" />
      </ewms-table>
    `,
    imports: [Table, TableColumn],
  })
  class ViewsHost {
    readonly source = new ArrayTableSource<Row>(ROWS, ['code']);
    readonly byId = (row: Row): unknown => row.id;
  }

  let fixture: ComponentFixture<ViewsHost>;
  let store: InMemoryTableViewStore;

  async function start(withStore = true): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ViewsHost],
      providers: withStore
        ? [...TABLE_PROVIDERS, { provide: EWMS_TABLE_VIEW_STORE, useValue: store }]
        : TABLE_PROVIDERS,
    }).compileComponents();
    fixture = TestBed.createComponent(ViewsHost);
    document.body.appendChild(fixture.nativeElement);
    await settle();
    await settle();
  }

  beforeEach(() => {
    store = new InMemoryTableViewStore();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    clearOverlays();
  });

  /** Las escrituras y lecturas del store son promesas: una vuelta más de tareas. */
  const settle = async (): Promise<void> => {
    await stabilise(fixture);
    await new Promise((resolve) => setTimeout(resolve));
    await stabilise(fixture);
  };
  const viewButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('[data-view-menu] button') as HTMLButtonElement;
  const inPanel = <E extends Element>(selector: string): E =>
    document.querySelector(`.cdk-overlay-container ${selector}`) as E;

  async function click(selector: string): Promise<void> {
    inPanel<HTMLElement>(`${selector} button`).click();
    await settle();
  }

  async function openView(): Promise<void> {
    if (!inPanel('[data-saved-views]')) {
      viewButton().click();
      await settle();
    }
  }

  async function name(value: string): Promise<void> {
    const input = inPanel<HTMLInputElement>('[data-view-name] input');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  it('SAVES THE VIEW WITH A NAME, says when it changed, and brings it back', async () => {
    await start();
    await openView();
    expect(inPanel('[data-view-option=""]')).not.toBeNull();
    await name('Compacta');
    await click('[data-view-create]');
    expect(viewButton().textContent?.trim()).toBe('Compacta');

    // La densidad cambia: la vista puesta queda «modificada» y «Guardar cambios» se habilita.
    inPanel<HTMLInputElement>('[data-density="sm"] input').click();
    await settle();
    expect(viewButton().textContent?.trim()).toBe('Compacta (modificada)');
    expect(inPanel<HTMLButtonElement>('[data-view-save] button').disabled).toBe(false);

    // «Restablecer vista» vuelve a la vista puesta, no a lo declarado.
    await click('[data-reset-view]');
    expect(viewButton().textContent?.trim()).toBe('Compacta');

    inPanel<HTMLInputElement>('[data-density="sm"] input').click();
    await settle();
    await click('[data-view-save]');
    expect((await store.read('expediciones'))?.views[0]?.state.view.density).toBe('sm');
    await expectNoAxeViolations(document.querySelector('.cdk-overlay-container')!);
  });

  it('opens with the default view: its filters, its order and its density', async () => {
    await store.write('expediciones', {
      version: TABLE_VIEWS_VERSION,
      views: [
        {
          id: 'x',
          name: 'Grandes',
          state: {
            view: {
              order: ['packages', 'code'],
              hidden: [],
              widths: {},
              pinned: {},
              density: 'sm',
            },
            filters: { packages: { min: 100 } },
            sort: [{ key: 'code', direction: 'desc' }],
          },
        },
      ],
      defaultId: 'x',
    });
    await start();
    expect(viewButton().textContent?.trim()).toBe('Grandes');
    const heads = [...fixture.nativeElement.querySelectorAll('thead tr:first-child th[data-col]')];
    expect(heads.map((th) => (th as HTMLElement).dataset['col'])).toEqual(['packages', 'code']);
    expect(fixture.nativeElement.querySelector('[data-chip="packages"]')?.textContent).toContain(
      '≥ n:100',
    );
    // La caja del filtro dice lo mismo que el chip.
    const min = fixture.nativeElement.querySelector(
      '[data-filter="packages"] input',
    ) as HTMLInputElement;
    expect(min.value).toBe('100');
  });

  it('renames, duplicates, sets the default, and deletes only after asking', async () => {
    await start();
    await openView();
    await name('Mía');
    await click('[data-view-create]');
    await name('Mía de verdad');
    await click('[data-view-rename]');
    expect(viewButton().textContent?.trim()).toBe('Mía de verdad');
    await openView();
    await click('[data-view-duplicate]');
    expect(viewButton().textContent?.trim()).toBe('Mía de verdad (copia)');
    await openView();
    await click('[data-view-default]');
    const withDefault = await store.read('expediciones');
    expect(withDefault?.defaultId).toBe(withDefault?.views[1]?.id);

    // Eliminar pregunta con el diálogo del sistema; cancelado, la vista sigue.
    await openView();
    await click('[data-view-delete]');
    (document.querySelectorAll('ewms-confirm-dialog button')[0] as HTMLElement).click();
    await settle();
    expect((await store.read('expediciones'))?.views.length).toBe(2);

    await openView();
    await click('[data-view-delete]');
    (document.querySelectorAll('ewms-confirm-dialog button')[1] as HTMLElement).click();
    await settle();
    const left = await store.read('expediciones');
    expect(left?.views.map((view) => view.name)).toEqual(['Mía de verdad']);
    expect(left?.defaultId).toBeNull();
    expect(viewButton().textContent?.trim()).toBe('Vista');
    expect(document.activeElement).toBe(viewButton());
  });

  it('without a store there are no saved views, and the panel is as it was', async () => {
    await start(false);
    viewButton().click();
    await settle();
    expect(inPanel('[data-saved-views]')).toBeNull();
  });
});

describe('Table export', () => {
  @Component({
    template: `
      <ewms-table
        [source]="source()"
        [trackBy]="byId"
        [selectable]="true"
        [exportable]="true"
        [pageSize]="2"
        ariaLabel="Expediciones"
        (exportRequest)="request = $event"
      >
        <ewms-column key="code" header="Código" [sortable]="true" />
        <ewms-column key="packages" header="Bultos" type="number" [sortable]="true" />
        <ewms-column key="date" header="Fecha" type="date" />
        <ewms-column key="status" header="Estado" type="badge" [badges]="statuses" />
        <ewms-column key="actions" header="Acciones" type="actions" />
      </ewms-table>
    `,
    imports: [Table, TableColumn],
  })
  class ExportHost {
    readonly statuses = STATUSES;
    readonly source = signal<TableSource<Row>>(
      new ArrayTableSource([...ROWS, { ...ROWS[1]!, id: '4', code: 'EXP-0004', packages: 1234 }]),
    );
    readonly byId = (row: Row): unknown => row.id;
    request: ExportRequest | null = null;
  }

  let fixture: ComponentFixture<ExportHost>;
  let downloads: { name: string; text: Promise<string> }[];

  beforeEach(async () => {
    downloads = [];
    let blob: Blob | null = null;
    // jsdom no implementa las dos: se definen, y se borran al terminar.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (made: Blob) => ((blob = made), 'blob:tabla'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      // `text()` descarta el BOM al decodificar: se leen los bytes y se decodifica sin tocarlo.
      const bytes = blob!.arrayBuffer();
      downloads.push({
        name: this.download,
        text: bytes.then((buffer) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer)),
      });
    });
    await TestBed.configureTestingModule({
      imports: [ExportHost],
      providers: [
        ...TABLE_PROVIDERS,
        { provide: EWMS_SPLIT_BUTTON_MESSAGES, useValue: { moreActions: 'Más acciones' } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ExportHost);
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(async () => {
    // `downloadCsv` revoca en la tarea siguiente: se le da esa vuelta antes de borrar los dobles.
    await new Promise((resolve) => setTimeout(resolve));
    delete (URL as { createObjectURL?: unknown }).createObjectURL;
    delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
    vi.restoreAllMocks();
    fixture.nativeElement.remove();
    clearOverlays();
  });

  const settle = (): Promise<void> => stabilise(fixture);

  const primary = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('[data-export] button') as HTMLButtonElement;

  async function alternative(id: string): Promise<void> {
    (
      fixture.nativeElement.querySelector(
        '[data-export] [data-split-trigger] button',
      ) as HTMLElement
    ).click();
    await settle();
    (document.querySelector(`[data-split-action="${id}"]`) as HTMLElement).click();
    await settle();
  }

  it('CSV IS EVERYTHING FILTERED AND SORTED, not the page: BOM, raw numbers, ISO dates', async () => {
    (fixture.nativeElement.querySelector('[data-sort="packages"]') as HTMLElement).click();
    await settle();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);

    primary().click();
    await settle();
    expect(downloads[0]?.name).toBe('Expediciones.csv');
    expect(await downloads[0]!.text).toBe(
      '\uFEFFCódigo,Bultos,Fecha,Estado\r\n' +
        'EXP-0003,40,2026-03-21,Pendiente\r\n' +
        'EXP-0002,900,2026-02-03,Con incidencia\r\n' +
        'EXP-0001,1200,2026-01-15,Pendiente\r\n' +
        'EXP-0004,1234,2026-02-03,Con incidencia',
    );
  });

  it('the alternatives: CSV of the selection, disabled without one, and a copy', async () => {
    (
      fixture.nativeElement.querySelector(
        '[data-export] [data-split-trigger] button',
      ) as HTMLElement
    ).click();
    await settle();
    expect(
      document.querySelector('[data-split-action="csv-selected"]')?.getAttribute('aria-disabled'),
    ).toBe('true');
    // Se cierra con su disparador: borrar el contenedor dejaría al menú sin dónde abrir.
    (
      fixture.nativeElement.querySelector(
        '[data-export] [data-split-trigger] button',
      ) as HTMLElement
    ).click();
    await settle();

    const box = fixture.nativeElement.querySelector(
      'tbody input[type="checkbox"]',
    ) as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await settle();
    await alternative('csv-selected');
    expect(await downloads[0]!.text).toBe(
      '\uFEFFCódigo,Bultos,Fecha,Estado\r\nEXP-0001,1200,2026-01-15,Pendiente',
    );

    const copied: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => (copied.push(text), Promise.resolve()) },
    });
    await alternative('copy');
    expect(copied[0]).toBe('Código\tBultos\tFecha\tEstado\nEXP-0001\t1200\t2026-01-15\tPendiente');
    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('A REMOTE SOURCE DOWNLOADS NOTHING: it gets the query and the visible columns', async () => {
    fixture.componentInstance.source.set({
      load: () => of({ rows: ROWS.slice(0, 2), page: 0, pageSize: 2, total: 40 }),
    });
    await settle();
    primary().click();
    await settle();

    expect(downloads).toEqual([]);
    expect(fixture.componentInstance.request).toEqual({
      query: expect.objectContaining({ page: 0, pageSize: 2 }),
      columns: ['code', 'packages', 'date', 'status', 'actions'],
      selectedOnly: false,
    });
  });
});
