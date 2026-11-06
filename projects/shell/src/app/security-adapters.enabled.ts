import type { Provider } from '@angular/core';
import { ActiveContext, HttpActiveContext, HttpSecurityGateway } from '@ewms/core/security';

// Adaptadores del artefacto sintético de las E2E: el contrato propuesto, que responde el simulador.
export const AREA_PROVIDERS: readonly Provider[] = [
  { provide: ActiveContext, useExisting: HttpActiveContext },
];
export const AreaSecurityGateway = HttpSecurityGateway;
