import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { EWMS_FAVORITES_STORE, type Favorite } from './favorites.types';

/**
 * Favoritos de la sesión como señales (RFE-01); conoce la interfaz, no el mecanismo. Vive acá y
 * no en `core/preferences/` por la frontera del showroom. Ver vault: REQ-FE-DS4-002 (v1.2).
 */
@Injectable()
export class Favorites {
  private readonly store = inject(EWMS_FAVORITES_STORE);

  private readonly items = signal<readonly Favorite[]>([]);

  readonly list: Signal<readonly Favorite[]> = this.items.asReadonly();

  constructor() {
    void this.refresh();
  }

  /** Señal: la estrella se repinta sola. */
  isFavorite(route: string): Signal<boolean> {
    return computed(() => this.items().some((favorite) => favorite.route === route));
  }

  /** Idempotente por par (PACQ-01.2). Refresca desde el store, sin parche optimista. */
  async toggle(route: string): Promise<void> {
    const marked = this.items().some((current) => current.route === route);
    if (marked) {
      await this.store.remove(route);
    } else {
      // Solo la ruta: el nombre se resuelve al pintar (`EWMS_FAVORITE_LABELS`).
      await this.store.add({ route });
    }
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    this.items.set(await this.store.read());
  }
}
