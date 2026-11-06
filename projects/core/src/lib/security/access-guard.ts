import { inject } from '@angular/core';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { AccessStore } from './access-store';

export async function accessGuard(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
  const access = inject(AccessStore);
  const router = inject(Router);
  if (!access.ready()) await access.refresh();
  return (
    access.canRoute(state.url) || router.createUrlTree(['/'], { queryParams: { access: 'denied' } })
  );
}
