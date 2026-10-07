import type { Routes } from '@angular/router';
import { SCREEN_CATALOG } from '@ewms/core/security';

export const operationalRoutes: Routes = [
  {
    path: 'configuracion/perfiles',
    data: { titleKey: 'shell.menu.profiles' },
    loadChildren: async () => (await import('@ewms/security')).securityRoutes,
  },
  {
    path: 'configuracion/usuarios',
    data: { titleKey: 'shell.menu.users' },
    loadChildren: async () => (await import('@ewms/security')).userRoutes,
  },
  ...SCREEN_CATALOG.filter((screen) => screen.status === 'construction').map((screen) => ({
    path: screen.route.replace(/^\//, ''),
    data: { titleKey: screen.labelKey },
    loadComponent: async () => (await import('./pages/under-construction')).UnderConstruction,
  })),
];
