import type { Provider } from '@angular/core';
import { ActiveContext, CoreActiveContext, CoreSecurityGateway } from '@ewms/core/security';

// Adaptadores del área autenticada fuera de la demostración: la API Go (ADR 0028). La demostración
// reemplaza este archivo por `security-adapters.enabled.ts`; así producción no carga el otro juego.
export const AREA_PROVIDERS: readonly Provider[] = [
  { provide: ActiveContext, useExisting: CoreActiveContext },
];
export const AreaSecurityGateway = CoreSecurityGateway;
