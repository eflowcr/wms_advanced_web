import { computed, signal, type Signal } from '@angular/core';
import { readPixels } from '../tokens/read-token';
import type { TableColumn } from './column';
import { COLUMN_WIDTH, type TableDensity, type TablePin, type TableView } from './table.types';

/** El paso del teclado al redimensionar y el mínimo de una columna, por token. */
const RESIZE_STEP_TOKEN = '--col-resize-step';
const MIN_WIDTH_TOKEN = '--col-filter-min-width';

/** Dónde cae una columna movida, para anunciarlo: «Cliente, posición 2 de 5». */
export interface ColumnPosition {
  readonly position: number;
  readonly total: number;
}

/**
 * Lo que el usuario configura de las columnas —orden, ocultas, anchos— y cómo se fijan y miden.
 * Vive en memoria y sale por `(viewChange)`; nunca va al navegador. Interna. Ver vault: Tabla §14.
 */
export class TableViewState {
  private readonly hidden = signal<ReadonlySet<string>>(new Set());
  private readonly widths = signal<Readonly<Record<string, number>>>({});
  /** Claves en el orden del usuario; null es el declarado. */
  private readonly order = signal<readonly string[] | null>(null);

  /** Todas, en el orden del usuario; una columna que no estaba en él cae al final. */
  readonly orderedColumns = computed(() => {
    const order = this.order();
    if (order === null) {
      return this.columns();
    }
    const rank = (column: TableColumn): number => {
      const index = order.indexOf(column.key());
      return index < 0 ? order.length : index;
    };
    return [...this.columns()].sort((a, b) => rank(a) - rank(b));
  });

  /** Las visibles, con las fijadas al inicio y al final: el `sticky` solo pega en los bordes. */
  readonly visibleColumns = computed(() => {
    const visible = this.orderedColumns().filter((column) => !this.hidden().has(column.key()));
    const at = (pin: TablePin | null) => visible.filter((column) => column.pinned() === pin);
    return [...at('start'), ...at(null), ...at('end')];
  });

  /** Una posición a la izquierda (-1) o a la derecha (1), sin salir de su grupo de fijado. */
  move(column: TableColumn, delta: 1 | -1): ColumnPosition | null {
    const group = this.groupOf(column);
    const neighbour = group[group.indexOf(column) + delta];
    return neighbour ? this.place(column, neighbour, delta > 0 ? 'after' : 'before') : null;
  }

  /** Suelta `column` junto a `target`. Una normal no cae entre las fijadas, ni al revés. */
  place(column: TableColumn, target: TableColumn, side: 'before' | 'after'): ColumnPosition | null {
    if (column === target || column.pinned() !== target.pinned()) {
      return null;
    }
    const keys = this.orderedColumns()
      .map((candidate) => candidate.key())
      .filter((key) => key !== column.key());
    keys.splice(keys.indexOf(target.key()) + (side === 'after' ? 1 : 0), 0, column.key());
    this.order.set(keys);
    return this.positionOf(column);
  }

  /** Deshabilita Subir/Bajar en el borde de su grupo, o si está oculta. */
  canMove(column: TableColumn, delta: 1 | -1): boolean {
    const group = this.groupOf(column);
    const index = group.indexOf(column);
    return index >= 0 && group[index + delta] !== undefined;
  }

  /** Posición entre las visibles, base 1. */
  positionOf(column: TableColumn): ColumnPosition {
    const visible = this.visibleColumns();
    return { position: visible.indexOf(column) + 1, total: visible.length };
  }

  /** Las visibles con el mismo fijado: una columna se mueve dentro de ellas. */
  groupOf(column: TableColumn): readonly TableColumn[] {
    return this.visibleColumns().filter((candidate) => candidate.pinned() === column.pinned());
  }

  constructor(
    private readonly columns: Signal<readonly TableColumn[]>,
    private readonly density: Signal<TableDensity>,
    private readonly selectable: Signal<boolean>,
  ) {}

  isVisible(column: TableColumn): boolean {
    return !this.hidden().has(column.key());
  }

  /** La última visible no se oculta: una tabla sin columnas no se puede volver a configurar. */
  canHide(column: TableColumn): boolean {
    return !this.isVisible(column) || this.visibleColumns().length > 1;
  }

  toggle(column: TableColumn): void {
    if (!column.hideable() || !this.canHide(column)) {
      return;
    }
    const next = new Set(this.hidden());
    if (next.has(column.key())) {
      next.delete(column.key());
    } else {
      next.add(column.key());
    }
    this.hidden.set(next);
  }

  /** Píxeles CSS elegidos por el usuario, o null: entonces manda el token de `width`. */
  width(column: TableColumn): number | null {
    return this.widths()[column.key()] ?? null;
  }

  /** Sin token de mínimo no se achica nada: un número inventado sería una copia. */
  resize(column: TableColumn, pixels: number): void {
    const min = readPixels(MIN_WIDTH_TOKEN) ?? pixels;
    this.widths.update((current) => ({
      ...current,
      [column.key()]: Math.round(Math.max(min, pixels)),
    }));
  }

  /** Flechas del separador: un paso por token; sin token, ninguno. */
  step(column: TableColumn, current: number, direction: 1 | -1): void {
    const step = readPixels(RESIZE_STEP_TOKEN);
    if (step !== null) {
      this.resize(column, current + direction * step);
    }
  }

  /** Doble clic: vuelve al ancho del token. */
  reset(column: TableColumn): void {
    this.widths.update((current) => {
      const next = { ...current };
      delete next[column.key()];
      return next;
    });
  }

  /** Desplazamiento de cada celda fijada, medido en el DOM: depende de lo que mide cada columna. */
  private readonly pinOffsets = signal<Readonly<Record<string, number>>>({});

  /** Anchos medidos de las cabeceras: el separador los anuncia en `aria-valuenow`. */
  private readonly measuredWidths = signal<Readonly<Record<string, number>>>({});

  private readonly anyStartPin = computed(() =>
    this.visibleColumns().some((column) => column.pinned() === 'start'),
  );

  /**
   * Se fija solo si lo fijado cabe en media caja: a 390 px la casilla y una columna `md` dejaban
   * setenta píxeles para desplazar y todo control quedaba debajo de ellas.
   */
  private readonly pinning = signal(true);

  private pinOf(column: TableColumn): TablePin | null {
    return this.pinning() ? column.pinned() : null;
  }

  pinClasses(column: TableColumn, header: boolean): string {
    const pin = this.pinOf(column);
    if (pin === null) {
      return header ? 'relative' : '';
    }
    const columns = this.visibleColumns().filter((candidate) => this.pinOf(candidate) === pin);
    const edge = pin === 'start' ? columns.at(-1) === column : columns[0] === column;
    // Separador por token en el borde que da a lo que desplaza.
    const separator = edge
      ? pin === 'start'
        ? 'border-e border-e-(color:--color-border-strong)'
        : 'border-s border-s-(color:--color-border-strong)'
      : '';
    // En la cabecera las no fijadas son `relative` (por el separador) y se pintarían encima.
    return `sticky ${header ? 'z-3' : 'z-1 bg-inherit'} ${separator}`.trim();
  }

  pinStart(column: TableColumn): number | null {
    return this.pinOf(column) === 'start' ? (this.pinOffsets()[column.key()] ?? 0) : null;
  }

  pinEnd(column: TableColumn): number | null {
    return this.pinOf(column) === 'end' ? (this.pinOffsets()[column.key()] ?? 0) : null;
  }

  /** La casilla va fija si hay columnas fijadas al inicio: quedan juntas a la izquierda. */
  readonly selectionPinned = computed(
    () => this.pinning() && this.selectable() && this.anyStartPin(),
  );

  /** Mide cabeceras y caja tras un pintado: los desplazamientos dependen de lo que mide cada una. */
  measure(host: HTMLElement, box: HTMLElement | undefined): void {
    const head = host.querySelector('thead tr');
    if (!head) {
      return;
    }
    const cells = [...head.querySelectorAll<HTMLElement>('th[data-col]')];
    const width = (cell: HTMLElement | undefined): number =>
      cell?.getBoundingClientRect().width ?? 0;
    const offsets: Record<string, number> = {};
    const measured: Record<string, number> = {};
    let start = width(head.querySelector<HTMLElement>('th[data-col-select]') ?? undefined);
    for (const cell of cells) {
      const key = cell.dataset['col'] ?? '';
      measured[key] = Math.round(width(cell));
      if (cell.dataset['pin'] === 'start') {
        offsets[key] = start;
        start += width(cell);
      }
    }
    let end = 0;
    for (const cell of [...cells].reverse()) {
      if (cell.dataset['pin'] === 'end') {
        offsets[cell.dataset['col'] ?? ''] = end;
        end += width(cell);
      }
    }
    const room = box?.clientWidth ?? 0;
    const fits = start + end <= room / 2;
    if (fits !== this.pinning()) {
      this.pinning.set(fits);
    }
    // Solo si cambió: escribir lo mismo agenda otro pintado, y otra medida.
    if (JSON.stringify(offsets) !== JSON.stringify(this.pinOffsets())) {
      this.pinOffsets.set(offsets);
    }
    if (JSON.stringify(measured) !== JSON.stringify(this.measuredWidths())) {
      this.measuredWidths.set(measured);
    }
  }

  headerWidth(column: TableColumn): string | null {
    const chosen = this.width(column);
    if (chosen !== null) {
      return `${chosen}px`;
    }
    const declared = column.width();
    return declared === 'fill' ? null : COLUMN_WIDTH[declared];
  }

  widthNow(column: TableColumn): number {
    return this.width(column) ?? this.measuredWidths()[column.key()] ?? 0;
  }

  readonly minColumnWidth = readPixels(MIN_WIDTH_TOKEN);

  /** Arrastre: la captura del puntero sigue al separador aunque el cursor salga de la cabecera. */
  startResize(event: PointerEvent, column: TableColumn): void {
    const handle = event.currentTarget as HTMLElement;
    const from = event.clientX;
    const initial = handle.closest('th')?.getBoundingClientRect().width ?? this.widthNow(column);
    handle.setPointerCapture?.(event.pointerId);
    const move = (next: PointerEvent): void => this.resize(column, initial + next.clientX - from);
    const end = (): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    event.preventDefault();
  }

  onResizeKey(event: KeyboardEvent, column: TableColumn): void {
    // Con Alt es el atajo de mover columna, no un paso de ancho.
    if (!event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      this.step(column, this.widthNow(column), event.key === 'ArrowRight' ? 1 : -1);
    }
  }

  readonly view = computed<TableView>(() => ({
    order: this.orderedColumns().map((column) => column.key()),
    hidden: [...this.hidden()],
    widths: this.widths(),
    pinned: Object.fromEntries(
      this.columns()
        .filter((column) => column.pinned() !== null)
        .map((column) => [column.key(), column.pinned() as TablePin]),
    ),
    density: this.density(),
  }));
}
