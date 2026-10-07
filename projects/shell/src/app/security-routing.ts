import { inject } from '@angular/core';
import { AccessStore, accessGuard, AuthSession, HttpSecurityGateway } from '@ewms/core/security';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { SECURITY_DEMO } from './demo-mode';

/** Con la sesión ya abierta, conecta los permisos efectivos de quien la abrió, una vez por sesión. */
export async function startSession(): Promise<void> {
  const access = inject(AccessStore);
  const info = inject(AuthSession).session();
  if (!info || access.status() !== 'idle') return;
  const actor = { userId: info.userId, warehouseId: info.warehouseId, ownerId: info.ownerId };
  await access.connect(inject(HttpSecurityGateway), actor, SECURITY_DEMO);
}

export const authorizeRoute = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) =>
  accessGuard(route, state);
