import type { Provider } from '@angular/core';
import { ActiveContext, HttpActiveContext, HttpSecurityGateway } from '@ewms/core/security';

// Adaptadores del área autenticada en la demostración: el contrato propuesto, que responde el simulador.
export const AREA_PROVIDERS: readonly Provider[] = [
  { provide: ActiveContext, useExisting: HttpActiveContext },
];
export const AreaSecurityGateway = HttpSecurityGateway;
