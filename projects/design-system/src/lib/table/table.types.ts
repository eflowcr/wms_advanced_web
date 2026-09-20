import type { Observable } from 'rxjs';
import type { IconName } from '../../icons/icons.generated';
import type { SemanticFamily } from '../feedback/feedback.types';

/**
 * Cuánto vale el estado de una fila, nombrado por la FAMILIA DE COLOR: nadie dice
 * «una fila info». Son las mismas cuatro que pintan Banner y Toast.
 */
export type RowState = SemanticFamily;

/** En qué se convierte un valor de una columna `badge`. */
export interface BadgeDescriptor {
  readonly variant: RowState;
  /** Las palabras, ya traducidas (ADR 0008). */
  readonly label: string;
}

/**
 * EL DICCIONARIO CENTRAL, y por qué el tinte y la insignia no pueden discrepar:
 * un objeto mapea valor crudo a variante y etiqueta, y lo leen la columna `badge`
 * y `rowState`. Una clase por vista es cómo «Con incidencia» sale roja en una
 * pantalla y ámbar en otra.
 */
export type BadgeDictionary = Readonly<Record<string, BadgeDescriptor>>;

export type TableColumnType = 'text' | 'number' | 'date' | 'badge' | 'actions';

/**
 * El ancho de una columna, POR NOMBRE y nunca una medida CSS: es lo que evita que
 * seis tablas inventen cada una sus anchos. `fill` no es un token: es «tomá lo
 * que sobra».
 */
export type TableColumnWidth = 'sm' | 'md' | 'lg' | 'fill';

/** De dónde salen los hijos de una fila, cuando no son una propiedad. */
export type TableChildren<T> = (row: T) => readonly T[] | Observable<readonly T[]> | null;

/** Una entrada del menú contextual de una fila. */
export interface MenuItem {
  readonly id: string;
  /** Ya traducida. */
  readonly label: string;
  readonly icon?: IconName;
  /** `danger` la pinta como la respuesta destructiva. Nada más se colorea. */
  readonly tone?: 'danger';
  readonly separatorBefore?: boolean;
  readonly disabled?: boolean;
}

/** Lo que lleva `(rowActivate)`. Un objeto, para que quepa otro campo mañana. */
export interface RowActivateEvent<T> {
  readonly row: T;
}

/** Lo que lleva `(rowMenu)`. */
export interface RowMenuEvent<T> {
  readonly row: T;
  readonly item: MenuItem;
}

/** 40 px y 32 px, de los tokens. Ver `--row-height-*`. */
export type TableDensity = 'md' | 'sm';

export const ROW_HEIGHT: Readonly<Record<TableDensity, string>> = {
  md: 'var(--row-height-md)',
  sm: 'var(--row-height-sm)',
};

/** Anchos como estilo en línea: el ancho de un `<col>` es una declaración y no
 * hay espacio de tema para ella. Los tokens sacan los valores de la plantilla. */
export const COLUMN_WIDTH: Readonly<Record<Exclude<TableColumnWidth, 'fill'>, string>> = {
  sm: 'var(--col-width-sm)',
  md: 'var(--col-width-md)',
  lg: 'var(--col-width-lg)',
};

/**
 * Alineación y tipografía por tipo de columna. NÚMEROS A LA DERECHA Y MONO, y no
 * es adorno: dos cantidades solo se comparan de un vistazo con los dígitos
 * alineados. Las fechas van mono por lo mismo y al inicio porque se leen.
 */
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

/** La caja. `border-separate` NO se usa a propósito: el borde colapsado es lo que
 * deja que el tinte de una fila llegue al borde de sus celdas sin costura. */
export const TABLE_CLASSES = 'w-full border-collapse text-p';

export const HEADER_CELL_CLASSES =
  'border-b border-strong bg-secondary px-3 text-caption text-secondary';

/**
 * Una celda, INCLUIDO SU ANILLO DE FOCO, y el anillo es un outline y no la sombra
 * habitual del sistema: la sombra pinta dos bandas tres píxeles afuera, que en una
 * tabla con borde colapsado caen sobre las celdas vecinas.
 *
 * FIJARSE EN LA AUSENCIA DE `outline-none`, que todo otro control de la librería
 * acompaña a su anillo: en Tailwind v4 esa utilidad fija una variable que leen las
 * de outline posteriores, así que seguida de un outline en focus-visible resuelve
 * a ningún outline -el anillo desaparece en silencio-. Lo atrapó la caminata por
 * teclado.
 */
export const CELL_CLASSES =
  'border-b border-default px-3 align-middle text-primary ' +
  'focus-visible:outline-2 focus-visible:outline-focus';

/**
 * Una fila que se puede caminar. SELECCIONADA GANA AL TINTE DE ESTADO: el estado
 * ya se dice dos veces -el icono de la insignia y sus palabras- y la selección
 * solo la dicen el tinte y la casilla.
 */
export function rowClasses(selected: boolean, tint: string): string {
  const base = 'group';
  if (selected) {
    return `${base} bg-row-selected`;
  }
  return tint ? `${base} ${tint}` : `${base} hover:bg-ghost-hover`;
}
