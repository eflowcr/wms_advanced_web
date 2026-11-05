import type { Provider } from '@angular/core';
import { ActiveContext, CoreActiveContext, CoreSecurityGateway } from '@ewms/core/security';

// Adaptadores del área autenticada: la API Go (ADR 0028), en desarrollo y producción. Solo el
// artefacto sintético de las E2E lo cambia por `security-adapters.enabled.ts` (ADR 0022).
export const AREA_PROVIDERS: readonly Provider[] = [
  { provide: ActiveContext, useExisting: CoreActiveContext },
];
export const AreaSecurityGateway = CoreSecurityGateway;
