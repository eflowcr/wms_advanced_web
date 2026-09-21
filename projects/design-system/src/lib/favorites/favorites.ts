import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { EWMS_FAVORITES_STORE, type Favorite } from './favorites.types';

/**
 * LOS FAVORITOS DE ESTA SESIÓN, COMO SEÑALES (REQ-FE-DS4-002 RFE-01). Señales y no
 * una librería de estado, como todo lo demás acá: PLN-WMS-002 §5 pide gestión de
 * estado en proporción al problema, y el problema es una lista de unas pocas rutas.
 * CONOCE LA INTERFAZ Y NUNCA UN MECANISMO: dónde se guarda la lista es asunto de
 * `EWMS_FAVORITES_STORE`.
 * VIVE ACÁ Y NO EN `core/preferences/`, donde lo puso el REQ, por lo mismo que el
 * motor de teclado: el showroom no puede importar `@ewms/core` -la frontera es un
 * error de ESLint- y el showroom es donde vive la pantalla de ejemplo. Llevado a
 * la v1.2 del REQ con esta razón.
 */
@Injectable()
export class Favorites {
  private readonly store = inject(EWMS_FAVORITES_STORE);

  private readonly items = signal<readonly Favorite[]>([]);

  /** La lista, en orden estable. */
  readonly list: Signal<readonly Favorite[]> = this.items.asReadonly();

  readonly count = computed(() => this.items().length);

  constructor() {
    void this.refresh();
  }

  /** Si esta ruta está marcada. Una señal, así una estrella se repinta sola. */
  isFavorite(route: string): Signal<boolean> {
    return computed(() => this.items().some((favorite) => favorite.route === route));
  }

  /**
   * Marca o desmarca. Idempotente por par: marcar y desmarcar devuelve la lista a
   * donde estaba (PACQ-01.2). La señal se refresca DESDE EL STORE después de
   * escribir y no se parchea optimistamente: con el store en memoria no se nota,
   * con un backend es la diferencia entre mostrar lo guardado y lo que esperábamos.
   */
  async toggle(route: string): Promise<void> {
    const marked = this.items().some((current) => current.route === route);
    if (marked) {
      await this.store.remove(route);
    } else {
      // La ruta y nada más: cómo se llama se resuelve al pintar el bloque
      // (`EWMS_FAVORITE_LABELS`), nunca se anota acá.
      await this.store.add({ route });
    }
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    this.items.set(await this.store.read());
  }
}
