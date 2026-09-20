import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations, pixels } from '@ewms/testing';
import { By } from '@angular/platform-browser';
import { defer, Observable, of, Subject, throwError } from 'rxjs';
import { ArrayTableSource } from './array-table-source';
import { TableColumn } from './column';
import { DetailTemplate, EmptyTemplate, Table } from './table';
import type { TablePage, TableQuery, TableSource } from './table-source';
import {
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  type TableFormatters,
  type TableMessages,
} from './table.tokens';
import type { BadgeDictionary, MenuItem } from './table.types';

interface Row {
  readonly id: string;
  readonly codigo: string;
  readonly bultos: number;
  readonly fecha: string;
  readonly estado: string;
  readonly hijos?: readonly Row[];
}

const ESTADOS: BadgeDictionary = {
  pendiente: { variant: 'neutral', label: 'Pendiente' },
  'con-incidencia': { variant: 'danger', label: 'Con incidencia' },
};

const ROWS: readonly Row[] = [
  {
    id: '1',
    codigo: 'EXP-0001',
    bultos: 1200,
    fecha: '2026-01-15',
    estado: 'pendiente',
    hijos: [
      { id: '1a', codigo: 'SKU-1', bultos: 900, fecha: '2026-01-16', estado: 'pendiente' },
      { id: '1b', codigo: 'SKU-2', bultos: 300, fecha: '2026-01-17', estado: 'con-incidencia' },
    ],
  },
  { id: '2', codigo: 'EXP-0002', bultos: 900, fecha: '2026-02-03', estado: 'con-incidencia' },
  { id: '3', codigo: 'EXP-0003', bultos: 40, fecha: '2026-03-21', estado: 'pendiente' },
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
  previousPage: 'Anterior',
  nextPage: 'Siguiente',
  pageOf: (page, pages) => `Página ${page} de ${pages}`,
  rowsTotal: (total) => `${total} filas`,
};

/**
 * A formatter that CHANGES THE ORDER OF THE TEXT relative to the number.
 *
 * `1200` formats as `n:1200` and `900` as `n:900`, so sorting by the formatted
 * string would put `n:1200` first. That is the whole point: the spec below can
 * only tell raw-value sorting from formatted-value sorting because the two
 * disagree here.
 *
 * The prefix is a letter and not a hash: gate 10 reads a hash followed by
 * three or four digits as a raw hex colour, and a hash before 900 is one.
 * Writing it out even inside this comment failed the build once.
 */
const FORMATTERS: TableFormatters = {
  number: (value) => `n:${String(value)}`,
  date: (value) => `d:${String(value)}`,
};

@Component({
  template: `
    <ewms-table
      [source]="source()"
      [children]="withTree() ? 'hijos' : null"
      rowState="estado"
      [trackBy]="byId"
      [selectable]="selectable()"
      [quickFilter]="true"
      [density]="density()"
      ariaLabel="Expediciones"
      (rowActivate)="activated = $event.row.codigo"
      (selectionChange)="selection = $event"
      (queryChange)="lastQuery = $event"
    >
      <ewms-column key="codigo" header="Código" [sortable]="true" [filterable]="true" />
      <ewms-column
        key="bultos"
        header="Bultos"
        type="number"
        [sortable]="true"
        [filterable]="true"
      />
      <ewms-column key="fecha" header="Fecha" type="date" [filterable]="true" />
      <ewms-column key="estado" header="Estado" type="badge" [badges]="estados" />

      <ng-template ewmsEmpty>
        <p>Ninguna expedición coincide.</p>
      </ng-template>
    </ewms-table>
  `,
  imports: [Table, TableColumn, EmptyTemplate],
})
class TestHost {
  readonly estados = ESTADOS;
  readonly source = signal<TableSource<Row>>(new ArrayTableSource(ROWS, ['codigo']));
  readonly withTree = signal(true);
  readonly selectable = signal(true);
  readonly density = signal<'md' | 'sm'>('md');
  readonly byId = (row: Row): unknown => row.id;

  activated = '';
  selection: readonly Row[] = [];
  lastQuery: TableQuery | null = null;
}

/** A source whose children arrive late, or not at all. */
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
      providers: [
        { provide: EWMS_TABLE_MESSAGES, useValue: MESSAGES },
        { provide: EWMS_TABLE_FORMATTERS, useValue: FORMATTERS },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function grid(): HTMLElement {
    return fixture.nativeElement.querySelector('table') as HTMLElement;
  }

  /** The data rows. The empty-state row is not one, and is tagged so. */
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

  // ------------------------------------------------------------- structure

  describe('the grid', () => {
    it('is a treegrid when there are children, and a grid when there are not', async () => {
      expect(grid().getAttribute('role')).toBe('treegrid');

      host.withTree.set(false);
      await settle();
      // Not an input: the role is what the table turned out to be.
      expect(grid().getAttribute('role')).toBe('grid');
    });

    it('is named, and says how many rows and columns it has', () => {
      expect(grid().getAttribute('aria-label')).toBe('Expediciones');
      expect(grid().getAttribute('aria-rowcount')).toBe('3');
      // Four declared columns plus the checkbox.
      expect(grid().getAttribute('aria-colcount')).toBe('5');
    });

    it('draws one row per root while everything is collapsed', () => {
      expect(bodyRows().length).toBe(3);
    });

    it('shows the projected empty state when nothing matches', async () => {
      const search = fixture.nativeElement.querySelector(
        '[data-quick-filter] input',
      ) as HTMLInputElement;
      search.value = 'no-existe';
      search.dispatchEvent(new Event('input'));
      await settle();

      expect(emptyRow()?.textContent).toContain('Ninguna expedición coincide');
      expect(bodyRows().length).toBe(0);
    });
  });

  // ------------------------------------------------------------------ tree

  describe('the tree', () => {
    function toggle(rowIndex: number): void {
      (
        fixture.nativeElement.querySelector(`[data-toggle="${rowIndex}"]`) as HTMLButtonElement
      )?.click();
    }

    it('draws a toggle only on a row that has children', () => {
      expect(fixture.nativeElement.querySelector('[data-toggle="0"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-toggle="1"]')).toBeNull();
    });

    it('expands into the SAME loop, one level deeper', async () => {
      toggle(0);
      await settle();

      expect(bodyRows().length).toBe(5);
      expect(bodyRows()[0]?.getAttribute('aria-expanded')).toBe('true');
      expect(bodyRows()[1]?.getAttribute('aria-level')).toBe('2');
      expect(bodyRows()[1]?.classList.contains('is-child')).toBe(true);
      // No nested table anywhere.
      expect(fixture.nativeElement.querySelectorAll('table').length).toBe(1);
    });

    it('says where each row sits among its siblings', async () => {
      toggle(0);
      await settle();
      expect(bodyRows()[1]?.getAttribute('aria-setsize')).toBe('2');
      expect(bodyRows()[1]?.getAttribute('aria-posinset')).toBe('1');
      expect(bodyRows()[3]?.getAttribute('aria-setsize')).toBe('3');
    });

    it('collapses again, and the children leave the DOM', async () => {
      toggle(0);
      await settle();
      toggle(0);
      await settle();
      expect(bodyRows().length).toBe(3);
    });
  });

  // --------------------------------------------------------------- columns

  describe('the columns', () => {
    it('formats what it shows, and only what it shows', () => {
      expect(textOf(0)).toContain('n:1200');
      expect(textOf(0)).toContain('d:2026-01-15');
    });

    it('draws a badge from the dictionary, with words and an icon', () => {
      const badge = bodyRows()[1]?.querySelector('ewms-badge');
      expect(badge?.textContent).toContain('Con incidencia');
      expect(badge?.querySelector('svg')).not.toBeNull();
    });

    it('tints the row from THE SAME dictionary', () => {
      // `rowState="estado"` reads the badges of the column whose key is
      // `estado`, so the two cannot disagree.
      expect(bodyRows()[1]?.className).toContain('bg-danger-surface');
      expect(bodyRows()[0]?.className).toContain('bg-neutral-surface');
    });

    it('aligns numbers to the end, in mono', () => {
      const numberCell = cellsOf(0)[2];
      expect(numberCell?.className).toContain('text-end');
      expect(numberCell?.className).toContain('font-mono');
    });
  });

  // ------------------------------------------------------------------ sort

  describe('sorting', () => {
    function header(key: string): HTMLButtonElement {
      return fixture.nativeElement.querySelector(`[data-sort="${key}"]`) as HTMLButtonElement;
    }

    function ariaSortOf(key: string): string | null {
      return header(key).closest('th')?.getAttribute('aria-sort') ?? null;
    }

    it('SORTS BY THE RAW VALUE, not by the formatted text', async () => {
      /*
       * The formatter prefixes both numbers, so as STRINGS they sort the
       * other way round from the numbers themselves. This is the assertion
       * the whole formatter/token split exists for.
       */
      header('bultos').click();
      await settle();

      expect(bodyRows().map((row) => row.textContent?.match(/n:\d+/)?.[0])).toEqual([
        'n:40',
        'n:900',
        'n:1200',
      ]);
    });

    it('goes ascending, descending, then back to none', async () => {
      expect(ariaSortOf('bultos')).toBeNull();

      header('bultos').click();
      await settle();
      expect(ariaSortOf('bultos')).toBe('ascending');

      header('bultos').click();
      await settle();
      expect(ariaSortOf('bultos')).toBe('descending');

      // The third press is what gets somebody back to the order the source
      // returned.
      header('bultos').click();
      await settle();
      expect(ariaSortOf('bultos')).toBeNull();
    });

    it('marks only the sorted column, never the others', async () => {
      header('bultos').click();
      await settle();
      expect(ariaSortOf('codigo')).toBeNull();
    });
  });

  // --------------------------------------------------------------- filters

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

    it('THE SHAPE COMES FROM THE COLUMN TYPE: one box for text, two for a range', () => {
      expect(boxes('codigo').length).toBe(1);
      expect(boxes('bultos').length).toBe(2);
      expect(boxes('fecha').length).toBe(2);
    });

    it('filters text by substring', async () => {
      type(boxes('codigo')[0]!, '0002');
      await settle();
      expect(bodyRows().length).toBe(1);
      expect(textOf(0)).toContain('EXP-0002');
    });

    it('filters a number range on both bounds', async () => {
      const [min, max] = boxes('bultos');
      type(min!, '100');
      type(max!, '1000');
      await settle();
      expect(bodyRows().length).toBe(1);
      expect(textOf(0)).toContain('EXP-0002');
    });

    it('A CLEARED BOX IS UNBOUNDED, NOT ZERO', async () => {
      const [min, max] = boxes('bultos');
      type(max!, '1000');
      await settle();
      expect(bodyRows().length).toBe(2);

      type(min!, '950');
      await settle();
      expect(bodyRows().length).toBe(0);

      // Clearing the min must bring back the rows below it, not pin it to 0.
      type(min!, '');
      await settle();
      expect(bodyRows().length).toBe(2);
    });

    it('filters a date range', async () => {
      const [from, to] = boxes('fecha');
      type(from!, '2026-02-01');
      type(to!, '2026-02-28');
      await settle();
      expect(bodyRows().length).toBe(1);
      expect(textOf(0)).toContain('EXP-0002');
    });

    it('sends the whole query out, which is what a saved view will persist', async () => {
      type(boxes('codigo')[0]!, '0002');
      await settle();
      expect(host.lastQuery?.filters).toEqual({ codigo: '0002' });
      expect(host.lastQuery?.page).toBe(0);
    });

    it('keeps the filter boxes across change detection', async () => {
      // A control rebuilt on every pass would wipe what somebody is typing.
      const box = boxes('codigo')[0]!;
      type(box, 'EXP');
      await settle();
      expect(boxes('codigo')[0]?.value).toBe('EXP');
    });
  });

  // ------------------------------------------------------------- selection

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

    function tick(box: HTMLInputElement): void {
      box.checked = !box.checked;
      box.dispatchEvent(new Event('change'));
    }

    it('emits the chosen rows', async () => {
      tick(checkboxes()[1]!);
      await settle();
      expect(host.selection.map((row) => row.codigo)).toEqual(['EXP-0002']);
      expect(bodyRows()[1]?.getAttribute('aria-selected')).toBe('true');
    });

    it('SELECTED WINS OVER THE STATE TINT', async () => {
      tick(checkboxes()[1]!);
      await settle();
      // The state is already said twice -- badge icon and badge words -- while
      // the selection is said by the tint and the box alone.
      expect(bodyRows()[1]?.className).toContain('bg-row-selected');
      expect(bodyRows()[1]?.className).not.toContain('bg-danger-surface');
    });

    it('the header box ticks what is on screen, and goes mixed in between', async () => {
      tick(checkboxes()[0]!);
      await settle();
      expect(selectAll().getAttribute('aria-checked')).toBe('mixed');

      selectAll().checked = true;
      selectAll().dispatchEvent(new Event('change'));
      await settle();
      expect(host.selection.length).toBe(3);

      selectAll().dispatchEvent(new Event('change'));
      await settle();
      expect(host.selection.length).toBe(0);
    });

    it('is not rendered at all when the table is not selectable', async () => {
      host.selectable.set(false);
      await settle();
      expect(fixture.nativeElement.querySelector('tbody input[type="checkbox"]')).toBeNull();
      expect(bodyRows()[0]?.getAttribute('aria-selected')).toBeNull();
    });
  });

  // -------------------------------------------------------------- keyboard

  describe('the keyboard', () => {
    function press(rowIndex: number, columnIndex: number, key: string, ctrlKey = false): void {
      const cell = fixture.nativeElement.querySelector(
        `[data-cell="${rowIndex}-${columnIndex}"]`,
      ) as HTMLElement;
      cell.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true }));
    }

    function tabbable(): string[] {
      return [...fixture.nativeElement.querySelectorAll('td[tabindex="0"]')].map(
        (cell) => (cell as HTMLElement).dataset['cell'] ?? '',
      );
    }

    it('is ONE tab stop for the whole table', () => {
      expect(tabbable()).toEqual(['0-0']);
    });

    it('moves down and up a column', async () => {
      press(0, 1, 'ArrowDown');
      await settle();
      expect(tabbable()).toEqual(['1-0']);
    });

    it('ARROW RIGHT EXPANDS A PARENT before it moves between cells', async () => {
      press(0, 0, 'ArrowRight');
      await settle();
      expect(bodyRows().length).toBe(5);

      // Already expanded: now it moves.
      press(0, 0, 'ArrowRight');
      await settle();
      expect(tabbable()).toEqual(['0-1']);
    });

    it('arrow left collapses, and from a child it goes to the parent', async () => {
      press(0, 0, 'ArrowRight');
      await settle();

      press(1, 0, 'ArrowLeft');
      await settle();
      // The child's first cell: up to the parent row rather than sideways.
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

    it('Enter activates the row, and so does a double click', async () => {
      press(1, 0, 'Enter');
      await settle();
      expect(host.activated).toBe('EXP-0002');

      host.activated = '';
      bodyRows()[2]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      // Two ways in, one action.
      expect(host.activated).toBe('EXP-0003');
    });

    it('Space ticks the row, and stops the page scrolling', async () => {
      const cell = fixture.nativeElement.querySelector('[data-cell="1-0"]') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      cell.dispatchEvent(event);
      await settle();

      expect(host.selection.map((row) => row.codigo)).toEqual(['EXP-0002']);
      expect(event.defaultPrevented).toBe(true);
    });

    it('stops at the ends instead of wrapping', async () => {
      press(0, 0, 'ArrowUp');
      await settle();
      expect(tabbable()).toEqual(['0-0']);
    });
  });

  // --------------------------------------------------------------- density

  describe('density', () => {
    it('takes its height from a token, per density', async () => {
      expect(bodyRows()[0]?.style.height).toBe('var(--row-height-md)');

      host.density.set('sm');
      await settle();
      expect(bodyRows()[0]?.style.height).toBe('var(--row-height-sm)');
    });
  });

  // ---------------------------------------------------------------- errors

  describe('a source that misbehaves', () => {
    it('shows the empty state rather than breaking when a page comes back empty', async () => {
      host.source.set({ load: () => of({ rows: [], page: 0, pageSize: 50, total: 0 }) });
      await settle();
      expect(fixture.nativeElement.textContent).toContain('Ninguna expedición coincide');
    });

    it('keeps working when the source has no total to report', async () => {
      host.source.set(new LazySource());
      await settle();
      expect(bodyRows().length).toBe(3);
    });
  });

  it('has no axe violations, expanded and with a selection', async () => {
    (fixture.nativeElement.querySelector('[data-toggle="0"]') as HTMLButtonElement).click();
    await settle();
    const box = fixture.nativeElement.querySelector(
      'tbody input[type="checkbox"]',
    ) as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await settle();

    await expectNoAxeViolations(fixture.nativeElement);
  });
});

/** A source that fails, to prove the table does not take the page with it. */
describe('Table with a failing source', () => {
  it('survives a source that errors, and can load again afterwards', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost, Table, TableColumn, EmptyTemplate],
      providers: [
        { provide: EWMS_TABLE_MESSAGES, useValue: MESSAGES },
        { provide: EWMS_TABLE_FORMATTERS, useValue: FORMATTERS },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.source.set({
      load: () => throwError(() => new Error('boom')),
    });
    fixture.detectChanges();
    await fixture.whenStable();

    // The empty state, not a crash and not a dead component.
    expect(fixture.nativeElement.querySelector('[data-empty-row]')).not.toBeNull();

    /*
     * And the pipeline is still alive: an error escaping the switchMap would
     * have killed the outer subscription, and the table would never load again
     * -- not on a new filter, not on a new page, with nothing on screen to say
     * why.
     */
    fixture.componentInstance.source.set(new ArrayTableSource(ROWS, ['codigo']));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('tbody tr:not([data-empty-row])').length).toBe(3);
  });
});

/**
 * Children that arrive late, or not at all.
 *
 * `[children]` returning an Observable is part of the type contract, not an
 * extra: a shipment with hundreds of lines must not bring them with the list.
 */
describe('Table with lazy children', () => {
  interface Lazy {
    readonly id: string;
    readonly codigo: string;
  }

  const ROOTS: readonly Lazy[] = [{ id: 'r1', codigo: 'EXP-1' }];
  const KIDS: readonly Lazy[] = [
    { id: 'k1', codigo: 'SKU-1' },
    { id: 'k2', codigo: 'SKU-2' },
  ];

  @Component({
    template: `
      <ewms-table [source]="source" [children]="children" [trackBy]="byId" ariaLabel="Perezosa">
        <ewms-column key="codigo" header="Código" />
      </ewms-table>
    `,
    imports: [Table, TableColumn],
  })
  class LazyHost {
    readonly source = new ArrayTableSource(ROOTS);
    readonly byId = (row: Lazy): unknown => row.id;
    /** Handed to the test, so it decides when and whether the children land. */
    pending = new Subject<readonly Lazy[]>();
    /**
     * How many times the children were actually FETCHED.
     *
     * Counted on subscription and not on the call, because the table calls the
     * resolver on every render to ask whether a row has children at all -- a
     * counter on the call would measure change detection, not network traffic.
     */
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
      providers: [
        { provide: EWMS_TABLE_MESSAGES, useValue: MESSAGES },
        { provide: EWMS_TABLE_FORMATTERS, useValue: FORMATTERS },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LazyHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function toggle(): void {
    (fixture.nativeElement.querySelector('[data-toggle="0"]') as HTMLButtonElement).click();
  }

  it('draws the toggle before any child exists', () => {
    // Returning an Observable IS the statement that there are children. Waiting
    // for them to arrive before drawing the toggle would mean nobody could ever
    // ask for them.
    expect(fixture.nativeElement.querySelector('[data-toggle="0"]')).not.toBeNull();
  });

  it('shows a busy row while they are on their way', async () => {
    toggle();
    await settle();

    const loading = fixture.nativeElement.querySelector('[data-loading="0"]');
    expect(loading).not.toBeNull();
    expect(loading?.getAttribute('aria-busy')).toBe('true');
    expect(loading?.textContent).toContain('Cargando…');
  });

  it('replaces the busy row with the children when they land', async () => {
    toggle();
    await settle();

    host.pending.next(KIDS);
    host.pending.complete();
    await settle();

    expect(fixture.nativeElement.querySelector('[data-loading="0"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('tbody tr:not([data-empty-row])').length).toBe(3);
  });

  it('asks only ONCE, however often the row is opened', async () => {
    toggle();
    await settle();
    host.pending.next(KIDS);
    host.pending.complete();
    await settle();

    toggle();
    await settle();
    toggle();
    await settle();

    // Re-fetching on every expand is how a table that felt fast becomes one
    // that hits the network whenever somebody browses back up.
    expect(host.subscriptions).toBe(1);
  });

  it('shows the failure in line, with a retry, and keeps the row expanded', async () => {
    toggle();
    await settle();

    host.pending.error(new Error('boom'));
    await settle();

    const failed = fixture.nativeElement.querySelector('[data-failed="0"]');
    expect(failed?.textContent).toContain('No se pudo cargar');
    expect(fixture.nativeElement.querySelector('[data-retry="0"]')).not.toBeNull();
    // Collapsing on failure would hide the only thing saying anything is wrong.
    expect(fixture.nativeElement.querySelector('tbody tr')?.getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('takes the failure away when the row is folded back up', async () => {
    toggle();
    await settle();
    host.pending.error(new Error('boom'));
    await settle();
    expect(fixture.nativeElement.querySelector('[data-failed="0"]')).not.toBeNull();

    toggle();
    await settle();

    // The failure is REMEMBERED -- the retry below still works -- but a red
    // row with a retry button hanging under a parent drawn collapsed is a
    // state nobody asked for. What the set remembers is what happened to the
    // children; whether it is on screen is the parent's business.
    expect(fixture.nativeElement.querySelector('[data-failed="0"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-loading="0"]')).toBeNull();
  });

  it('retries, and the second attempt can succeed', async () => {
    toggle();
    await settle();
    host.pending.error(new Error('boom'));
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

/** Paging, over a source that reports a total. */
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

  it('asks for one page at a time, and can be moved between them', async () => {
    await TestBed.configureTestingModule({
      imports: [PagedHost, Table, TableColumn],
      providers: [
        { provide: EWMS_TABLE_MESSAGES, useValue: MESSAGES },
        { provide: EWMS_TABLE_FORMATTERS, useValue: FORMATTERS },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PagedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = (): number =>
      fixture.nativeElement.querySelectorAll('tbody tr:not([data-empty-row])').length;
    expect(rows()).toBe(3);

    const table = fixture.debugElement.query(By.directive(Table)).componentInstance as {
      goToPage(page: number): void;
      pageCount(): number | null;
    };

    expect(table.pageCount()).toBe(3);

    table.goToPage(2);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows()).toBe(1);

    // Out of range in both directions is clamped rather than obeyed: a page
    // number nobody can reach is a screen with nothing on it and no way back.
    table.goToPage(99);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows()).toBe(1);

    table.goToPage(-5);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows()).toBe(3);
  });

  it('has no page count when the source declines to total', async () => {
    await TestBed.configureTestingModule({
      imports: [PagedHost, Table, TableColumn],
      providers: [
        { provide: EWMS_TABLE_MESSAGES, useValue: MESSAGES },
        { provide: EWMS_TABLE_FORMATTERS, useValue: FORMATTERS },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PagedHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const table = fixture.debugElement.query(By.directive(Table)).componentInstance as {
      page: { set(value: TablePage<Small>): void };
      pageCount(): number | null;
      goToPage(page: number): void;
    };
    table.page.set({ rows: MANY.slice(0, 3), page: 0, pageSize: 3, total: null });
    fixture.detectChanges();

    // No total, no paginator: a paginator with no last page is a control that
    // lies about how far it can go.
    expect(table.pageCount()).toBeNull();
    table.goToPage(2);
    expect(table.pageCount()).toBeNull();
  });
});

// ------------------------------------------------------------ master/detail

const MENU: readonly MenuItem[] = [
  { id: 'ver', label: 'Ver detalle' },
  { id: 'imprimir', label: 'Imprimir', disabled: true },
  { id: 'duplicar', label: 'Duplicar' },
  { id: 'anular', label: 'Anular', tone: 'danger', separatorBefore: true },
];

@Component({
  template: `
    <ewms-table
      [source]="source"
      [trackBy]="byId"
      [isRowMaster]="isMaster"
      [menuItems]="menu()"
      ariaLabel="Expediciones"
      (rowMenu)="chosen = $event.item.id + ':' + $event.row.codigo"
    >
      <ewms-column key="codigo" header="Código" />
      <ewms-column key="bultos" header="Bultos" type="number" />
      <ewms-column key="acciones" header="Acciones" type="actions" />

      <!--
        codigoOf rather than row.codigo: ewmsDetail types the template variable
        as unknown, because a directive used as a bare attribute has no input
        for the compiler to infer the row type from. Reported as a gap in the
        ergonomics rather than worked around in the library.
      -->
      <ng-template ewmsDetail let-row>
        <p data-detail-body>Detalle de {{ codigoOf(row) }}</p>
      </ng-template>
    </ewms-table>
  `,
  imports: [Table, TableColumn, DetailTemplate],
})
class DetailHost {
  readonly source = new ArrayTableSource<Row>(ROWS, ['codigo']);
  readonly byId = (row: Row): unknown => row.id;
  /** The two big expediciones have something to unfold; the small one has not. */
  readonly isMaster = (row: Row): boolean => row.bultos > 100;
  readonly menu = signal<readonly MenuItem[]>(MENU);

  readonly codigoOf = (row: unknown): string => (row as Row).codigo;

  chosen = '';
}

describe('Table master/detail', () => {
  let fixture: ComponentFixture<DetailHost>;
  let host: DetailHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailHost, Table, TableColumn, DetailTemplate],
      providers: [
        { provide: EWMS_TABLE_MESSAGES, useValue: MESSAGES },
        { provide: EWMS_TABLE_FORMATTERS, useValue: FORMATTERS },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DetailHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function toggle(rowIndex: number): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(`[data-detail-toggle="${rowIndex}"] button`);
  }

  function panels(): HTMLElement[] {
    return [...fixture.nativeElement.querySelectorAll('[data-detail]')] as HTMLElement[];
  }

  it('offers the panel only on the rows that have one', () => {
    expect(toggle(0)).not.toBeNull();
    expect(toggle(1)).not.toBeNull();
    // `isRowMaster` said no, so there is no control at all -- not a disabled
    // one, which would promise something the row cannot do.
    expect(toggle(2)).toBeNull();
  });

  it('unfolds one cell spanning the whole table, with the projected panel', async () => {
    toggle(0)?.click();
    await settle();

    expect(panels().length).toBe(1);
    const cell = panels()[0]?.querySelector('td') as HTMLTableCellElement;
    // Three columns and no checkbox: the panel is not the columns again.
    expect(cell.getAttribute('colspan')).toBe('3');
    expect(cell.textContent).toContain('Detalle de EXP-0001');
  });

  it('gives the panel the row it belongs to, not the first one', async () => {
    toggle(1)?.click();
    await settle();
    expect(fixture.nativeElement.querySelector('[data-detail-body]')?.textContent).toContain(
      'EXP-0002',
    );
  });

  it('says on the BUTTON that it is open, and what it opened', async () => {
    const button = toggle(0) as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBeNull();

    button.click();
    await settle();

    // On the button, never on the `ewms-icon-button` wrapper: the wrapper has
    // no role and is not the thing anybody presses, so state written there is
    // state announced nowhere.
    const opened = toggle(0) as HTMLButtonElement;
    expect(opened.getAttribute('aria-expanded')).toBe('true');
    const cell = panels()[0]?.querySelector('td') as HTMLElement;
    expect(opened.getAttribute('aria-controls')).toBe(cell.id);
  });

  it('opens as many panels as somebody asks for, and folds each back alone', async () => {
    toggle(0)?.click();
    await settle();
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

  it('adds rows to the DOM without pretending the table grew', async () => {
    // The panel is a row in the DOM and NOT a row of the table: counting it
    // would make three expediciones read as four the moment somebody opened
    // one.
    toggle(0)?.click();
    await settle();
    const table = fixture.nativeElement.querySelector('table') as HTMLElement;
    expect(table.getAttribute('aria-rowcount')).toBe('3');
  });

  it('has no axe violations with a panel open', async () => {
    toggle(0)?.click();
    await settle();
    await expectNoAxeViolations(fixture.nativeElement);
  });

  // ---------------------------------------------------------- the row menu

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

  it('survives the auxclick that follows its own right click', async () => {
    /*
     * A right click is a burst of events, and the browsers do not agree on
     * its order: Chromium on X11 -- which is what CI runs -- sends
     * `contextmenu` on the press and `auxclick` on the release, while on
     * Windows `auxclick` comes first and `contextmenu` last. CDK's
     * outside-pointer stream listens to both on the body, so on X11 the
     * `auxclick` of the very same click reaches a menu that already exists
     * and counts as a click outside it.
     *
     * This is the X11 order, replayed by hand. It cost nine red tests on the
     * first CI run of the suite and nothing at all on a developer machine.
     */
    rowOf(1).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await settle();
    expect(menu()).not.toBeNull();

    rowOf(1).dispatchEvent(
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 }),
    );
    await settle();
    expect(menu(), 'the menu closed itself on the tail of its own click').not.toBeNull();
  });

  it('still closes on a pointer gesture that is not the one that opened it', async () => {
    // The guard above must not turn into "never closes". A press outside is a
    // new gesture, and a new gesture closes the menu.
    kebab(0)?.click();
    await settle();
    expect(menu()).not.toBeNull();

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
    // The browser's own menu is left alone: a row with no actions has no
    // reason to take copy and paste away.
    expect(event.defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
  });

  it('takes the focus itself, and points at the active entry', async () => {
    kebab(0)?.click();
    await settle();
    await Promise.resolve();
    expect(document.activeElement).toBe(menu());
    expect(menu()?.getAttribute('aria-activedescendant')).toBeNull();

    press('ArrowDown');
    await settle();
    expect(menu()?.getAttribute('aria-activedescendant')).toBe(entries()[0]?.id);
  });

  it('walks past what cannot be chosen', async () => {
    kebab(0)?.click();
    await settle();
    press('ArrowDown');
    press('ArrowDown');
    await settle();
    // Imprimir is disabled, so the second press lands on Duplicar.
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
  });

  it('emits on a click, too', async () => {
    kebab(0)?.click();
    await settle();
    entries()[3]?.click();
    await settle();
    expect(host.chosen).toBe('anular:EXP-0001');
  });

  it('emits nothing for a disabled entry, however it is pressed', async () => {
    kebab(0)?.click();
    await settle();
    entries()[1]?.click();
    await settle();
    expect(host.chosen).toBe('');
    // Still open: a press that does nothing must not also look like a choice.
    expect(menu()).not.toBeNull();
  });

  it('gives the focus back to the row on Escape', async () => {
    kebab(0)?.click();
    await settle();
    press('Escape');
    await settle();
    await Promise.resolve();

    expect(menu()).toBeNull();
    // Back to the cell, not to the top of the document: a menu that drops the
    // focus makes the keyboard start the table over.
    expect((document.activeElement as HTMLElement).dataset['cell']).toBe('0-0');
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

    // The overlay lives in the body. Without a hook on destroy it would still
    // be floating there over whatever screen came next.
    fixture.destroy();
    expect(menu()).toBeNull();
  });

  it('has no axe violations with the menu open', async () => {
    kebab(0)?.click();
    await settle();
    await expectNoAxeViolations(document.querySelector('.cdk-overlay-container') as Element);
  });
});

// --------------------------------------------------------- virtualisation

interface Big {
  readonly id: number;
  readonly codigo: string;
}

function bigRows(count: number): readonly Big[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: index,
    codigo: `EXP-${String(index).padStart(5, '0')}`,
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
      <ewms-column key="codigo" header="Código" />
    </ewms-table>
  `,
  imports: [Table, TableColumn],
})
class HugeHost {
  readonly source = signal<TableSource<Big>>(new ArrayTableSource(HUGE, ['codigo']));
  readonly byId = (row: Big): unknown => row.id;
}

/** The row height, which is the only thing windowing needs as a number. */
const ROW_HEIGHT_TOKEN = '--row-height-md';

/** What the token is stubbed to. A number, because that is what windowing is. */
const ROW_PIXELS = 40;

async function hugeFixture(rows: readonly Big[]): Promise<ComponentFixture<HugeHost>> {
  await TestBed.configureTestingModule({
    imports: [HugeHost, Table, TableColumn],
    providers: [
      { provide: EWMS_TABLE_MESSAGES, useValue: MESSAGES },
      { provide: EWMS_TABLE_FORMATTERS, useValue: FORMATTERS },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(HugeHost);
  // Before the first render: whether the window is on decides whether this is
  // a dozen rows in the DOM or every one of them.
  fixture.componentInstance.source.set(new ArrayTableSource(rows, ['codigo']));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('Table virtualisation', () => {
  let fixture: ComponentFixture<HugeHost>;

  beforeEach(async () => {
    // The row height comes from the stylesheet, which no unit test loads. It
    // is declared here because WITHOUT IT THERE IS NO VIRTUALISATION -- the
    // component refuses to invent a number -- which the block below is about.
    document.documentElement.style.setProperty(ROW_HEIGHT_TOKEN, pixels(ROW_PIXELS));
    fixture = await hugeFixture(HUGE);
  });

  afterEach(() => {
    document.documentElement.style.removeProperty(ROW_HEIGHT_TOKEN);
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

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

  /**
   * jsdom has no layout, so the box is told how tall it is and where it is.
   *
   * `scrollTop` is a real accessor and not a fixed value: the table WRITES to
   * it when the keyboard walks to a row outside the window, and a read-only
   * stub would turn that into a crash rather than a scroll.
   */
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
    // The count is the TABLE's, not the window's: a screen reader saying
    // "row 1 of 12" in a table of five thousand is worse than saying nothing.
    const table = fixture.nativeElement.querySelector('table') as HTMLElement;
    expect(table.getAttribute('aria-rowcount')).toBe('5000');
    expect(drawn().length).toBeGreaterThan(0);
    expect(drawn().length).toBeLessThan(60);
  });

  it('holds the scrollbar at the length of the whole table', () => {
    // Every row that is not drawn is still there as height, or the scrollbar
    // would claim the table is a dozen rows long.
    expect(spacerHeight('before') + drawn().length * ROW_PIXELS + spacerHeight('after')).toBe(
      5000 * ROW_PIXELS,
    );
  });

  it('moves the window when the box is scrolled, keeping the absolute index', async () => {
    scrollTo(4000, 400);
    await settle();

    // Four thousand pixels is row one hundred, less six of overscan.
    const first = drawn()[0] as HTMLElement;
    expect(first.dataset['row']).toBe('94');
    expect(first.getAttribute('aria-rowindex')).toBe('95');
    expect(first.textContent).toContain('EXP-00094');
    expect(spacerHeight('before')).toBe(94 * ROW_PIXELS);

    // Ten rows in view, plus six of overscan either side.
    expect(drawn().length).toBe(22);
  });

  it('never draws past the last row', async () => {
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

    // Ctrl+End goes to the last row, which is nowhere near the window. Moving
    // the focus to a row that is not in the DOM would silently do nothing.
    expect(drawn().some((row) => row.dataset['row'] === '4999')).toBe(true);
  });
});

describe('Table with no row height declared', () => {
  it('draws every row rather than inventing a height', async () => {
    document.documentElement.style.removeProperty(ROW_HEIGHT_TOKEN);

    const fixture = await hugeFixture(bigRows(20));

    // `[virtual]` is on, and it still draws all twenty with no spacers: a
    // windowed table built on a guessed forty is a table scrolled off its own
    // rows the day the token moves.
    expect(fixture.nativeElement.querySelectorAll('[data-row]').length).toBe(20);
    expect(fixture.nativeElement.querySelector('[data-spacer]')).toBeNull();
  });
});
