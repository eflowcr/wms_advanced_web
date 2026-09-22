import { InjectionToken } from '@angular/core';

// Textos y formatos se proveen una vez, no por tabla (ADR 0008): la biblioteca define los
// tokens y el shell o el showroom los llenan. Ver vault: Tabla §2.

export interface TableMessages {
  readonly search: string;
  readonly filterPlaceholder: string;
  readonly filterFrom: string;
  readonly filterTo: string;
  readonly selectAll: string;
  readonly selectRow: string;
  readonly expand: string;
  readonly collapse: string;
  readonly rowMenu: string;
  readonly loadingChildren: string;
  readonly childrenFailed: string;
  readonly retry: string;
  readonly sortedAscending: string;
  readonly sortedDescending: string;
  /** `pageOf` recibe la página y el total de páginas. */
  readonly previousPage: string;
  readonly nextPage: string;
  readonly pageOf: (page: number, pages: number) => string;
  readonly rowsTotal: (total: number) => string;

  // Barra de herramientas. Ver vault: Tabla §12.
  /** «Filtros», o «Filtros (2)» con filtros de columna activos. */
  readonly filters: (active: number) => string;
  readonly clearFilters: string;
  /** Nombre del botón × de un chip: «Quitar el filtro Estado». */
  readonly removeFilter: (column: string) => string;
  readonly density: string;
  readonly densityMd: string;
  readonly densitySm: string;

  // Filtro de conjunto de una columna `badge`.
  readonly setAll: string;
  readonly setNone: string;
  /** Texto del botón: «Estado: todos», «Estado: 2 de 4», «Estado: ninguno». */
  readonly setSummary: (column: string, chosen: number, total: number) => string;
}

/** Solo lo que se muestra: ordenar y filtrar usan el valor crudo. Ver vault: Tabla §2. */
export interface TableFormatters {
  date: (value: unknown) => string;
  number: (value: unknown) => string;
}

export const EWMS_TABLE_MESSAGES = new InjectionToken<TableMessages>('EWMS_TABLE_MESSAGES');

export const EWMS_TABLE_FORMATTERS = new InjectionToken<TableFormatters>('EWMS_TABLE_FORMATTERS');

/** Anclada: un valor con hora y zona no coincide y sigue su camino. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `new Date('2026-03-15')` es medianoche UTC y se veía el 14 al oeste de UTC; acá se arma
 * en hora local. Compartido por shell y showroom. Ver vault: Tabla §2.
 */
export function parseTableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const text = String(value);
  const parts = DATE_ONLY.exec(text);
  if (parts !== null) {
    const [year, month, day] = [Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])];
    // Mes base cero; la forma de tres argumentos es local.
    const parsed = new Date(year, month, day);
    // El constructor rueda (`2026-02-30` → 2 de marzo): releer las partes lo vuelve `null`.
    const matches =
      parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day;
    return matches ? parsed : null;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
