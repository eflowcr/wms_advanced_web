import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
  type Signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import type { OverlayRef } from '@angular/cdk/overlay';
import { isObservable, of, type Observable } from 'rxjs';
import { catchError, debounceTime, switchMap, tap } from 'rxjs/operators';
import { Badge } from '../badge/badge';
import { Checkbox } from '../checkbox/checkbox';
import { familyTintClass } from '../feedback/feedback.types';
import { Icon } from '../icon/icon';
import { IconButton } from '../icon-button/icon-button';
import { Input as TextInput } from '../input/input';
import { Pagination } from '../pagination/pagination';

import { readMilliseconds, readPixels } from '../tokens/read-token';
/** La única espera del sistema para una caja que alguien está tipeando. */
const DELAY_SEARCH_INPUT_TOKEN = '--delay-search-input';
import { CellTemplate, TableColumn } from './column';
import {
  emptyQuery,
  readCell,
  type TableFilterValue,
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
  COLUMN_WIDTH,
  HEADER_CELL_CLASSES,
  ROW_HEIGHT,
  TABLE_CLASSES,
  columnCellClasses,
  columnHeaderClasses,
  rowClasses,
  type BadgeDescriptor,
  type MenuItem,
  type RowActivateEvent,
  type RowMenuEvent,
  type RowState,
  type TableChildren,
  type TableDensity,
} from './table.types';
import {
  createMenuOverlay,
  menuItemClasses,
  MENU_CLASSES,
  MENU_SEPARATOR_CLASSES,
  MENU_POSITIONS,
  moveMenuIndex,
} from './row-menu';
import { expandableKeys, flattenTree, type FlatRow } from './tree';

export type { CellContext } from './column';
export { TableColumn, CellTemplate } from './column';
export type { FlatRow } from './tree';

/** El panel a todo lo ancho que despliega una fila maestra. */
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

/** Lo que llena la tabla cuando no hay nada que mostrar. */
@Directive({ selector: '[ewmsEmpty]' })
export class EmptyTemplate {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

let nextTableId = 0;

/** Lo que muestra una consulta que falló: nada, honestamente. */
const EMPTY_PAGE: TablePage<never> = { rows: [], page: 0, pageSize: 0, total: 0 };

/**
 * La tabla de datos. `flattenTree()` aplana el árbol antes de pintar: un solo
 * bucle en la plantilla, y la ventana virtual sale sin trucos. El estado de una
 * fila es dato, nunca una clase. Ficha: 08-Sistema-de-Diseno/Componentes/Tabla.
 */
@Component({
  selector: 'ewms-table',
  templateUrl: './table.html',
  imports: [
    Badge,
    Checkbox,
    Icon,
    IconButton,
    NgTemplateOutlet,
    Pagination,
    ReactiveFormsModule,
    TextInput,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class Table<T> {
  readonly source = input.required<TableSource<T>>();

  /** Nombra la grilla. Una tabla por la que nadie puede preguntar no se encuentra. */
  readonly ariaLabel = input.required<string>();

  /**
   * De dónde salen los hijos: una función, o el NOMBRE de una propiedad.
   * Con `children` el rol es `treegrid`; sin él, `grid`.
   */
  readonly children = input<TableChildren<T> | string | null>(null);

  /**
   * En qué estado está una fila: una función, o el NOMBRE de una columna con
   * diccionario `badges`. Un diccionario alimenta el tinte y la insignia.
   */
  readonly rowState = input<((row: T) => RowState | null) | string | null>(null);

  readonly isRowMaster = input<((row: T) => boolean) | null>(null);

  readonly menuItems = input<readonly MenuItem[]>([]);

  /**
   * Pinta solo las filas a la vista. Desde unas 500 filas: cuesta una altura de
   * fila fija y un contenedor con scroll, y veinte filas lo pagan por nada.
   */
  readonly virtual = input<boolean>(false);

  readonly selectable = input<boolean>(false);

  readonly quickFilter = input<boolean>(false);

  readonly density = input<TableDensity>('md');

  readonly pageSize = input<number>(50);

  /**
   * Qué identifica una fila, y también una selección: la selección es un
   * conjunto de claves, así sobrevive a un cambio de página.
   */
  readonly trackBy = input<(row: T) => unknown>((row) => row);

  /** Pisa el diccionario provisto, para una sola tabla. */
  readonly messages = input<Partial<TableMessages> | null>(null);
  readonly formatters = input<Partial<TableFormatters> | null>(null);

  readonly rowActivate = output<RowActivateEvent<T>>();
  readonly rowMenu = output<RowMenuEvent<T>>();
  readonly selectionChange = output<readonly T[]>();
  readonly queryChange = output<TableQuery>();

  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly menuTemplate = viewChild<TemplateRef<unknown>>('menu');

  protected readonly detail = contentChild(DetailTemplate);
  protected readonly empty = contentChild(EmptyTemplate);
  protected readonly columns = contentChildren(TableColumn);

  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly providedMessages = inject(EWMS_TABLE_MESSAGES);
  private readonly providedFormatters = inject(EWMS_TABLE_FORMATTERS);

  private readonly id = ++nextTableId;
  protected readonly tableId = `ewms-table-${this.id}`;

  protected readonly tableClasses = TABLE_CLASSES;
  protected readonly headerCellClasses = HEADER_CELL_CLASSES;
  protected readonly cellClasses = CELL_CLASSES;

  /** Los textos: primero el token, la entrada encima. */
  protected readonly text = computed(() => ({
    ...this.providedMessages,
    ...(this.messages() ?? {}),
  }));

  protected readonly format = computed(() => ({
    ...this.providedFormatters,
    ...(this.formatters() ?? {}),
  }));

  // -------------------------------------------------------------- la consulta

  private readonly search = signal('');
  private readonly filters = signal<Readonly<Record<string, TableFilterValue>>>({});
  private readonly sort = signal<TableQuery['sort']>(null);
  private readonly pageIndex = signal(0);

  protected readonly query = computed<TableQuery>(() => ({
    ...emptyQuery(this.pageSize()),
    search: this.search(),
    filters: this.filters(),
    sort: this.sort(),
    page: this.pageIndex(),
  }));

  /**
   * La fuente Y la consulta: sin la fuente, cambiarla dejaba las filas viejas
   * en pantalla hasta que alguien ordenara o filtrara.
   */
  private readonly request = computed(() => ({ source: this.source(), query: this.query() }));

  protected readonly page = signal<TablePage<T>>({
    rows: [],
    page: 0,
    pageSize: 0,
    total: null,
  });

  protected readonly pageCount = computed(() => {
    const total = this.page().total;
    return total === null ? null : Math.max(1, Math.ceil(total / this.pageSize()));
  });

  // ------------------------------------------------------------------ el arbol

  private readonly expanded = signal<ReadonlySet<unknown>>(new Set());
  private readonly loadingChildren = signal<ReadonlySet<unknown>>(new Set());
  private readonly failedChildren = signal<ReadonlySet<unknown>>(new Set());
  /** Hijos que llegaron de un Observable, por clave de fila. */
  private readonly lazyChildren = signal<ReadonlyMap<unknown, readonly T[]>>(new Map());

  /** El resolvedor de hijos, en la forma que haya usado el consumidor. */
  private readonly resolveChildren = computed<TableChildren<T> | null>(() => {
    const declared = this.children();
    if (declared === null) {
      return null;
    }
    if (typeof declared === 'string') {
      return (row) => (readCell(row, declared) as readonly T[] | undefined) ?? null;
    }
    return declared;
  });

  /** El resolvedor de estado, en la forma que haya usado el consumidor. */
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

  protected readonly isTree = computed(() => this.resolveChildren() !== null);

  /**
   * Los hijos que ya están en mano. `undefined` es «hay hijos y no llegaron»;
   * `null` es «es una hoja». La diferencia dibuja el toggle.
   */
  private readonly childrenOf = (row: T): readonly T[] | null | undefined => {
    const resolve = this.resolveChildren();
    if (!resolve) {
      return null;
    }
    const resolved = resolve(row);
    if (resolved === null) {
      return null;
    }
    if (isObservable(resolved)) {
      return this.lazyChildren().get(this.trackBy()(row));
    }
    return resolved;
  };

  private readonly hasChildrenOf = (row: T): boolean => {
    const resolve = this.resolveChildren();
    if (!resolve) {
      return false;
    }
    const resolved = resolve(row);
    if (resolved === null) {
      return false;
    }
    // Un padre perezoso tiene hijos por definición: dibujar el toggle recién
    // cuando llegan dejaría que nadie los pudiera pedir.
    return isObservable(resolved) || resolved.length > 0;
  };

  protected readonly rows = computed<readonly FlatRow<T>[]>(() =>
    flattenTree(this.page().rows, {
      children: this.childrenOf,
      hasChildren: this.hasChildrenOf,
      key: this.trackBy(),
      expanded: this.expanded(),
      loading: this.loadingChildren(),
      failed: this.failedChildren(),
    }),
  );

  protected readonly anyExpandable = computed(
    () =>
      this.isTree() &&
      expandableKeys(this.page().rows, {
        children: this.childrenOf,
        hasChildren: this.hasChildrenOf,
        key: this.trackBy(),
      }).length > 0,
  );

  // -------------------------------------------------------------- selection

  private readonly selectedKeys = signal<ReadonlySet<unknown>>(new Set());

  protected readonly allSelected = computed(() => {
    const rows = this.rows();
    return rows.length > 0 && rows.every((flat) => this.selectedKeys().has(flat.key));
  });

  protected readonly someSelected = computed(
    () => !this.allSelected() && this.rows().some((flat) => this.selectedKeys().has(flat.key)),
  );

  // ------------------------------------------------------------------ la grilla

  /** Las columnas que camina el teclado: la casilla y después las declaradas. */
  protected readonly columnCount = computed(
    () => this.columns().length + (this.selectable() ? 1 : 0),
  );

  /** Dónde está el teclado. Un solo tab stop para toda la tabla. */
  protected readonly focusRow = signal(0);
  protected readonly focusColumn = signal(0);

  constructor() {
    /*
     * Un cambio de consulta CANCELA la petición en vuelo: una página 0 lenta que
     * aterriza después de una página 1 rápida pinta la página equivocada. Sin
     * debounce: solo una caja que se TIPEA necesita espera, y es suya.
     */
    toObservable(this.request)
      .pipe(
        tap(({ query }) => this.queryChange.emit(query)),
        switchMap(({ source, query }) =>
          /*
           * Un error que escapa del switchMap mata la suscripción de afuera y la
           * tabla no vuelve a cargar nunca, sin nada que lo diga. Se atrapa por
           * consulta; el estado de error con reintento es un hueco declarado.
           */
          source.load(query).pipe(catchError(() => of(EMPTY_PAGE as TablePage<T>))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => this.page.set(page));

    this.typed(this.searchControl.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe((text) => {
        this.pageIndex.set(0);
        this.search.set(text);
      });

    /*
     * La caja se mide una vez, en fase de lectura. Sin esto la primera ventana se
     * calcula contra una altura de cero y la tabla abre mostrando solo el
     * overscan. `clientHeight` es lectura de layout: va en afterNextRender.
     */
    afterNextRender({
      read: () => {
        const box = this.scrollBox()?.nativeElement;
        if (box) {
          this.onScrollBoxReady(box);
        }
      },
    });

    /*
     * El overlay vive en el body y no acá: destruir la tabla no se lleva el menú
     * abierto, que si no quedaría flotando sobre la pantalla siguiente.
     */
    this.destroyRef.onDestroy(() => {
      this.releaseMenuGesture();
      this.menuOverlay?.dispose();
      this.menuOverlay = null;
    });
  }

  /**
   * La espera entre la última tecla y la consulta. Lee `--delay-search-input`, el
   * mismo token que el selector con búsqueda. SIN TOKEN NO HAY ESPERA: ningún
   * número de reserva vive en TypeScript, igual que la duración del Toast.
   */
  private typed(source: Observable<string>): Observable<string> {
    const delay = readMilliseconds(DELAY_SEARCH_INPUT_TOKEN);
    return delay === null || delay <= 0 ? source : source.pipe(debounceTime(delay));
  }

  // ------------------------------------------------------------ appearance

  protected readonly rowHeight = computed(() => ROW_HEIGHT[this.density()]);

  protected columnWidth(column: TableColumn): string | null {
    const width = column.width();
    return width === 'fill' ? null : COLUMN_WIDTH[width];
  }

  protected cellClassesFor(column: TableColumn): string {
    return `${CELL_CLASSES} ${columnCellClasses(column.type())}`;
  }

  protected headerClassesFor(column: TableColumn): string {
    return columnHeaderClasses(column.type());
  }

  protected rowClassesFor(flat: FlatRow<T>): string {
    const state = this.resolveRowState()?.(flat.row) ?? null;
    return rowClasses(this.isSelected(flat), state ? familyTintClass(state) : '');
  }

  /** El valor que muestra una celda: formateado para ver, nunca para ordenar. */
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

  // ----------------------------------------------------------------- sort

  protected sortDirection(column: TableColumn): 'asc' | 'desc' | null {
    const sort = this.sort();
    return sort && sort.key === column.key() ? sort.direction : null;
  }

  /**
   * `aria-sort` solo en la columna ordenada: `none` en las demás es válido y
   * ruidoso, y ausente es lo que espera un lector de pantalla.
   */
  protected ariaSort(column: TableColumn): string | null {
    const direction = this.sortDirection(column);
    if (!direction) {
      return null;
    }
    return direction === 'asc' ? 'ascending' : 'descending';
  }

  /**
   * Ascendente, descendente y NINGUNO. El tercer clic devuelve el orden que dio
   * la fuente, que suele ser el que significa algo.
   */
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

  // --------------------------------------------------------------- filters

  protected readonly anyFilterable = computed(() =>
    this.columns().some((column) => column.filterable()),
  );

  /**
   * Un `FormControl` por caja de filtro, creado a demanda y memorizado: la
   * plantilla lo pide en cada ciclo y uno nuevo cada vez borraría lo tipeado.
   */
  private readonly filterControls = new Map<string, FormControl<string>>();

  protected filterControl(column: TableColumn, bound: FilterBound): FormControl<string> {
    const id = `${column.key()}:${bound}`;
    const existing = this.filterControls.get(id);
    if (existing) {
      return existing;
    }
    const control = new FormControl('', { nonNullable: true });
    this.typed(control.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onFilterChange(column, bound, value));
    this.filterControls.set(id, control);
    return control;
  }

  private onFilterChange(column: TableColumn, bound: FilterBound, raw: string): void {
    if (bound === 'text') {
      this.writeFilter(column, raw.trim() === '' ? undefined : raw);
      return;
    }

    const current = this.filters()[column.key()];
    const base: Record<string, unknown> =
      current === undefined || typeof current === 'string' ? {} : { ...current };

    if (raw.trim() === '') {
      /*
       * Una caja vacía es SIN LÍMITE, no cero: «hasta 50» es un máximo sin mínimo,
       * y leerla como 0 tiraría en silencio toda fila por debajo.
       */
      delete base[bound];
    } else {
      base[bound] = column.type() === 'number' ? Number(raw) : raw;
    }

    this.writeFilter(
      column,
      Object.keys(base).length === 0 ? undefined : (base as TableFilterValue),
    );
  }

  private writeFilter(column: TableColumn, value: TableFilterValue | undefined): void {
    this.pageIndex.set(0);
    this.filters.update((current) => {
      const next = { ...current };
      if (value === undefined) {
        delete next[column.key()];
      } else {
        next[column.key()] = value;
      }
      return next;
    });
  }

  protected readonly searchControl = new FormControl('', { nonNullable: true });

  protected readonly searchText = this.search as Signal<string>;

  // ------------------------------------------------------------ expansion

  protected toggleExpanded(flat: FlatRow<T>): void {
    if (!flat.hasChildren) {
      return;
    }
    const open = new Set(this.expanded());
    if (open.has(flat.key)) {
      open.delete(flat.key);
      this.expanded.set(open);
      return;
    }
    open.add(flat.key);
    this.expanded.set(open);
    this.loadLazyChildren(flat);
  }

  /**
   * Una sola vez: volver a pedirlos en cada expansión es cómo una tabla rápida
   * pasa a pegarle a la red cada vez que alguien navega hacia arriba.
   */
  private loadLazyChildren(flat: FlatRow<T>): void {
    const resolve = this.resolveChildren();
    const resolved = resolve?.(flat.row);
    if (!resolved || !isObservable(resolved) || this.lazyChildren().has(flat.key)) {
      return;
    }

    this.failedChildren.update((current) => withoutKey(current, flat.key));
    this.loadingChildren.update((current) => withKey(current, flat.key));

    resolved.subscribe({
      next: (children) => {
        this.lazyChildren.update((current) => new Map(current).set(flat.key, children));
        this.loadingChildren.update((wip) => withoutKey(wip, flat.key));
      },
      error: () => {
        this.loadingChildren.update((wip) => withoutKey(wip, flat.key));
        this.failedChildren.update((current) => withKey(current, flat.key));
      },
    });
  }

  protected retryChildren(flat: FlatRow<T>): void {
    this.lazyChildren.update((current) => {
      const next = new Map(current);
      next.delete(flat.key);
      return next;
    });
    this.loadLazyChildren(flat);
  }

  // ------------------------------------------------------------ selection

  protected isSelected(flat: FlatRow<T>): boolean {
    return this.selectedKeys().has(flat.key);
  }

  protected toggleRow(flat: FlatRow<T>): void {
    const keys = new Set(this.selectedKeys());
    if (keys.has(flat.key)) {
      keys.delete(flat.key);
    } else {
      keys.add(flat.key);
    }
    this.selectedKeys.set(keys);
    this.emitSelection();
  }

  /**
   * La casilla de cabecera selecciona lo que está EN PANTALLA, no todo lo que
   * tiene la fuente: si no, alguien borra 400 registros queriendo borrar 20.
   */
  protected toggleAll(): void {
    const keys = new Set(this.selectedKeys());
    if (this.allSelected()) {
      for (const flat of this.rows()) {
        keys.delete(flat.key);
      }
    } else {
      for (const flat of this.rows()) {
        keys.add(flat.key);
      }
    }
    this.selectedKeys.set(keys);
    this.emitSelection();
  }

  private emitSelection(): void {
    const byKey = new Map(this.rows().map((flat) => [flat.key, flat.row]));
    const rows = [...this.selectedKeys()]
      .map((key) => byKey.get(key))
      .filter((row): row is T => row !== undefined);
    this.selectionChange.emit(rows);
  }

  // --------------------------------------------------------------- paging

  /** El paginador se pinta solo cuando la fuente contó. */
  protected readonly showPagination = computed(() => (this.pageCount() ?? 0) > 1);

  protected goToPage(page: number): void {
    const pages = this.pageCount();
    if (pages === null) {
      return;
    }
    this.pageIndex.set(Math.min(pages - 1, Math.max(0, page)));
  }

  // ------------------------------------------------------------- keyboard

  protected isFocused(rowIndex: number, columnIndex: number): boolean {
    return this.focusRow() === rowIndex && this.focusColumn() === columnIndex;
  }

  protected onCellFocus(rowIndex: number, columnIndex: number): void {
    this.focusRow.set(rowIndex);
    this.focusColumn.set(columnIndex);
  }

  /**
   * El teclado del treegrid de las WAI-ARIA APG. En una fila padre las flechas
   * son del ÁRBOL, y solo cuando no hay nada que expandir o plegar se mueven
   * entre celdas: así se camina una tabla de tres niveles sin tocar un toggle.
   */
  protected onKeydown(event: KeyboardEvent, rowIndex: number): void {
    // La lista aplanada ENTERA y nunca la ventana: las flechas caminan la tabla,
    // y lo que esté pintado es un detalle.
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
          // Primera celda de una fila hija: al padre, la fila de arriba más
          // cercana con nivel menor.
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
          // Espacio hace scroll por defecto, que es lo último que quiere alguien
          // tildando filas.
          event.preventDefault();
          this.toggleRow(flat);
        }
        return;

      case 'ContextMenu':
      case 'F10':
        /*
         * Shift+F10 y la tecla de menú son el clic derecho del teclado. Sin ellas
         * el menú de fila sería solo de ratón. F10 a secas se deja: es del
         * navegador.
         */
        if (event.key === 'F10' && !event.shiftKey) {
          return;
        }
        event.preventDefault();
        this.openMenu(flat, event.currentTarget as HTMLElement);
        return;

      default:
        return;
    }
  }

  /**
   * CON VENTANA ABIERTA la fila destino puede no estar en el DOM: primero se
   * hace scroll y el foco va en el turno siguiente. Si no, bajar con la flecha
   * pierde el foco al salir de la ventana.
   */
  private moveFocus(rowIndex: number, columnIndex: number): void {
    this.focusRow.set(rowIndex);
    this.focusColumn.set(columnIndex);

    const px = this.rowPixels();
    if (this.virtualised() && px !== null) {
      const box = this.host.nativeElement.querySelector<HTMLElement>('[data-scroll-box]');
      if (box) {
        const top = rowIndex * px;
        const bottom = top + px;
        if (top < box.scrollTop) {
          box.scrollTop = top;
        } else if (bottom > box.scrollTop + box.clientHeight) {
          box.scrollTop = bottom - box.clientHeight;
        }
        this.scrollTop.set(box.scrollTop);
        this.viewportHeight.set(box.clientHeight);
      }
    }

    queueMicrotask(() => {
      this.host.nativeElement
        .querySelector<HTMLElement>(`[data-cell="${rowIndex}-${columnIndex}"]`)
        ?.focus();
    });
  }

  // ------------------------------------------------------------ master/detail

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

  /**
   * Maestro/detalle NO es el árbol. Una fila padre despliega más FILAS en las
   * mismas columnas; una maestra despliega un PANEL de una celda.
   */
  protected toggleDetail(flat: FlatRow<T>): void {
    const open = new Set(this.openDetails());
    if (open.has(flat.key)) {
      open.delete(flat.key);
    } else {
      open.add(flat.key);
    }
    this.openDetails.set(open);
  }

  // -------------------------------------------------------------------- el menu

  private menuOverlay: OverlayRef | null = null;

  /**
   * Si empezó un gesto NUEVO desde que se abrió el menú. Chromium sobre X11 manda
   * `contextmenu` en la pulsación y `auxclick` en la suelta, y el `auxclick` del
   * mismo clic cerraba lo que el `contextmenu` acababa de abrir (defecto 2a88b80).
   * Un gesto nuevo siempre empieza con `pointerdown`.
   */
  private menuGestureEnded = false;

  private readonly onMenuPointerDown = (): void => {
    this.menuGestureEnded = true;
  };

  private releaseMenuGesture(): void {
    this.host.nativeElement.ownerDocument.removeEventListener(
      'pointerdown',
      this.onMenuPointerDown,
      true,
    );
  }

  protected readonly menuRow = signal<FlatRow<T> | null>(null);
  protected readonly menuIndex = signal(-1);
  protected readonly menuClasses = MENU_CLASSES;
  protected readonly menuSeparatorClasses = MENU_SEPARATOR_CLASSES;
  protected readonly menuId = `${this.tableId}-menu`;

  protected readonly hasMenu = computed(() => this.menuItems().length > 0);

  protected menuOptionId(index: number): string {
    return `${this.menuId}-item-${index}`;
  }

  protected menuItemClassesFor(item: MenuItem, index: number): string {
    return menuItemClasses(item, index === this.menuIndex());
  }

  /**
   * DOS ENTRADAS, UN MENÚ: botón derecho y kebab. Un trackpad no tiene clic
   * derecho; solo el kebab ignoraría la costumbre de quien sí lo tiene.
   */
  protected openMenu(flat: FlatRow<T>, anchor: HTMLElement): void {
    if (!this.hasMenu()) {
      return;
    }
    this.closeMenu();
    const template = this.menuTemplate();
    if (!template) {
      return;
    }
    this.menuRow.set(flat);
    this.menuIndex.set(-1);
    this.menuOverlay = createMenuOverlay(
      this.injector,
      anchor,
      this.viewContainerRef,
      template,
      MENU_POSITIONS,
    );
    this.menuGestureEnded = false;
    this.host.nativeElement.ownerDocument.addEventListener(
      'pointerdown',
      this.onMenuPointerDown,
      true,
    );
    this.menuOverlay.outsidePointerEvents().subscribe(() => {
      if (this.menuGestureEnded) {
        this.closeMenu();
      }
    });
    queueMicrotask(() => {
      this.host.nativeElement.ownerDocument.querySelector<HTMLElement>(`#${this.menuId}`)?.focus();
    });
  }

  protected onRowContextMenu(event: MouseEvent, flat: FlatRow<T>): void {
    if (!this.hasMenu()) {
      return;
    }
    // Reemplaza el menú del navegador en vez de sumar uno al lado.
    event.preventDefault();
    this.openMenu(flat, event.target as HTMLElement);
  }

  /**
   * Devuelve el foco A LA FILA y no al documento: si no, el teclado empieza de
   * cero y la persona termina usando el ratón para todo.
   */
  protected closeMenu(): void {
    if (!this.menuOverlay) {
      return;
    }
    this.releaseMenuGesture();
    const row = this.menuRow();
    this.menuOverlay.dispose();
    this.menuOverlay = null;
    this.menuRow.set(null);
    this.menuIndex.set(-1);
    if (row) {
      const index = this.rows().findIndex((flat) => flat.key === row.key);
      if (index >= 0) {
        this.moveFocus(index, this.focusColumn());
      }
    }
  }

  protected chooseMenuItem(item: MenuItem): void {
    const row = this.menuRow();
    if (!row || item.disabled) {
      return;
    }
    this.closeMenu();
    this.rowMenu.emit({ row: row.row, item });
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const items = this.menuItems();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.menuIndex.set(moveMenuIndex(items, this.menuIndex(), 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.menuIndex.set(moveMenuIndex(items, this.menuIndex(), -1));
        return;
      case 'Enter':
      case ' ': {
        const item = items[this.menuIndex()];
        if (item) {
          event.preventDefault();
          this.chooseMenuItem(item);
        }
        return;
      }
      case 'Escape':
        event.preventDefault();
        this.closeMenu();
        return;
      default:
        return;
    }
  }

  // ------------------------------------------------------- virtualizacion

  /**
   * La altura de fila en píxeles, que es lo que pide la aritmética de la ventana.
   * SIN TOKEN NO HAY VIRTUALIZACIÓN, en vez de un cuarenta inventado.
   */
  protected readonly rowPixels = computed(() =>
    readPixels(this.density() === 'sm' ? '--row-height-sm' : '--row-height-md'),
  );

  protected readonly virtualised = computed(() => this.virtual() && this.rowPixels() !== null);

  private readonly scrollTop = signal(0);
  private readonly viewportHeight = signal(0);

  private readonly scrollBox = viewChild<ElementRef<HTMLElement>>('scrollBox');

  private readonly overscan = 6;

  /**
   * Qué filas están en el DOM y cuánto hueco queda a cada lado. NO es
   * `cdk-virtual-scroll-viewport`: su transform mueve la tabla entera y la
   * cabecera deja de ser pegajosa. Desviación declarada en la ficha Tabla.
   */
  protected readonly rowWindow = computed(() => {
    const all = this.rows();
    const px = this.rowPixels();
    if (!this.virtualised() || px === null) {
      return { first: 0, rows: all, before: 0, after: 0 };
    }
    const visible = Math.ceil(this.viewportHeight() / px) + this.overscan * 2;
    const first = Math.max(0, Math.floor(this.scrollTop() / px) - this.overscan);
    const last = Math.min(all.length, first + visible);
    return {
      first,
      rows: all.slice(first, last),
      before: first * px,
      after: (all.length - last) * px,
    };
  });

  protected onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    this.scrollTop.set(element.scrollTop);
    this.viewportHeight.set(element.clientHeight);
  }

  protected onScrollBoxReady(element: HTMLElement): void {
    this.viewportHeight.set(element.clientHeight);
  }

  protected onRowDblclick(flat: FlatRow<T>): void {
    this.rowActivate.emit({ row: flat.row });
  }
}

function withKey(set: ReadonlySet<unknown>, key: unknown): ReadonlySet<unknown> {
  const next = new Set(set);
  next.add(key);
  return next;
}

function withoutKey(set: ReadonlySet<unknown>, key: unknown): ReadonlySet<unknown> {
  const next = new Set(set);
  next.delete(key);
  return next;
}

/**
 * La fila de arriba más cercana con nivel menor. Función libre para que la regla
 * de teclado que sirve se lea en un solo lugar.
 */
function parentIndexOf<T>(rows: readonly FlatRow<T>[], from: number): number {
  const level = rows[from]?.level ?? 0;
  for (let index = from - 1; index >= 0; index -= 1) {
    if ((rows[index]?.level ?? 0) < level) {
      return index;
    }
  }
  return from;
}

/** De qué caja de un filtro vino un valor. `text` es el filtro entero. */
type FilterBound = 'text' | 'min' | 'max' | 'from' | 'to';
