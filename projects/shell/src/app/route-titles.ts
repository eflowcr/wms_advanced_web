import { Injectable, signal } from '@angular/core';

/**
 * La clave de título de cada ruta visitada, la de su `data.titleKey`: nombra pestañas y favoritos
 * sin importar el catálogo del showroom, que así no pesa en `/` (ADR 0003).
 */
@Injectable({ providedIn: 'root' })
export class RouteTitles {
  private readonly keys = signal<ReadonlyMap<string, string>>(new Map());

  /** La clave de la ruta, sin su query; `null` si nunca se navegó a ella. */
  keyFor(route: string): string | null {
    return this.keys().get(pathOf(route)) ?? null;
  }

  /** Lo llama el marco (MainLayout) en cada navegación. */
  record(route: string, key: string): void {
    const path = pathOf(route);
    if (this.keys().get(path) !== key) {
      this.keys.update((current) => new Map(current).set(path, key));
    }
  }
}

function pathOf(route: string): string {
  const query = route.indexOf('?');
  return query === -1 ? route : route.slice(0, query);
}
