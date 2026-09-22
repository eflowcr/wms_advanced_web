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

export type TableAggregate = 'sum' | 'avg' | 'count';

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

/** Números al final y en mono: las cantidades se comparan con los dígitos alineados. */
export function columnCellClasses(type: TableColumnType): string {
  switch (type) {
    case 'number':
      return 'text-end font-mono';
    case 'date':
      return 'text-start font-mono';
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

export const HEADER_CELL_CLASSES =
  'border-b border-strong bg-secondary px-3 text-caption text-secondary';

/**
 * Anillo de foco como outline, no la sombra: en borde colapsado pisa las celdas vecinas.
 * Sin la utilidad que anula el outline: en Tailwind v4 fija una variable que apaga el anillo.
 */
export const CELL_CLASSES =
  'border-b border-default px-3 align-middle text-primary ' +
  'focus-visible:outline-2 focus-visible:outline-focus';

/**
 * Seleccionada gana al tinte de estado: el estado ya lo dice el badge. Siempre con fondo: una
 * celda fijada lo hereda, y transparente dejaría ver lo que pasa por debajo al desplazar.
 */
export function rowClasses(selected: boolean, tint: string): string {
  // Un solo fondo por fila: dos utilidades de color las decide el orden de la hoja, no el atributo.
  if (selected) {
    return 'group bg-row-selected';
  }
  return tint ? `group ${tint}` : 'group bg-surface hover:bg-ghost-hover';
}
