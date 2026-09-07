import type { Routes } from '@angular/router';

/** Lazy route tree mounted by the shell at /design-system. */
export const showroomRoutes: Routes = [
  {
    path: '',
    loadComponent: async () =>
      (await import('./pages/showroom-home')).ShowroomHome,
  },
];
