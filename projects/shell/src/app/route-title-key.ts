import type { ActivatedRouteSnapshot } from '@angular/router';

// Aparte de RouteTitles: la estrategia de título arranca con la app y no debe arrastrarlo.

/** La `titleKey` más profunda: `/design-system/components/button` dice Botón, no el padre. */
export function deepestTitleKey(root: ActivatedRouteSnapshot): string | undefined {
  let route = root;
  let key: string | undefined;
  while (route.firstChild !== null) {
    route = route.firstChild;
    key = (route.data['titleKey'] as string | undefined) ?? key;
  }
  return key;
}
