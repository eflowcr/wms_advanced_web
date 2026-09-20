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
/** The one wait of the system for a box somebody is typing into. */
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

/** The full-width panel a master row unfolds. */
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

/** What fills the table when there is nothing to show. */
@Directive({ selector: '[ewmsEmpty]' })
export class EmptyTemplate {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

let nextTableId = 0;

/** What a failed query shows: nothing, honestly. */
const EMPTY_PAGE: TablePage<never> = { rows: [], page: 0, pageSize: 0, total: 0 };

/**
 * The data table.
 *
 * IT IS WHERE A WMS OPERATOR LIVES, and it is the component that most easily
 * becomes a monster. The rule this file was written against fits in a line:
 * **a lot of capability, very little code in the consumer.** A table of
 * expediciones with three levels, coloured states, sorting, per-column
 * filters, a quick filter, multiple selection, a context menu, a detail panel
 * and an empty state is twenty-four lines of markup on the other side.
 *
 * Everything below exists to keep that number small.
 *
 *
 * ONE LOOP, BECAUSE THE TREE IS FLATTENED FIRST
 *
 * There is no nested `<table>` and no recursive markup. `flattenTree()` -- a
 * pure function, tested on its own -- turns roots plus a set of expanded keys
 * into one array, and the template walks it. That is also what makes
 * virtualisation possible without tricks -- the CDK needs a flat list with a
 * known length, and it already has one.
 *
 *
 * THE STATE OF A ROW IS DATA, NEVER A CLASS
 *
 * `rowState` yields one of four families; the row takes that family's surface
 * and the `badge` column draws icon and words from the SAME dictionary. A
 * class per view is how one screen ends up calling "con incidencia" red and
 * another amber.
 *
 *
 * NOT A `ControlValueAccessor`, and that is not an omission
 *
 * The selection is an output. What lives in a table is a query, not a field,
 * and a table inside a `formControlName` would be a category error.
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

  /** Names the grid. A table nobody can ask for is a table nobody can find. */
  readonly ariaLabel = input.required<string>();

  /**
   * Where the children of a row come from: a function, or the NAME of a
   * property. `children="hijos"` is exactly `(row) => row.hijos ?? null`.
   *
   * With this there is a tree and the role is `treegrid`; without it the role
   * is `grid`. The role is not an input because it is not a choice: it is what
   * the table turned out to be.
   */
  readonly children = input<TableChildren<T> | string | null>(null);

  /**
   * What state a row is in: a function, or the NAME of a column whose `badges`
   * dictionary holds the answer. `rowState="estado"` makes one dictionary feed
   * both the tint and the badge.
   */
  readonly rowState = input<((row: T) => RowState | null) | string | null>(null);

  readonly isRowMaster = input<((row: T) => boolean) | null>(null);

  readonly menuItems = input<readonly MenuItem[]>([]);

  /**
   * Render only the rows in view.
   *
   * Recommended from about five hundred rows. It is an input and not automatic
   * because virtualising costs a fixed row height and a scroll container, and
   * a table of twenty rows pays that for nothing.
   */
  readonly virtual = input<boolean>(false);

  readonly selectable = input<boolean>(false);

  readonly quickFilter = input<boolean>(false);

  readonly density = input<TableDensity>('md');

  readonly pageSize = input<number>(50);

  /**
   * What identifies a row. ALSO WHAT IDENTIFIES A SELECTION: the selection is
   * a set of keys, not of objects, so it survives a page change -- which is
   * exactly when a selection held by reference disappears without a word.
   */
  readonly trackBy = input<(row: T) => unknown>((row) => row);

  /** Overrides the provided dictionary, for one table. */
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

  /** The texts, token first and input on top. */
  protected readonly text = computed(() => ({
    ...this.providedMessages,
    ...(this.messages() ?? {}),
  }));

  protected readonly format = computed(() => ({
    ...this.providedFormatters,
    ...(this.formatters() ?? {}),
  }));

  // -------------------------------------------------------------- the query

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
   * What a load needs: the source AND the query.
   *
   * BOTH, because a screen that swaps its source -- a different warehouse, a
   * different document type -- has to reload, and reading the source inside
   * the switchMap would have left the old rows on screen until somebody
   * happened to sort or filter. Found by the spec that swaps a failing source
   * for a working one.
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

  // ------------------------------------------------------------- the tree

  private readonly expanded = signal<ReadonlySet<unknown>>(new Set());
  private readonly loadingChildren = signal<ReadonlySet<unknown>>(new Set());
  private readonly failedChildren = signal<ReadonlySet<unknown>>(new Set());
  /** Children that arrived from an Observable, by row key. */
  private readonly lazyChildren = signal<ReadonlyMap<unknown, readonly T[]>>(new Map());

  /** The children resolver, whichever form the consumer used. */
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

  /** The state resolver, whichever form the consumer used. */
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
   * The children of a row that are already in hand.
   *
   * `undefined` and `null` mean different things and the difference draws the
   * toggle: `undefined` is "there are children, they are not here yet",
   * `null` is "this is a leaf".
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
    // A lazy parent has children by definition: that is what returning an
    // Observable says. Drawing the toggle only after they arrive would mean
    // nobody could ever ask for them.
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

  // ------------------------------------------------------------- the grid

  /** The columns the keyboard walks: the checkbox, then the declared ones. */
  protected readonly columnCount = computed(
    () => this.columns().length + (this.selectable() ? 1 : 0),
  );

  /** Where the keyboard is. One tab stop for the whole table. */
  protected readonly focusRow = signal(0);
  protected readonly focusColumn = signal(0);

  constructor() {
    /*
     * The query drives the source, and a change CANCELS the request in flight:
     * a slow page 0 landing after a fast page 1 would paint the wrong page
     * with nothing to say it had.
     *
     * NO DEBOUNCE HERE, and that is deliberate. Sorting and paging are single
     * gestures and have to answer at once; only a box somebody is TYPING INTO
     * needs a wait, and that wait belongs on the box.
     */
    toObservable(this.request)
      .pipe(
        tap(({ query }) => this.queryChange.emit(query)),
        switchMap(({ source, query }) =>
          /*
           * A SOURCE THAT ERRORS MUST NOT TAKE THE TABLE WITH IT.
           *
           * An error escaping the switchMap kills the outer subscription, and
           * then the table never loads again -- not on a new filter, not on a
           * new page, not ever, and with nothing on screen to say why. Caught
           * per query, so the next one still runs.
           *
           * What is shown is the empty page, which is honest about there being
           * nothing to show. A table-level error state with a retry is worth
           * having and is not in this scope; it is reported as a gap.
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
     * MEASURE THE BOX ONCE, IN THE READ PHASE.
     *
     * Without this the first window is computed against a height of zero, so a
     * virtualised table opens showing only the overscan -- a dozen rows for a
     * box that fits a dozen, and nothing in reserve -- until somebody scrolls.
     * The read is in `afterNextRender` because `clientHeight` is a layout read
     * and doing it during rendering is how a component starts thrashing.
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
     * An overlay lives in the body, NOT inside this component, so destroying
     * the table does not take the open menu with it. Navigating away with the
     * menu open would otherwise leave it floating over the next screen.
     */
    this.destroyRef.onDestroy(() => {
      this.releaseMenuGesture();
      this.menuOverlay?.dispose();
      this.menuOverlay = null;
    });
  }

  /**
   * The wait between the last keystroke and the query, for a box somebody is
   * typing into.
   *
   * It reads `--delay-search-input` -- the SAME token the search select uses,
   * because "how long before a typed query leaves" is one number for the
   * system, not one per component.
   *
   * WITH NO TOKEN DECLARED THERE IS NO WAIT AT ALL, rather than a number
   * invented here. Same rule as the Toast's duration: no fallback lives in
   * TypeScript. It also makes the component synchronous under jsdom, where no
   * stylesheet is loaded -- which is why its spec can assert on a filter
   * without driving a clock.
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

  /** The value a cell shows: formatted for display, never for sorting. */
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
   * `aria-sort` goes on the header, and only on the one that is sorted.
   * `none` on every other column is valid and noisy; absent is what assistive
   * technology expects on a column that simply is not the sort.
   */
  protected ariaSort(column: TableColumn): string | null {
    const direction = this.sortDirection(column);
    if (!direction) {
      return null;
    }
    return direction === 'asc' ? 'ascending' : 'descending';
  }

  /**
   * Ascending, descending, then NONE. The third press is what lets someone get
   * back to the order the source returned, which is usually the meaningful one
   * -- newest first, or whatever the backend decided.
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
   * One `FormControl` per filter box, made on demand and kept.
   *
   * `ewms-input` has no `value` input on purpose -- its value travels through
   * `ControlValueAccessor`, like every other control here -- so the way to
   * drive one from inside another component is a control. Making them lazily
   * keeps the map to the boxes that actually exist: a table with one
   * filterable column does not carry twelve controls.
   *
   * The memo matters: the template asks for a control on every change
   * detection pass, and a new control each time would wipe what somebody is
   * typing.
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
       * AN EMPTY BOX MEANS UNBOUNDED, NOT ZERO, and that is the whole
       * usefulness of a range: "up to 50" is a max with no min. Reading the
       * empty box as 0 would silently drop every row below it.
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
   * Fetch children that arrive as an Observable, once.
   *
   * Once, and not on every expand: re-fetching on the second expand of the
   * same row is how a table that felt fast becomes a table that hits the
   * network every time somebody browses back up.
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
   * The header box selects what is ON SCREEN, not everything the source holds.
   *
   * A "select all" that reached rows nobody has seen is how somebody deletes
   * four hundred records meaning to delete twenty. The indeterminate state
   * says the same thing: some of these, not all of these.
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

  /** The paginator is rendered only when the source counted. */
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
   * The treegrid keyboard of the WAI-ARIA Authoring Practices, followed rather
   * than reinvented.
   *
   * The one part worth spelling out is the arrows: on a parent row they belong
   * to the TREE, and only when there is nothing to expand or collapse do they
   * move between cells. That is what makes a keyboard user able to walk a
   * three-level table without reaching for a toggle.
   */
  protected onKeydown(event: KeyboardEvent, rowIndex: number): void {
    // The WHOLE flat list, never the window: the arrows walk the table, and
    // what happens to be rendered is an implementation detail.
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
          // The first cell of a child row: go to the parent, which is the
          // nearest row above with a smaller level.
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
          // Space scrolls the page by default, which is the last thing
          // somebody ticking rows wants.
          event.preventDefault();
          this.toggleRow(flat);
        }
        return;

      case 'ContextMenu':
      case 'F10':
        /*
         * THE KEYBOARD'S RIGHT CLICK.
         *
         * `Shift+F10` is the shortcut every desktop already has, and the
         * dedicated menu key is the same gesture on a keyboard that has one.
         * Without them the row menu would be a mouse-only feature -- the
         * kebab is reachable by tab, but only after walking out of the grid
         * -- and the actions an operator uses most would be the slowest
         * things on the screen.
         *
         * A bare F10 is left alone: it belongs to the browser.
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
   * Move the roving tab stop and take the focus with it.
   *
   * WITH A WINDOW OPEN, THE TARGET ROW MAY NOT BE IN THE DOM YET, so the box
   * is scrolled to it first and the focus follows on the next turn. Without
   * that, holding the down arrow through a virtualised table would lose the
   * focus the moment it left the window -- which is the failure that makes
   * people stop using the keyboard.
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
   * Master/detail is NOT the tree, and the two are kept apart on purpose.
   *
   * A parent row unfolds more ROWS, in the same columns. A master row unfolds
   * a PANEL -- one cell spanning the table, with content of its own that does
   * not repeat the columns. Collapsing them into one gesture would mean a
   * table where "expand" sometimes means a different thing, which is worse
   * than two buttons.
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

  // ------------------------------------------------------------- the menu

  private menuOverlay: OverlayRef | null = null;

  /**
   * Whether a NEW pointer gesture has begun since the menu opened.
   *
   * A right click is not one event but a burst, and the browsers disagree on
   * its order. Chromium on X11 -- which is what CI runs -- delivers
   * `contextmenu` on the press and `auxclick` on the release; Chromium on
   * Windows delivers `auxclick` first and `contextmenu` last. CDK's
   * outside-pointer stream listens to `click`, `auxclick` AND `contextmenu`
   * on the body, so on X11 the `auxclick` of the very click that opened the
   * menu reaches an overlay that already exists, counts as a click outside
   * it, and closes what it just opened. On Windows nothing follows the
   * `contextmenu`, which is why the menu works on a developer machine and
   * not on CI.
   *
   * A new gesture always begins with a `pointerdown`. Until one arrives, a
   * pointer event is still the tail of the click that opened the menu and is
   * not a reason to close it.
   */
  private menuGestureEnded = false;

  private readonly onMenuPointerDown = (): void => {
    this.menuGestureEnded = true;
  };

  /** Stop listening for the gesture that is allowed to close the menu. */
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
   * Open the menu for a row, anchored wherever it was asked for.
   *
   * TWO WAYS IN, ONE MENU: the right button and the kebab. A trackpad and a
   * touch screen have no right click, so right-click-only would be a menu half
   * the people cannot open -- and a kebab-only one would ignore the habit of
   * everybody who does have a right button.
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
    // Replace the browser's menu, rather than adding a second one beside it.
    event.preventDefault();
    this.openMenu(flat, event.target as HTMLElement);
  }

  /**
   * Close, and GIVE THE FOCUS BACK TO THE ROW.
   *
   * Not to the document: a menu that closes and drops the focus to the top of
   * the page makes the keyboard start over, which is how somebody ends up
   * using the mouse for everything.
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

  // ---------------------------------------------------------- virtualisation

  /**
   * The row height in pixels, which is what windowing arithmetic needs.
   *
   * WITH NO TOKEN DECLARED THERE IS NO VIRTUALISATION, rather than an invented
   * forty. Same rule as every other value this library reads at runtime: no
   * fallback number lives in TypeScript. In practice that means jsdom -- where
   * no stylesheet is loaded -- renders the ordinary table, which is also what
   * lets the component's spec count rows.
   */
  protected readonly rowPixels = computed(() =>
    readPixels(this.density() === 'sm' ? '--row-height-sm' : '--row-height-md'),
  );

  protected readonly virtualised = computed(() => this.virtual() && this.rowPixels() !== null);

  private readonly scrollTop = signal(0);
  private readonly viewportHeight = signal(0);

  /** The box the window is measured against, once the view exists. */
  private readonly scrollBox = viewChild<ElementRef<HTMLElement>>('scrollBox');

  /** Rows kept either side of the view, so a fast scroll does not show gaps. */
  private readonly overscan = 6;

  /**
   * WHICH ROWS ARE IN THE DOM, AND HOW MUCH EMPTY SPACE STANDS EITHER SIDE.
   *
   *
   * WHY THIS IS NOT `cdk-virtual-scroll-viewport`, WHICH THE COMANDA ASKED FOR
   *
   * The CDK's viewport positions its content wrapper with a transform and
   * measures the wrapper itself. Wrapping a semantic `<table>` in one moves
   * the whole table -- header included -- and the sticky header stops being
   * sticky, because it is no longer sticky to the scrolling box. The CDK's own
   * guidance is to virtualise a list of divs, which would mean giving up
   * `<table>` semantics: the header/cell relationship, the row and column
   * counts, and everything a screen reader gets from them for free. That trade
   * is the wrong way round for a table an operator lives in.
   *
   * So the window is computed here, and it is short because THE TREE IS
   * ALREADY FLAT: scroll offset over row height gives the first row, the
   * viewport height gives how many, and two spacer rows hold the scrollbar at
   * the right length. The flattening is what the comanda said would make
   * virtualisation possible without tricks, and this is that sentence cashed
   * in -- just not through the CDK.
   *
   * Reported as a deviation rather than done quietly.
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

  /** Measured once the container exists, so the first window is the right size. */
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
 * The nearest row above with a smaller level.
 *
 * Exported-shaped as a free function rather than a method so the keyboard rule
 * it serves can be read in one place: "left, on the first cell of a child, goes
 * to the parent" is one line of the WAI-ARIA table and one line here.
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

/** Which box of a filter a value came from. `text` is the whole filter. */
type FilterBound = 'text' | 'min' | 'max' | 'from' | 'to';
