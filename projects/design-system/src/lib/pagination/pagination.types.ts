import { InjectionToken } from '@angular/core';

// Aparte del componente: el shell provee el token en toda ruta y no debe arrastrar el paginador.

/** Textos ya traducidos, provistos una vez por token (ADR 0008). */
export interface PaginationMessages {
  readonly previousPage: string;
  readonly nextPage: string;
  readonly pageOf: (page: number, pages: number) => string;
  readonly rowsTotal: (total: number) => string;
}

export const EWMS_PAGINATION_MESSAGES = new InjectionToken<PaginationMessages>(
  'EWMS_PAGINATION_MESSAGES',
);
