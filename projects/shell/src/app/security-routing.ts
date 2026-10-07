import { inject } from '@angular/core';
import { SessionContext } from '@ewms/core';
import { AccessStore, accessGuard } from '@ewms/core/security';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { SECURITY_DEMO } from './demo-mode';

export async function initializeDemo(): Promise<void> {
  if (!SECURITY_DEMO) return;
  const access = inject(AccessStore);
  const session = inject(SessionContext);
  if (access.status() !== 'idle') return;
  const { MemorySecurityGateway } = await import('@ewms/security');
  await access.connect(
    new MemorySecurityGateway(),
    { userId: 'admin', warehouseId: 'A', ownerId: 'X' },
    true,
  );
  const user = access.user();
  if (user) session.setUser({ name: user.name, initials: 'AA' });
  session.setWarehouse({ code: 'A', name: 'A' });
}

export const authorizeRoute = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) =>
  accessGuard(route, state);
