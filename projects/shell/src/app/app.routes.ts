import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    // Capa pública (ADR 0012): sin cabecera ni navegación.
    path: 'login',
    loadChildren: async () => (await import('./pages/login.routes')).loginRoutes,
  },
  { path: '', loadChildren: async () => (await import('./shell.routes')).shellRoutes },
];
