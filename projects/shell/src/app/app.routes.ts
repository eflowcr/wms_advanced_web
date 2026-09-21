import type { Route, Routes } from '@angular/router';
import { MENU, MENU_DESTINATIONS, BUILT_ROUTES } from './layout/menu';

/**
 * Cada destino sin pantalla, como ruta «En construcción». Derivadas del menú y no escritas a
 * mano, para que menú y router no discrepen; `titleKey` iguala pestaña, título y `h1`.
 */
const UNDER_CONSTRUCTION: Routes = MENU_DESTINATIONS.filter(
  (entry) => entry.route !== undefined && !BUILT_ROUTES.includes(entry.route),
).map<Route>((entry) => ({
  // Identificadores en español a propósito: es el vocabulario del producto
  // (`/catalogos/articulos`), el de la aplicación legacy y el del piso.
  path: entry.route!.replace(/^\//, ''),
  data: { titleKey: entry.labelKey },
  loadComponent: async () => (await import('./pages/under-construction')).UnderConstruction,
}));

/**
 * Dos capas (ADR 0012): la pública se declara vacía porque la frontera es barata ahora.
 * Sin login ni guard: no hay backend contra el que autenticar (PLN-WMS-005, Sprint 1).
 */
export const routes: Routes = [
  // Capa pública, sin shell: un login con el rail al lado no tiene adónde navegar.
  {
    path: 'login',
    // Reservada: lo que tenía que existir temprano era la capa, no la pantalla.
    redirectTo: '',
    pathMatch: 'full',
  },

  // Capa autenticada, dentro del App Shell. El guard de sesión se engancha acá, en un solo lugar.
  {
    path: '',
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
      ...UNDER_CONSTRUCTION,
      {
        // Lo demás va al Dashboard: el 404 real es de DS-6, y una página vacía no tendría `h1`
        // donde poner el foco del cambio de ruta.
        path: '**',
        redirectTo: '',
      },
    ],
  },
];

/** Reexportado para que quien lea las rutas vea de dónde sale el árbol. */
export { MENU };
