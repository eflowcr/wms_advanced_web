import { provideEwmsLocale } from '@ewms/core/locale';
import type { Routes } from '@angular/router';
import { inject, Injector, runInInjectionContext } from '@angular/core';
import { sessionGuard } from '@ewms/core/security';

export const shellRoutes: Routes = [
  // Capa autenticada (ADR 0012): sin sesión no entra; con ella, conecta los permisos efectivos.
  {
    path: '',
    providers: [provideEwmsLocale()],
    canMatch: [
      sessionGuard,
      async () => {
        const injector = inject(Injector);
        const { startSession } = await import('./security-routing');
        await runInInjectionContext(injector, startSession);
        return true;
      },
    ],
    canActivateChild: [
      async (route, state) => {
        const injector = inject(Injector);
        const { authorizeRoute } = await import('./security-routing');
        return runInInjectionContext(injector, () => authorizeRoute(route, state));
      },
    ],
    loadComponent: async () => (await import('./layout/main-layout')).MainLayout,
    children: [
      {
        path: '',
        data: { titleKey: 'shell.menu.dashboard' },
        loadComponent: async () => (await import('./pages/home')).Home,
      },
      {
        // El showroom es una ruta interna, no Storybook.
        path: 'design-system',
        data: { titleKey: 'shell.menu.designSystem' },
        loadChildren: async () => (await import('@ewms/showroom')).showroomRoutes,
      },
      {
        path: '',
        loadChildren: async () => (await import('./operational.routes')).operationalRoutes,
      },
      {
        // Lo demás va al Dashboard: el 404 real es de DS-6, y una página vacía no tendría `h1`
        // donde poner el foco del cambio de ruta.
        path: '**',
        redirectTo: '',
      },
    ],
  },
];
