import { InjectionToken } from '@angular/core';

/**
 * Los permisos sensibles que la matriz marca. Arranca vacío: la lista la entrega el CTO
 * (comanda §7) y nunca se inventa. Ver vault: Pendientes.
 */
export const SENSITIVE_CAPABILITIES = new InjectionToken<readonly string[]>(
  'SENSITIVE_CAPABILITIES',
  { providedIn: 'root', factory: () => [] },
);
