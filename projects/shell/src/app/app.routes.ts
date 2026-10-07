import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'login', redirectTo: '', pathMatch: 'full' },
  { path: '', loadChildren: async () => (await import('./shell.routes')).shellRoutes },
];
