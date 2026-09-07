import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: async () => (await import('./layout/main-layout')).MainLayout,
    children: [
      {
        path: '',
        loadComponent: async () => (await import('./pages/home')).Home,
      },
      {
        // The showroom is an internal route, not Storybook.
        path: 'design-system',
        loadChildren: async () => (await import('@ewms/showroom')).showroomRoutes,
      },
    ],
  },
];
