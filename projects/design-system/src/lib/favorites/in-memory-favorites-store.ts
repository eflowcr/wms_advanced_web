import type { Favorite, FavoritesStore } from './favorites.types';

/**
 * En memoria (decisión del usuario, 2026-09-19): se pierden al recargar, sin excepción de ESLint
 * para el almacenamiento del navegador. El E2E afirma la pérdida. Ver vault: REQ-FE-DS4-002.
 */
export class InMemoryFavoritesStore implements FavoritesStore {
  /** Orden de inserción = orden estable de RFE-01: por etiqueta cambiaría con el idioma. */
  private favorites: Favorite[] = [];

  read(): Promise<readonly Favorite[]> {
    return Promise.resolve([...this.favorites]);
  }

  add(favorite: Favorite): Promise<void> {
    if (!this.favorites.some((current) => current.route === favorite.route)) {
      this.favorites.push(favorite);
    }
    return Promise.resolve();
  }

  remove(route: string): Promise<void> {
    this.favorites = this.favorites.filter((current) => current.route !== route);
    return Promise.resolve();
  }
}
