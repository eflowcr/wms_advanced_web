import { InjectionToken } from '@angular/core';

// Aparte del componente: el shell provee el token en toda ruta y no debe arrastrar la barra.

/** Textos ya traducidos, provistos una vez por token (ADR 0008). */
export interface FilterBarMessages {
  /** «Más filtros», o «Más filtros (2)» con filtros activos escondidos. */
  readonly moreFilters: (active: number) => string;
  readonly fewerFilters: string;
}

export const EWMS_FILTER_BAR_MESSAGES = new InjectionToken<FilterBarMessages>(
  'EWMS_FILTER_BAR_MESSAGES',
);
