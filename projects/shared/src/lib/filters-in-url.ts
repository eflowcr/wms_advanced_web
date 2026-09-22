import { computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type Params } from '@angular/router';

/**
 * Un filtro en la URL: un texto, o un período `desde..hasta` con cualquiera de los dos extremos.
 * Estructural a propósito: `@ewms/shared` no importa nada del proyecto (ver eslint.config.js).
 */
export type UrlFilterValue = string | { readonly from?: string; readonly to?: string };

export type UrlFilters = Readonly<Record<string, UrlFilterValue>>;

/** Separador de un período: `2026-03-01..2026-03-31`, `2026-03-01..` o `..2026-03-31`. */
const RANGE = '..';

/** Lo que queda en la URL: una clave por filtro puesto, y `null` borra la que se quitó. */
export function toQueryParams(keys: readonly string[], filters: UrlFilters): Params {
  const params: Params = {};
  for (const key of keys) {
    const value = filters[key];
    params[key] =
      value === undefined
        ? null
        : typeof value === 'string'
          ? value
          : `${value.from ?? ''}${RANGE}${value.to ?? ''}`;
  }
  return params;
}

/** Lee solo las claves declaradas: un parámetro ajeno de la pantalla no se toma por filtro. */
export function fromQueryParams(keys: readonly string[], params: Params): UrlFilters {
  const filters: Record<string, UrlFilterValue> = {};
  for (const key of keys) {
    const raw = params[key];
    if (typeof raw !== 'string' || raw === '') {
      continue;
    }
    if (!raw.includes(RANGE)) {
      filters[key] = raw;
      continue;
    }
    const [from, to] = raw.split(RANGE);
    const range = { ...(from ? { from } : {}), ...(to ? { to } : {}) };
    if (from || to) {
      filters[key] = range;
    }
  }
  return filters;
}

/** Lo que devuelve `filtersInUrl`: el valor de la URL, y cómo escribirlo. */
export interface UrlFilterState {
  readonly value: Signal<UrlFilters>;
  /** Navega a la misma ruta con los filtros nuevos: el historial guarda cada paso. */
  set(filters: UrlFilters): void;
}

/**
 * Filtros de pantalla en los `queryParams`: un enlace filtrado se comparte, recargar no pierde
 * nada y «atrás» deshace el último filtro. Vive en `@ewms/shared` porque el sistema de diseño no
 * conoce el router (ADR: fronteras en eslint.config.js) y lo usan shell y showroom por igual.
 * Se llama desde un contexto de inyección. Ver vault: Patron-Filtros.
 */
export function filtersInUrl(keys: readonly string[]): UrlFilterState {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const params = toSignal(route.queryParams, { initialValue: route.snapshot.queryParams });
  return {
    value: computed(() => fromQueryParams(keys, params())),
    set: (filters) => {
      void router.navigate([], {
        relativeTo: route,
        queryParams: toQueryParams(keys, filters),
        queryParamsHandling: 'merge',
      });
    },
  };
}
