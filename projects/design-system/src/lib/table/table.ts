import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  output,
  signal,
  TemplateRef,
  type Signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { isObservable, of, type Observable } from 'rxjs';
import { catchError, debounceTime, switchMap, tap } from 'rxjs/operators';
import { Badge } from '../badge/badge';
import { Checkbox } from '../checkbox/checkbox';
import { familyTintClass } from '../feedback/feedback.types';
import { Icon } from '../icon/icon';
import { Input as TextInput } from '../input/input';
import { readMilliseconds } from '../tokens/read-token';
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
  imports: [Badge, Checkbox, Icon, NgTemplateOutlet, ReactiveFormsModule, TextInput],
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

  protected readonly detail = contentChild(DetailTemplate);
  protected readonly empty = contentChild(EmptyTemplate);
  protected readonly columns = contentChildren(TableColumn);

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
    const dictionary = this.columns().find((column) => column.key() === declared)?.badges() ?? {};
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

      default:
        return;
    }
  }

  /** Move the roving tab stop and take the focus with it. */
  private moveFocus(rowIndex: number, columnIndex: number): void {
    this.focusRow.set(rowIndex);
    this.focusColumn.set(columnIndex);
    queueMicrotask(() => {
      this.host.nativeElement
        .querySelector<HTMLElement>(`[data-cell="${rowIndex}-${columnIndex}"]`)
        ?.focus();
    });
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
