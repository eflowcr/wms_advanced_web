import { InjectionToken } from '@angular/core';

// Aparte del componente: el shell provee el token en toda ruta y no debe arrastrar los chips.

/** Textos ya traducidos, provistos una vez por token (ADR 0008). */
export interface FilterChipsMessages {
  /** Nombre del × de un chip: «Quitar el filtro Estado». */
  readonly removeFilter: (column: string) => string;
  readonly clearFilters: string;
  /** La cuenta, a la vista y anunciada: «Sin filtros activos», «1 filtro activo», «3 filtros activos». */
  readonly activeCount: (count: number) => string;
}

export const EWMS_FILTER_CHIPS_MESSAGES = new InjectionToken<FilterChipsMessages>(
  'EWMS_FILTER_CHIPS_MESSAGES',
);
