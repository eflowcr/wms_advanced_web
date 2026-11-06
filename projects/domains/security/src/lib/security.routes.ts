import type { CanDeactivateFn, Routes } from '@angular/router';
import { accessGuard } from '@ewms/core/security';
const unsavedGuard: CanDeactivateFn<{ canLeave(): Promise<boolean> }> = (page) => page.canLeave();
export const securityRoutes: Routes = [
  {
    path: '',
    canActivate: [accessGuard],
    canDeactivate: [unsavedGuard],
    loadComponent: async () => (await import('./security-page')).SecurityPage,
  },
];
export const userRoutes: Routes = [
  {
    path: '',
    canActivate: [accessGuard],
    canDeactivate: [unsavedGuard],
    loadComponent: async () => (await import('./users-page')).UsersPage,
  },
];
