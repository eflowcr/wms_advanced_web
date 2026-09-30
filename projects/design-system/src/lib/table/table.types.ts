import type { Observable } from 'rxjs';
import type { SemanticFamily } from '../feedback/feedback.types';
import type { MenuItem } from '../menu/menu.types';
import type { TableQuery } from './table-source';

/** Nombrado por familia de color, las mismas cuatro de Banner y Toast. */
export type RowState = SemanticFamily;

export interface BadgeDescriptor {
  readonly variant: RowState;
  readonly label: string;
}

/** Lo leen la columna `badge` y `rowState`: tinte e insignia no pueden discrepar. */
export type BadgeDictionary = Readonly<Record<string, BadgeDescriptor>>;

export type TableColumnType = 'text' | 'number' | 'date' | 'badge' | 'actions';

/** Por nombre, nunca una medida CSS. `fill` no es token: toma lo que sobra. */
export type TableColumnWidth = 'sm' | 'md' | 'lg' | 'fill';

/** Un tope de redimensionado: los mismos nombres del ancho, sin `fill`. */
export type TableColumnLimit = Exclude<TableColumnWidth, 'fill'>;

export type TableChildren<T> = (row: T) => readonly T[] | Observable<readonly T[]> | null;

export type { MenuItem } from '../menu/menu.types';

/** Un objeto, para que quepa otro campo mañana. */
export interface RowActivateEvent<T> {
  readonly row: T;
}

export interface RowMenuEvent<T> {
  readonly row: T;
  readonly item: MenuItem;
}

export type TableDensity = 'md' | 'sm';

export type TablePin = 'start' | 'end';

export type TableAggregate = 'sum' | 'avg' | 'count' | 'min' | 'max';

/** De qué filas es el total del pie: lo seleccionado, lo filtrado, todo o solo la página. */
export type TableTotalsScope = 'selected' | 'filtered' | 'all' | 'page';

/**
 * Lo que el usuario configuró, en memoria: sale por `(viewChange)` y no se guarda en el
 * navegador. Guardar vistas llega con backend. Anchos en píxeles CSS medidos.
 */
export interface TableView {
  /** Todas las claves, visibles u ocultas, en el orden del usuario. */
  readonly order: readonly string[];
  readonly hidden: readonly string[];
  readonly widths: Readonly<Record<string, number>>;
  readonly pinned: Readonly<Record<string, TablePin>>;
  readonly density: TableDensity;
}

export interface BulkActionEvent<T> {
  readonly item: MenuItem;
  readonly rows: readonly T[];
}

/** Con fuente remota la tabla no descarga: pasa la consulta y lo visible a quien sí puede. */
export interface ExportRequest {
  readonly query: TableQuery;
  readonly columns: readonly string[];
  readonly selectedOnly: boolean;
}

export const ROW_HEIGHT: Readonly<Record<TableDensity, string>> = {
  md: 'var(--row-height-md)',
  sm: 'var(--row-height-sm)',
};

/** Estilo en línea: el ancho de un `<col>` no tiene espacio de tema. */
export const COLUMN_WIDTH: Readonly<Record<Exclude<TableColumnWidth, 'fill'>, string>> = {
  sm: 'var(--col-width-sm)',
  md: 'var(--col-width-md)',
  lg: 'var(--col-width-lg)',
};

/**
 * Números al final y con dígitos de ancho fijo: se comparan alineados. La fuente y el peso del
 * cuerpo: en mono negrita pesaban más que el código de la fila. Ver vault: Tabla §23.
 */
export function columnCellClasses(type: TableColumnType): string {
  switch (type) {
    case 'number':
      return 'text-end tabular-nums';
    case 'date':
      return 'text-start tabular-nums';
    case 'actions':
      return 'text-end';
    default:
      return 'text-start';
  }
}

/** La cabecera sigue la alineación de su columna, o la flecha de orden cae mal. */
export function columnHeaderClasses(type: TableColumnType): string {
  return type === 'number' || type === 'actions' ? 'justify-end' : 'justify-start';
}

/**
 * Bordes separados con espacio cero, no colapsados: un borde colapsado no viaja con una celda
 * `sticky`, y el separador de una columna fijada quedaría atrás al desplazar.
 */
export const TABLE_CLASSES = 'w-full border-separate border-spacing-0 text-p';

/** Sin color de borde: la línea fuerte va entre la cabecera y el cuerpo, haya filtros o no. */
export const HEADER_CELL_CLASSES = 'border-b bg-secondary px-3 text-caption text-secondary';

/**
 * La fila de filtros pesa menos que la cabecera: fondo del lienzo, aire arriba y abajo, y la línea
 * fuerte que la separa del cuerpo. Los campos conservan su borde de control (WCAG 1.4.11).
 */
export const FILTER_CELL_CLASSES = 'border-b border-strong bg-canvas px-3 py-2';

/**
 * Anillo de foco interior: afuera lo tapaba la celda vecina, y la sombra es de la marca de
 * excepción. Sin la utilidad que anula el outline: en Tailwind v4 apaga el anillo.
 */
export const CELL_CLASSES =
  'border-b border-default px-3 align-middle text-primary ' +
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';

/** La fila de totales, fija abajo: el fondo y la línea fuerte de la cabecera, el texto del cuerpo. */
export const TOTALS_CELL_CLASSES = 'border-t border-strong bg-secondary px-3 text-primary';

/** Las dos excepciones: tiñen la fila y llevan la barra lateral. */
export type RowException = 'danger' | 'warning';

/** Lo que tiñe: las excepciones y lo completado, en verde como su badge; `neutral` no tiñe. */
export type RowTint = RowException | 'success';

/** Escritas enteras: Tailwind escanea texto y no ve una clase armada con plantilla. */
const ROW_TINT: Readonly<Record<RowTint, string>> = {
  danger: 'bg-row-danger',
  warning: 'bg-row-warning',
  success: 'bg-row-success',
};

const EXCEPTION_MARK: Readonly<Record<RowException, string>> = {
  danger: 'shadow-row-mark-danger',
  warning: 'shadow-row-mark-warning',
};

/**
 * La matriz de fila (Tabla §23). Seleccionada gana al tinte; la excepción sigue en el badge y en
 * la marca lateral. Siempre con fondo: una celda fijada lo hereda y transparente dejaría ver lo
 * que pasa por debajo. Hover y foco: un paso sobre la superficie.
 */
export function rowClasses(selected: boolean, tint: RowTint | null): string {
  // Un solo fondo por fila: dos utilidades de color las decide el orden de la hoja, no el atributo.
  if (selected) {
    return 'group bg-row-selected';
  }
  return tint
    ? `group ${ROW_TINT[tint]}`
    : 'group bg-surface hover:bg-row-hover focus-within:bg-row-hover';
}

/** La barra lateral de la excepción, en la primera celda: sobrevive a la selección. */
export function rowMarkClasses(exception: RowException | null): string {
  return exception ? EXCEPTION_MARK[exception] : '';
}
