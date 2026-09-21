import { InjectionToken, type Signal } from '@angular/core';
import type { IconName } from '../../icons/icons.generated';

/**
 * Un favorito es una ruta: ni estado ni filtros (dato no sensible, contrato §12) ni etiqueta,
 * que se resuelve al dibujar (v1.3). Ver vault: REQ-FE-DS4-002.
 */
export interface Favorite {
  /** La identidad: estable y sin idioma. */
  readonly route: string;
  /** Si falta, lo pone el resolvedor. */
  readonly icon?: IconName;
}

/**
 * `labelFor` devuelve una señal: un cambio de idioma repinta solo. Ruta desconocida = cadena
 * vacía. Provee palabras, no estado: proveerlo dos veces es correcto; el store, nunca.
 */
export interface FavoriteLabelResolver {
  labelFor(route: string): Signal<string>;
  iconFor(route: string): IconName | null;
}

export const EWMS_FAVORITE_LABELS = new InjectionToken<FavoriteLabelResolver>(
  'EWMS_FAVORITE_LABELS',
);

/** Detrás de una interfaz (RFE-02). Asíncrona aunque la de memoria conteste al instante. */
export interface FavoritesStore {
  read(): Promise<readonly Favorite[]>;
  /** Agrega uno, no reemplaza la lista: dos pestañas no se pisan (contrato §12). */
  add(favorite: Favorite): Promise<void>;
  remove(route: string): Promise<void>;
}

/** Provisto una vez por aplicación; la biblioteca solo declara la forma. */
export const EWMS_FAVORITES_STORE = new InjectionToken<FavoritesStore>('EWMS_FAVORITES_STORE');
