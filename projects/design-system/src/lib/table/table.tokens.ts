import { InjectionToken } from '@angular/core';

/**
 * TEXTOS Y FORMATOS SE PROVEEN UNA VEZ, NO POR TABLA. La librería define las
 * interfaces y los tokens y no implementa ninguno (ADR 0008); el shell los llena
 * desde `core/i18n` y el showroom pone los suyos. Una pantalla con seis tablas
 * escribiría el mismo diccionario seis veces, y la séptima distinto.
 * La raya está en la nota Nomenclatura: lo que se repite entre instancias va en
 * un token, lo que cambia en cada uso sigue siendo una entrada.
 */

/** Cada texto que la tabla puede poner en pantalla, ya traducido. */
export interface TableMessages {
  /** Nombra el filtro rápido global. */
  readonly search: string;
  /** Placeholder del filtro de texto de una columna. */
  readonly filterPlaceholder: string;
  /** Nombra las cajas «desde» y «hasta» de un filtro de rango. */
  readonly filterFrom: string;
  readonly filterTo: string;
  /** Nombra la casilla de seleccionar todo de la cabecera. */
  readonly selectAll: string;
  /** Nombra la casilla de una fila. */
  readonly selectRow: string;
  /** Nombra el toggle de expandir/plegar de una fila padre. */
  readonly expand: string;
  readonly collapse: string;
  /** Nombra el kebab que abre el menú de una fila. */
  readonly rowMenu: string;
  /** Se ve en la fila de carga mientras vienen los hijos perezosos. */
  readonly loadingChildren: string;
  /** Se ve en la fila que reemplaza a los hijos que no cargaron. */
  readonly childrenFailed: string;
  /** La acción de reintento de esa fila. */
  readonly retry: string;
  /** Se anuncia cuando una cabecera ordenable toma dirección. */
  readonly sortedAscending: string;
  readonly sortedDescending: string;
  /** El paginador. `of` recibe la página y el total de páginas. */
  readonly previousPage: string;
  readonly nextPage: string;
  readonly pageOf: (page: number, pages: number) => string;
  readonly rowsTotal: (total: number) => string;
}

/**
 * Cómo un valor crudo se vuelve texto. DOS FUNCIONES Y NO UN LOCALE: un locale
 * sería la tabla eligiendo una librería de formato, y la tabla pide la respuesta.
 * Lo que devuelven es SOLO lo que se muestra: ordenar y filtrar trabajan sobre el
 * valor crudo, por eso `[1200, 900]` ordena 900, 1200 aunque se lea «1.200».
 */
export interface TableFormatters {
  date: (value: unknown) => string;
  number: (value: unknown) => string;
}

export const EWMS_TABLE_MESSAGES = new InjectionToken<TableMessages>('EWMS_TABLE_MESSAGES');

export const EWMS_TABLE_FORMATTERS = new InjectionToken<TableFormatters>('EWMS_TABLE_FORMATTERS');

/** `YYYY-MM-DD` y nada más. Anclada, así `2026-03-15T08:00:00Z` no coincide y
 * conserva el camino que le corresponde. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Un valor de celda como `Date`, o `null` si no lo es.
 *
 * POR QUÉ EXISTE: `new Date('2026-03-15')` NO ES LA FECHA QUE PARECE. ECMAScript
 * parsea la forma de solo fecha como MEDIANOCHE UTC, así que una expedición
 * fechada ese día se dibujaba el 14 en todo huso al oeste de UTC -y correcta en
 * los demás, que es por qué sobrevivió a la revisión y a una CI que corre en UTC-.
 * Encontrado en la pantalla de ejemplo de DS-4, en America/Costa_Rica.
 * Se leen los tres números y se arma la fecha en LOCAL, que es lo que quiere decir
 * quien escribe `2026-03-15`: ese día del calendario, no un instante.
 * Vive acá porque hay DOS implementaciones del token -la del shell y la del
 * showroom- y las dos tenían el mismo defecto.
 */
export function parseTableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const text = String(value);
  const parts = DATE_ONLY.exec(text);
  if (parts !== null) {
    const [year, month, day] = [Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])];
    // El mes es base cero, y la forma de tres argumentos es local por definición.
    const parsed = new Date(year, month, day);
    /*
     * Y TIENE QUE SER EL DÍA QUE SE PIDIÓ: el constructor de tres argumentos rueda
     * sin quejarse -`2026-02-30` se vuelve el 2 de marzo-, así que un error de
     * tipeo se dibujaría como una fecha real unos días corrida. Releer las partes
     * es lo que lo convierte en `null`, que el formateador pinta como texto crudo.
     */
    const matches =
      parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day;
    return matches ? parsed : null;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
