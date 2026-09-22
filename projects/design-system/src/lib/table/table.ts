import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
  type Signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { of, type Observable } from 'rxjs';
import { catchError, debounceTime, map, skip, switchMap, tap } from 'rxjs/operators';
import { Badge } from '../badge/badge';
import { Checkbox } from '../checkbox/checkbox';
import { familyTintClass } from '../feedback/feedback.types';
import { Icon } from '../icon/icon';
import { Button } from '../button/button';
import { DatePicker } from '../date-picker/date-picker';
import {
  EmptyState,
  type EmptyStateAction,
  type EmptyStateKind,
} from '../empty-state/empty-state';
import { KeyboardShortcuts } from '../keyboard/keyboard-shortcuts';
import { Input as TextInput } from '../input/input';
import { Pagination } from '../pagination/pagination';

import { readMilliseconds } from '../tokens/read-token';
const DELAY_SEARCH_INPUT_TOKEN = '--delay-search-input';
import { CellTemplate, TableColumn } from './column';
import { TABLE_CONTEXT, type TableContext } from './table-context';
import { TableFilters } from './table-filters';
import { TablePopover } from './table-popover';
import { TableStatus } from './table-status';
import { TableToolbar } from './table-toolbar';
import { downloadCsv, exportMatrix, toCsv, toTsv } from './table-export';
import { TableSelection } from './table-selection';
import { TableColumnDrag } from './table-column-drag';
import { TableViewState, type ColumnPosition } from './table-view';
import {
  emptyQuery,
  readCell,
  type TablePage,
  type TableQuery,
  type TableSource,
} from './table-source';
import {
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  type TableFormatters,
  type TableMessages,
} from './table.tokens';
import {
  CELL_CLASSES,
  HEADER_CELL_CLASSES,
  ROW_HEIGHT,
  TABLE_CLASSES,
  columnCellClasses,
  columnHeaderClasses,
  rowClasses,
  type BadgeDescriptor,
  type BulkActionEvent,
  type ExportRequest,
  type MenuItem,
  type RowActivateEvent,
  type RowMenuEvent,
  type RowState,
  type TableChildren,
  type TableDensity,
  type TableView,
} from './table.types';
import { TableRowMenu } from './table-row-menu';
import { TableWindow } from './table-window';
import { TableTreeState } from './table-tree-state';
import type { FlatRow } from './tree';

export type { CellContext } from './column';
export { TableColumn, CellTemplate } from './column';
export type { FlatRow } from './tree';

@Directive({ selector: '[ewmsDetail]' })
export class DetailTemplate<T = unknown> {
  readonly template = inject<TemplateRef<{ $implicit: T }>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _directive: DetailTemplate<T>,
    _context: unknown,
  ): _context is { $implicit: T } {
    return true;
  }
}

@Directive({ selector: '[ewmsEmpty]' })
export class EmptyTemplate {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

let nextTableId = 0;

const EMPTY_PAGE: TablePage<never> = { rows: [], page: 0, pageSize: 0, total: 0 };

/** Tinte solo en excepción: con todas teñidas, ninguna llama la atención (decisión del usuario). */
const TINTED_STATES: readonly RowState[] = ['danger', 'warning'];

/** La tabla de datos: árbol aplanado, estado de fila como dato. Ver vault: Tabla. */
@Component({
  selector: 'ewms-table',
  templateUrl: './table.html',
  imports: [
    Badge,
    Checkbox,
    DatePicker,
    EmptyState,
    Icon,
    Button,
    NgTemplateOutlet,
    Pagination,
    ReactiveFormsModule,
    TablePopover,
    TableStatus,
    TableToolbar,
    TextInput,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  viewProviders: [{ provide: TABLE_CONTEXT, useExisting: forwardRef(() => Table) }],
})
export class Table<T> implements TableContext {
  readonly source = input.required<TableSource<T>>();

  /** Obligatorio: una tabla sin nombre no se encuentra. */
  readonly ariaLabel = input.required<string>();

  /** Función o nombre de propiedad. Con `children` el rol es `treegrid`; sin él, `grid`. */
  readonly children = input<TableChildren<T> | string | null>(null);

  /** Función o nombre de una columna con `badges`: un diccionario da tinte e insignia. */
  readonly rowState = input<((row: T) => RowState | null) | string | null>(null);

  readonly isRowMaster = input<((row: T) => boolean) | null>(null);

  readonly menuItems = input<readonly MenuItem[]>([]);

  /** Acciones sobre lo seleccionado: la barra las muestra con «3 seleccionadas». */
  readonly bulkActions = input<readonly MenuItem[]>([]);

  /** Pinta solo las filas visibles; conviene desde unas 500. Ver vault: Tabla §10. */
  readonly virtual = input<boolean>(false);

  readonly selectable = input<boolean>(false);

  readonly quickFilter = input<boolean>(false);

  /** Selector de columnas en la barra: mostrar y ocultar. `hideable="false"` no se ofrece. */
  readonly columnChooser = input<boolean>(false);

  /** «Exportar» en la barra: CSV en el cliente con `ArrayTableSource`; si no, `(exportRequest)`. */
  readonly exportable = input<boolean>(false);

  readonly density = input<TableDensity>('md');

  readonly pageSize = input<number>(50);

  /** Identifica la fila y la selección (conjunto de claves: sobrevive al cambio de página). */
  readonly trackBy = input<(row: T) => unknown>((row) => row);

  readonly messages = input<Partial<TableMessages> | null>(null);
  readonly formatters = input<Partial<TableFormatters> | null>(null);

  readonly rowActivate = output<RowActivateEvent<T>>();
  readonly rowMenu = output<RowMenuEvent<T>>();
  readonly selectionChange = output<readonly T[]>();
  readonly bulkAction = output<BulkActionEvent<T>>();
  /** Con una fuente remota la tabla no descarga: dice qué pidió el usuario, y lo hace el servicio. */
  readonly exportRequest = output<ExportRequest>();
  readonly queryChange = output<TableQuery>();
  /** Columnas ocultas, anchos, fijadas y densidad: en memoria, para quien quiera guardarlos. */
  readonly viewChange = output<TableView>();

  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly menuTemplate = viewChild<TemplateRef<unknown>>('rowMenuPanel');

  protected readonly detail = contentChild(DetailTemplate);
  protected readonly empty = contentChild(EmptyTemplate);
  protected readonly columns = contentChildren(TableColumn);

  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly providedMessages = inject(EWMS_TABLE_MESSAGES);
  private readonly providedFormatters = inject(EWMS_TABLE_FORMATTERS);

  private readonly id = ++nextTableId;
  readonly tableId = `ewms-table-${this.id}`;
  readonly filterRowId = `${this.tableId}-filters`;

  protected readonly tableClasses = TABLE_CLASSES;
  protected readonly headerCellClasses = HEADER_CELL_CLASSES;
  protected readonly cellClasses = CELL_CLASSES;

  readonly text = computed(() => ({
    ...this.providedMessages,
    ...(this.messages() ?? {}),
  }));

  readonly format = computed(() => ({
    ...this.providedFormatters,
    ...(this.formatters() ?? {}),
  }));

  private readonly search = signal('');
  private readonly sort = signal<TableQuery['sort']>(null);
  private readonly pageIndex = signal(0);

  protected readonly query = computed<TableQuery>(() => ({
    ...emptyQuery(this.pageSize()),
    search: this.search(),
    filters: this.filtering.values(),
    sort: this.sort(),
    page: this.pageIndex(),
  }));

  // Con la fuente: sin ella, cambiar de fuente dejaba las filas viejas en pantalla.
  /** «Reintentar» vuelve a pedir la misma consulta: este contador es lo único que cambia. */
  private readonly reload = signal(0);

  private readonly request = computed(() => ({
    source: this.source(),
    query: this.query(),
    attempt: this.reload(),
  }));

  /** Cargando no vacía la tabla: las filas quedan, atenuadas, y el alto no se mueve. */
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');

  protected readonly retryAction = computed<EmptyStateAction>(() => ({
    label: this.text().retry,
    icon: 'refresh',
    run: () => this.reload.update((attempt) => attempt + 1),
  }));

  /** Con búsqueda o filtros, vacío es «sin resultados» y se ofrece limpiarlos. */
  protected readonly emptyKind = computed<EmptyStateKind>(() =>
    this.search() !== '' || this.filtering.count() > 0 ? 'no-results' : 'no-data',
  );

  protected readonly clearAction = computed<EmptyStateAction>(() => ({
    label: this.text().clearFilters,
    run: () => this.clearQuery(),
  }));

  /** Búsqueda y filtros de columna a la vez: lo que dejó la tabla vacía. */
  clearQuery(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.search.set('');
    this.pageIndex.set(0);
    this.filtering.clearAll();
  }

  protected readonly page = signal<TablePage<T>>({
    rows: [],
    page: 0,
    pageSize: 0,
    total: null,
  });

  readonly pageRows = computed(() => this.page().rows);
  readonly pageTotal = computed(() => this.page().total);

  /** Al pie: con una columna que agrega, o cuando ya hay barra (filtrar sin decir cuántas quedan…). */
  protected readonly showStatus = computed(
    () => this.showToolbar() || this.columns().some((column) => column.aggregate() !== null),
  );

  protected readonly pageCount = computed(() => {
    const total = this.page().total;
    return total === null ? null : Math.max(1, Math.ceil(total / this.pageSize()));
  });

  private readonly resolveRowState = computed<((row: T) => RowState | null) | null>(() => {
    const declared = this.rowState();
    if (declared === null) {
      return null;
    }
    if (typeof declared !== 'string') {
      return declared;
    }
    const dictionary =
      this.columns()
        .find((column) => column.key() === declared)
        ?.badges() ?? {};
    return (row) => dictionary[String(readCell(row, declared))]?.variant ?? null;
  });

  /** Abiertas, hijos perezosos y la lista aplanada: ver `table-tree-state.ts`. */
  readonly tree = new TableTreeState<T>(this.children, this.trackBy, computed(() => this.page().rows));
  protected readonly isTree = this.tree.isTree;
  protected readonly rows = this.tree.rows;

  protected readonly selection = new TableSelection<T>();
  readonly selectedCount = this.selection.count;
  readonly selectedRows = this.selection.rows;

  /** Lo que dice la región viva: la selección y lo copiado, que no mueven el foco. */
  protected readonly announcement = signal('');

  protected readonly allSelected = computed(() => {
    const rows = this.rows();
    return rows.length > 0 && rows.every((flat) => this.selection.has(flat.key));
  });

  protected readonly someSelected = computed(
    () => !this.allSelected() && this.rows().some((flat) => this.selection.has(flat.key)),
  );

  /** Un clic con Shift en la casilla: se lee en `click`, que llega antes que `change`. */
  private rangeGesture = false;

  protected onSelectClick(event: MouseEvent): void {
    this.rangeGesture = event.shiftKey;
  }

  protected readonly columnCount = computed(
    () => this.visibleColumns().length + (this.selectable() ? 1 : 0),
  );

  // Un solo tab stop para toda la tabla.
  protected readonly focusRow = signal(0);
  protected readonly focusColumn = signal(0);

  constructor() {
    // switchMap cancela la petición en vuelo: una página 0 lenta no pisa a una página 1 rápida.
    toObservable(this.request)
      .pipe(
        tap(({ query }) => {
          this.queryChange.emit(query);
          this.loadState.set('loading');
        }),
        switchMap(({ source, query }) =>
          // Atrapado por consulta: un error fuera del switchMap mata la suscripción para siempre.
          source.load(query).pipe(
            map((page) => ({ page, failed: false })),
            catchError(() => of({ page: EMPTY_PAGE as TablePage<T>, failed: true })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ page, failed }) => {
        this.page.set(page);
        this.loadState.set(failed ? 'error' : 'ready');
      });

    this.typed(this.searchControl.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe((text) => {
        this.pageIndex.set(0);
        this.search.set(text);
      });

    toObservable(this.layout.view)
      .pipe(skip(1), takeUntilDestroyed())
      .subscribe((view) => this.viewChange.emit(view));

    // Las fijadas se desplazan lo que miden sus vecinas: se mide tras cada pintado que las mueva.
    afterRenderEffect({
      read: () => {
        this.visibleColumns();
        this.layout.view();
        this.selectable();
        this.measurePins();
      },
    });

    // Medir en fase de lectura: sin esto la primera ventana se calcula con altura cero.
    afterNextRender({
      read: () => {
        const box = this.scrollBox()?.nativeElement;
        if (box) {
          this.viewport.measure(box);
        }
        // Las fuentes y el ancho de la página cambian lo que mide una columna.
        if (typeof ResizeObserver !== 'undefined' && box) {
          const observer = new ResizeObserver(() => this.measurePins());
          observer.observe(box.querySelector('table') ?? box);
          this.destroyRef.onDestroy(() => observer.disconnect());
        }
      },
    });

    // Atajos del mapa, sin listener propio: `filters` lo contesta la tabla con el foco (o la primera
    // filtrable); mover columna, la de la cabecera enfocada. Ver vault: Tabla §12 y §20.
    inject(KeyboardShortcuts)
      .events.pipe(takeUntilDestroyed())
      .subscribe(({ action, outcome }) => {
        if (outcome !== 'unregistered') {
          return;
        }
        if (action === 'filters' && this.ownsShortcut()) {
          this.toggleFilters();
        } else if (action === 'moveColumnLeft' || action === 'moveColumnRight') {
          this.moveFocusedColumn(action === 'moveColumnLeft' ? -1 : 1);
        }
      });

    this.destroyRef.onDestroy(() => this.menu.dispose());
  }

  private measurePins(): void {
    this.layout.measure(this.host.nativeElement, this.scrollBox()?.nativeElement);
  }

  // Lee `--delay-search-input`; sin token no hay espera (ningún número de reserva en TS).
  private typed(source: Observable<string>): Observable<string> {
    const delay = readMilliseconds(DELAY_SEARCH_INPUT_TOKEN);
    return delay === null || delay <= 0 ? source : source.pipe(debounceTime(delay));
  }

  /** Parte de la entrada `density`; después manda la barra de herramientas. */
  readonly densityChoice = linkedSignal(() => this.density());

  setDensity(density: TableDensity): void {
    this.densityChoice.set(density);
  }

  readonly layout = new TableViewState(this.columns, this.densityChoice, this.selectable);

  protected readonly drag = new TableColumnDrag({
    layout: this.layout,
    columnOf: (key) => this.columns().find((column) => column.key() === key),
    moved: (column, where) => this.announceMove(column, where),
  });

  /** Subir/Bajar del selector y el menú de columna: una posición, dentro de su grupo. */
  moveColumn(column: TableColumn, delta: 1 | -1): void {
    const where = this.layout.move(column, delta);
    if (where) {
      this.announceMove(column, where);
    }
  }

  private announceMove(column: TableColumn, where: ColumnPosition): void {
    const name = column.header() || column.key();
    this.announcement.set(this.text().columnMoved(name, where.position, where.total));
  }

  /** Alt+Shift+←/→ con el foco en una cabecera; el foco sigue a la columna movida. */
  private moveFocusedColumn(delta: 1 | -1): void {
    const active = this.host.nativeElement.ownerDocument.activeElement as HTMLElement | null;
    const cell = active?.closest<HTMLElement>('th[data-col]');
    const column = this.columns().find((candidate) => candidate.key() === cell?.dataset['col']);
    if (!cell || !column || !this.host.nativeElement.contains(cell)) {
      return;
    }
    const focusable = active?.dataset['resize'] !== undefined ? '[data-resize]' : 'button';
    this.moveColumn(column, delta);
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>(`th[data-col="${column.key()}"] ${focusable}`)
          ?.focus(),
      { injector: this.injector },
    );
  }

  /** Las columnas que se dibujan: visibles, con las fijadas en los bordes. */
  readonly visibleColumns = this.layout.visibleColumns;

  protected readonly rowHeight = computed(() => ROW_HEIGHT[this.densityChoice()]);

  protected cellClassesFor(column: TableColumn): string {
    return `${CELL_CLASSES} ${columnCellClasses(column.type())}`;
  }

  protected headerClassesFor(column: TableColumn): string {
    return columnHeaderClasses(column.type());
  }

  protected rowClassesFor(flat: FlatRow<T>): string {
    const state = this.resolveRowState()?.(flat.row) ?? null;
    const tinted = state !== null && TINTED_STATES.includes(state);
    return rowClasses(this.isSelected(flat), tinted ? familyTintClass(state) : '');
  }

  // Formateado para ver, nunca para ordenar.
  protected display(column: TableColumn, row: T): string {
    const value = readCell(row, column.key());
    switch (column.type()) {
      case 'number':
        return this.format().number(value);
      case 'date':
        return this.format().date(value);
      default:
        return value === null || value === undefined ? '' : String(value);
    }
  }

  protected badgeFor(column: TableColumn, row: T): BadgeDescriptor | null {
    return column.badges()[String(readCell(row, column.key()))] ?? null;
  }

  protected cellTemplateOf(column: TableColumn): CellTemplate<T> | undefined {
    return column.cell() as CellTemplate<T> | undefined;
  }

  protected sortDirection(column: TableColumn): 'asc' | 'desc' | null {
    const sort = this.sort();
    return sort && sort.key === column.key() ? sort.direction : null;
  }

  // `aria-sort` solo en la columna ordenada: `none` en las demás es ruido.
  protected ariaSort(column: TableColumn): string | null {
    const direction = this.sortDirection(column);
    if (!direction) {
      return null;
    }
    return direction === 'asc' ? 'ascending' : 'descending';
  }

  // Asc, desc y ninguno: el tercer clic devuelve el orden de la fuente.
  protected toggleSort(column: TableColumn): void {
    if (!column.sortable()) {
      return;
    }
    const current = this.sortDirection(column);
    this.pageIndex.set(0);
    if (current === null) {
      this.sort.set({ key: column.key(), direction: 'asc' });
    } else if (current === 'asc') {
      this.sort.set({ key: column.key(), direction: 'desc' });
    } else {
      this.sort.set(null);
    }
  }

  readonly anyFilterable = computed(() => this.columns().some((column) => column.filterable()));

  readonly filtering = new TableFilters({
    columns: () => this.columns(),
    format: () => this.format(),
    typed: (source) => this.typed(source),
    changed: () => this.pageIndex.set(0),
    none: () => this.text().setNone,
  });

  /** Las opciones de un filtro de conjunto: el diccionario de la columna, en su orden. */
  protected setOptions(column: TableColumn): readonly { key: string; label: string }[] {
    return Object.entries(column.badges()).map(([key, badge]) => ({ key, label: badge.label }));
  }

  protected setLabel(column: TableColumn): string {
    const header = column.header() || column.key();
    const options = this.setOptions(column);
    const chosen = options.filter((option) => this.filtering.isChosen(column, option.key));
    return this.text().setSummary(header, chosen.length, options.length);
  }

  /** Oculta por defecto: se muestra lo que se usa. Ocultar no borra filtros (hay chips). */
  readonly filtersOpen = signal(false);

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  protected readonly showToolbar = computed(
    () =>
      this.quickFilter() ||
      this.anyFilterable() ||
      this.columnChooser() ||
      this.exportable() ||
      this.selection.count() > 0,
  );

  private ownsShortcut(): boolean {
    const host = this.host.nativeElement;
    const active = host.ownerDocument.activeElement;
    if (!this.anyFilterable()) {
      return false;
    }
    if (active && host.contains(active)) {
      return true;
    }
    // Fuera de toda tabla: la primera que filtra, que es la que tiene el botón.
    const inAnyTable = active?.closest('ewms-table') ?? null;
    const first = host.ownerDocument.querySelector('[data-filters-toggle]')?.closest('ewms-table');
    return inAnyTable === null && first === host;
  }

  readonly searchControl = new FormControl('', { nonNullable: true });

  protected readonly searchText = this.search as Signal<string>;

  protected toggleExpanded(flat: FlatRow<T>): void {
    this.tree.toggle(flat);
  }

  protected retryChildren(flat: FlatRow<T>): void {
    this.tree.retry(flat);
  }

  protected isSelected(flat: FlatRow<T>): boolean {
    return this.selection.has(flat.key);
  }

  /** Con Shift (clic o Espacio) marca desde la última tocada hasta esta. */
  protected toggleRow(flat: FlatRow<T>, range = this.rangeGesture): void {
    this.rangeGesture = false;
    if (range) {
      this.selection.range(flat, this.rows());
    } else {
      this.selection.toggle(flat);
    }
    this.emitSelection();
  }

  protected toggleAll(): void {
    this.selection.toggleAll(this.rows());
    this.emitSelection();
  }

  clearSelection(): void {
    this.selection.clear();
    this.emitSelection();
  }

  runBulk(item: MenuItem): void {
    if (!item.disabled) {
      this.bulkAction.emit({ item, rows: this.selection.rows() });
    }
  }

  private emitSelection(): void {
    this.selectionChange.emit(this.selection.rows());
    this.announcement.set(this.text().selectedCount(this.selection.count()));
  }

  /**
   * CSV o portapapeles: lo filtrado y ordenado entero si la fuente lo tiene en memoria, o lo
   * seleccionado. Una fuente remota recibe la consulta por `(exportRequest)`. Ver vault: Tabla §16.
   */
  runExport(kind: 'csv' | 'csv-selected' | 'copy'): void {
    const selectedOnly = kind === 'csv-selected';
    const all = this.source().matching?.(this.query());
    if (all === undefined && kind !== 'copy') {
      const columns = this.visibleColumns().map((column) => column.key());
      this.exportRequest.emit({ query: this.query(), columns, selectedOnly });
      return;
    }
    // CSV: todo lo filtrado; la alternativa, lo seleccionado; copiar, lo seleccionado o todo.
    const chosen = this.selection.count() > 0 ? this.selection.rows() : null;
    const whole = all ?? this.pageRows();
    const rows = selectedOnly ? this.selection.rows() : kind === 'copy' ? (chosen ?? whole) : whole;
    const matrix = exportMatrix(this.visibleColumns(), rows);
    if (kind === 'copy') {
      void navigator.clipboard?.writeText(toTsv(matrix)).then(
        () => this.announcement.set(this.text().copied(rows.length)),
        () => undefined,
      );
      return;
    }
    downloadCsv(this.ariaLabel(), toCsv(matrix), this.host.nativeElement.ownerDocument);
  }

  /**
   * Ctrl+C: la selección, o la fila enfocada, como texto con tabulaciones y encabezados; se pega
   * en Excel tal cual. Solo columnas visibles, en su orden. Ver vault: Tabla §15.
   */
  private copy(flat: FlatRow<T>): void {
    const rows = this.selection.count() > 0 ? this.selection.rows() : [flat.row];
    const text = toTsv(exportMatrix(this.visibleColumns(), rows));
    void navigator.clipboard?.writeText(text).then(
      () => this.announcement.set(this.text().copied(rows.length)),
      () => undefined,
    );
  }

  protected readonly showPagination = computed(() => (this.pageCount() ?? 0) > 1);

  protected goToPage(page: number): void {
    const pages = this.pageCount();
    if (pages === null) {
      return;
    }
    this.pageIndex.set(Math.min(pages - 1, Math.max(0, page)));
  }

  protected isFocused(rowIndex: number, columnIndex: number): boolean {
    return this.focusRow() === rowIndex && this.focusColumn() === columnIndex;
  }

  protected onCellFocus(rowIndex: number, columnIndex: number): void {
    this.focusRow.set(rowIndex);
    this.focusColumn.set(columnIndex);
  }

  // Teclado treegrid de las WAI-ARIA APG: en una fila padre las flechas expanden y
  // pliegan antes de moverse entre celdas. Ver vault: Tabla §6.
  protected onKeydown(event: KeyboardEvent, rowIndex: number): void {
    // La lista aplanada entera, nunca la ventana.
    const rows = this.rows();
    const flat = rows[rowIndex];
    if (!flat) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(Math.min(rows.length - 1, rowIndex + 1), this.focusColumn());
        return;

      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(Math.max(0, rowIndex - 1), this.focusColumn());
        return;

      case 'ArrowRight':
        event.preventDefault();
        if (flat.hasChildren && !flat.expanded) {
          this.toggleExpanded(flat);
          return;
        }
        this.moveFocus(rowIndex, Math.min(this.columnCount() - 1, this.focusColumn() + 1));
        return;

      case 'ArrowLeft':
        event.preventDefault();
        if (flat.hasChildren && flat.expanded) {
          this.toggleExpanded(flat);
          return;
        }
        if (this.focusColumn() === 0 && flat.level > 0) {
          // Primera celda de una hija: va al padre.
          this.moveFocus(parentIndexOf(rows, rowIndex), 0);
          return;
        }
        this.moveFocus(rowIndex, Math.max(0, this.focusColumn() - 1));
        return;

      case 'Home':
        event.preventDefault();
        this.moveFocus(event.ctrlKey ? 0 : rowIndex, 0);
        return;

      case 'End':
        event.preventDefault();
        this.moveFocus(event.ctrlKey ? rows.length - 1 : rowIndex, this.columnCount() - 1);
        return;

      case 'Enter':
        event.preventDefault();
        this.rowActivate.emit({ row: flat.row });
        return;

      case ' ':
        if (this.selectable()) {
          // Espacio hace scroll por defecto.
          event.preventDefault();
          this.toggleRow(flat, event.shiftKey);
        }
        return;

      case 'c':
      case 'C':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.copy(flat);
        }
        return;

      case 'ContextMenu':
      case 'F10':
        // Shift+F10 y la tecla de menú abren el menú; F10 a secas es del navegador.
        if (event.key === 'F10' && !event.shiftKey) {
          return;
        }
        event.preventDefault();
        this.menu.open(flat, event.currentTarget as HTMLElement);
        return;

      default:
        return;
    }
  }

  // Con ventana, la fila destino puede no estar en el DOM: scroll primero, foco después.
  private moveFocus(rowIndex: number, columnIndex: number): void {
    this.focusRow.set(rowIndex);
    this.focusColumn.set(columnIndex);

    this.viewport.reveal(this.scrollBox()?.nativeElement ?? null, rowIndex);

    queueMicrotask(() => {
      this.host.nativeElement
        .querySelector<HTMLElement>(`[data-cell="${rowIndex}-${columnIndex}"]`)
        ?.focus();
    });
  }

  private readonly openDetails = signal<ReadonlySet<unknown>>(new Set());

  protected isMaster(row: T): boolean {
    return this.detail() !== undefined && (this.isRowMaster()?.(row) ?? false);
  }

  protected isDetailOpen(flat: FlatRow<T>): boolean {
    return this.openDetails().has(flat.key);
  }

  protected detailId(flat: FlatRow<T>): string {
    return `${this.tableId}-detail-${String(flat.key)}`;
  }

  // Maestro/detalle no es el árbol: despliega un panel de una celda, no más filas.
  protected toggleDetail(flat: FlatRow<T>): void {
    const open = new Set(this.openDetails());
    if (open.has(flat.key)) {
      open.delete(flat.key);
    } else {
      open.add(flat.key);
    }
    this.openDetails.set(open);
  }

  protected readonly menu = new TableRowMenu<T>({
    tableId: this.tableId,
    items: () => this.menuItems(),
    template: () => this.menuTemplate(),
    injector: this.injector,
    viewContainerRef: this.viewContainerRef,
    document: this.host.nativeElement.ownerDocument,
    closed: (row) => {
      const index = this.rows().findIndex((flat) => flat.key === row.key);
      if (index >= 0) {
        this.moveFocus(index, this.focusColumn());
      }
    },
    chosen: (row, item) => this.rowMenu.emit({ row: row.row, item }),
  });

  /** La ventana de `[virtual]`: qué filas se dibujan. */
  protected readonly viewport = new TableWindow(this.rows, this.virtual, this.densityChoice);

  private readonly scrollBox = viewChild<ElementRef<HTMLElement>>('scrollBox');

  protected onRowDblclick(flat: FlatRow<T>): void {
    this.rowActivate.emit({ row: flat.row });
  }
}

function parentIndexOf<T>(rows: readonly FlatRow<T>[], from: number): number {
  const level = rows[from]?.level ?? 0;
  for (let index = from - 1; index >= 0; index -= 1) {
    if ((rows[index]?.level ?? 0) < level) {
      return index;
    }
  }
  return from;
}
