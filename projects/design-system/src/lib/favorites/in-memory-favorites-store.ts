import type { Favorite, FavoritesStore } from './favorites.types';

/**
 * FAVORITOS EN MEMORIA, Y LA LIMITACIÓN ES EL PUNTO DE ESCRIBIRLA. Decisión del
 * usuario (2026-09-19), que reemplaza a la del 18/09 de diferirlos hasta el
 * backend.
 *
 * LO QUE CUESTA: SE PIERDEN AL RECARGAR. No hay almacenamiento del navegador en
 * ninguna parte -ESLint prohíbe `localStorage` y `sessionStorage` y ACÁ NO SE ABRE
 * NINGUNA EXCEPCIÓN, que fue toda la dificultad de la decisión-, así que la lista
 * vive lo que viva la pestaña. Termina con el Security Core (PLN-WMS-005): un
 * favorito es una preferencia por usuario y necesita un usuario. El contrato que
 * hay que pedir ya está escrito (REQ-FE-DS4-002 §12).
 * El E2E AFIRMA LA PÉRDIDA en vez de esquivarla: el día que alguien conecte el
 * backend esa prueba falla, que es justo cuando hay que reescribir este párrafo.
 * Sale de la librería, como `ArrayTableSource`, porque el shell y el showroom lo
 * necesitan y «un arreglo en un campo» escrito dos veces son dos cosas que derivan.
 */
export class InMemoryFavoritesStore implements FavoritesStore {
  /**
   * Orden de inserción, y ESE es el orden estable que pide RFE-01: ordenar por
   * etiqueta rebarajaría el bloque en cada cambio de idioma, y por ruta daría un
   * orden que nadie eligió. Lo que alguien marcó primero queda primero.
   */
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
