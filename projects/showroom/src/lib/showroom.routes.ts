import { inject } from '@angular/core';
import type { Route, Routes } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { map, type Observable } from 'rxjs';
import { catalogKeyFor, SHOWROOM_BASE, SHOWROOM_SCOPE } from './catalog';

/**
 * El diccionario del catálogo antes de dibujar nada: el menú y el título se traducen en
 * TypeScript. Después, un cambio de idioma lo recarga junto con el raíz (`LanguageService`).
 */
function loadCatalogDictionary(): Observable<boolean> {
  const transloco = inject(TranslocoService);
  return transloco.load(`${SHOWROOM_SCOPE}/${transloco.getActiveLang()}`).pipe(map(() => true));
}

/** Cada página se titula con su nombre en el catálogo (WCAG 2.4.2): la pestaña dice cuál es. */
function withTitles(routes: Routes): Routes {
  const titled = (route: Route): Route => {
    const key = catalogKeyFor(`${SHOWROOM_BASE}/${route.path}`);
    return key === null ? route : { ...route, data: { titleKey: key } };
  };
  return routes.map((route) =>
    route.children === undefined ? route : { ...route, children: route.children.map(titled) },
  );
}

/**
 * Rutas perezosas que el shell monta en /design-system. En inglés sin excepción: una ruta es
 * identificador, no texto (Ver vault: Showroom - Especificacion §3, 2026-09-17).
 */
export const showroomRoutes: Routes = withTitles([
  {
    path: '',
    canActivate: [loadCatalogDictionary],
    loadComponent: async () => (await import('./layout/showroom-layout')).ShowroomLayout,
    children: [
      {
        path: '',
        loadComponent: async () => (await import('./pages/showroom-home')).ShowroomHome,
      },
      {
        path: 'foundations/brand',
        loadComponent: async () => (await import('./pages/foundations/brand')).ShowroomBrand,
      },
      {
        path: 'foundations/colors',
        loadComponent: async () => (await import('./pages/foundations/colors')).ShowroomColors,
      },
      {
        path: 'foundations/typography',
        loadComponent: async () =>
          (await import('./pages/foundations/typography')).ShowroomTypography,
      },
      {
        path: 'foundations/spacing',
        loadComponent: async () => (await import('./pages/foundations/spacing')).ShowroomSpacing,
      },
      {
        path: 'foundations/icons',
        loadComponent: async () =>
          (await import('./pages/foundations/iconography')).ShowroomIconography,
      },
      {
        path: 'components/button',
        loadComponent: async () => (await import('./pages/components/button')).ShowroomButton,
      },
      {
        path: 'components/text',
        loadComponent: async () => (await import('./pages/components/text')).ShowroomText,
      },
      {
        // El botón de solo ícono es una sección del Botón desde 2026-09-21; la URL sigue andando.
        path: 'components/icon-button',
        redirectTo: 'components/button',
        pathMatch: 'full',
      },
      {
        path: 'components/tooltip',
        loadComponent: async () => (await import('./pages/components/tooltip')).ShowroomTooltip,
      },
      {
        path: 'components/input',
        loadComponent: async () => (await import('./pages/components/input')).ShowroomInput,
      },
      {
        path: 'components/search-box',
        loadComponent: async () =>
          (await import('./pages/components/search-box')).ShowroomSearchBox,
      },
      {
        path: 'components/select',
        loadComponent: async () => (await import('./pages/components/select')).ShowroomSelect,
      },
      {
        path: 'components/checkbox',
        loadComponent: async () => (await import('./pages/components/checkbox')).ShowroomCheckbox,
      },
      {
        path: 'components/radio',
        loadComponent: async () => (await import('./pages/components/radio')).ShowroomRadio,
      },
      {
        path: 'components/toggle',
        loadComponent: async () => (await import('./pages/components/toggle')).ShowroomToggle,
      },
      {
        path: 'components/banner',
        loadComponent: async () => (await import('./pages/components/banner')).ShowroomBanner,
      },
      {
        path: 'components/toast',
        loadComponent: async () => (await import('./pages/components/toast')).ShowroomToast,
      },
      {
        path: 'components/card',
        loadComponent: async () => (await import('./pages/components/card')).ShowroomCard,
      },
      {
        path: 'components/dialog',
        loadComponent: async () => (await import('./pages/components/dialog')).ShowroomDialog,
      },
      {
        // Un solo selector desde 2026-09-21: la búsqueda es parte del Select. La URL sigue andando.
        path: 'components/search-select',
        redirectTo: 'components/select',
        pathMatch: 'full',
      },
      {
        path: 'components/date-picker',
        loadComponent: async () =>
          (await import('./pages/components/date-picker')).ShowroomDatePicker,
      },
      {
        path: 'components/split-button',
        loadComponent: async () =>
          (await import('./pages/components/split-button')).ShowroomSplitButton,
      },
      {
        path: 'components/table',
        loadComponent: async () => (await import('./pages/components/table')).ShowroomTable,
      },
      {
        path: 'components/navigation',
        loadComponent: async () =>
          (await import('./pages/components/navigation')).ShowroomNavigation,
      },
      {
        path: 'components/pagination',
        loadComponent: async () =>
          (await import('./pages/components/pagination')).ShowroomPagination,
      },
      {
        path: 'patterns/keyboard',
        loadComponent: async () => (await import('./pages/patterns/keyboard')).ShowroomKeyboard,
      },
      {
        path: 'patterns/search-create-edit',
        loadComponent: async () =>
          (await import('./pages/patterns/search-create-edit')).ShowroomSearchCreateEdit,
      },
      {
        path: 'patterns/form',
        loadComponent: async () => (await import('./pages/patterns/form')).ShowroomForm,
      },
      {
        path: 'patterns/filters',
        loadComponent: async () => (await import('./pages/patterns/filters')).ShowroomFilters,
      },
      {
        path: 'patterns/empty-state',
        loadComponent: async () =>
          (await import('./pages/patterns/empty-state')).ShowroomEmptyState,
      },
      {
        // Redirección permanente, no resto: la iconografía vivía en /design-system/iconografia y
        // la especificación §3 declara estables las URL (un enlace ya pegado debe seguir andando).
        path: 'iconografia',
        redirectTo: 'foundations/icons',
        pathMatch: 'full',
      },
    ],
  },
]);
