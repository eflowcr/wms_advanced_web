import type { Routes } from '@angular/router';

/**
 * Lazy route tree mounted by the shell at /design-system.
 *
 * Routes are in English without exception: a route is an identifier, not
 * interface text. The i18n exemption covers the CONTENT of the pages, which
 * stays Spanish, not their URLs (Showroom spec, section 3, closed 2026-09-17).
 */
export const showroomRoutes: Routes = [
  {
    path: '',
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
        path: 'components/icon-button',
        loadComponent: async () =>
          (await import('./pages/components/icon-button')).ShowroomIconButton,
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
        path: 'components/search-select',
        loadComponent: async () =>
          (await import('./pages/components/search-select')).ShowroomSearchSelect,
      },
      {
        path: 'components/table',
        loadComponent: async () => (await import('./pages/components/table')).ShowroomTable,
      },
      {
        path: 'components/pagination',
        loadComponent: async () =>
          (await import('./pages/components/pagination')).ShowroomPagination,
      },
      {
        /*
         * PERMANENT redirect, not a leftover. The iconography page lived at
         * /design-system/iconografia while the routes were still in Spanish,
         * and section 3 of the spec declares every showroom URL stable -- a
         * link already pasted into Slack has to keep working. Deleting this
         * because it looks dead is exactly the mistake the promise forbids.
         */
        path: 'iconografia',
        redirectTo: 'foundations/icons',
        pathMatch: 'full',
      },
    ],
  },
];
