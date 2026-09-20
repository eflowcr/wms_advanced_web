import { InjectionToken, type Signal } from '@angular/core';
import type { IconName } from '../../icons/icons.generated';

/**
 * Un favorito es UNA RUTA. Ni el estado de la pantalla ni sus filtros: eso hace
 * el dato trivialmente no sensible, y es la promesa del contrato al backend (§12).
 * Y NO SU NOMBRE: hasta la v1.3 guardaba la etiqueta ya traducida, así que
 * «Artículos» marcado en español seguía en español al pasar a inglés. El nombre
 * es PRESENTACIÓN y se resuelve al dibujar, por `EWMS_FAVORITE_LABELS`.
 */
export interface Favorite {
  /** La ruta de la aplicación. La identidad: estable y sin idioma. */
  readonly route: string;
  /** Opcional. Si falta, lo pone el resolvedor. */
  readonly icon?: IconName;
}

/**
 * Cómo se llama una ruta, preguntado al dibujar. `labelFor` devuelve una SEÑAL,
 * así un cambio de idioma repinta el bloque solo. Una ruta que ya nadie sabe
 * nombrar resuelve a cadena vacía y el bloque la muestra tal cual.
 * Es un proveedor de PALABRAS y no de estado: proveerlo dos veces es correcto,
 * cosa que proveer el STORE dos veces nunca lo es.
 */
export interface FavoriteLabelResolver {
  labelFor(route: string): Signal<string>;
  iconFor(route: string): IconName | null;
}

export const EWMS_FAVORITE_LABELS = new InjectionToken<FavoriteLabelResolver>(
  'EWMS_FAVORITE_LABELS',
);

/**
 * DÓNDE VIVEN LOS FAVORITOS, DETRÁS DE UNA INTERFAZ (RFE-02). `Favorites` conoce
 * esto y nunca un mecanismo: lo único que cambia cuando llegue el Security Core
 * es la implementación.
 * ASÍNCRONA EN SU FORMA aunque la de memoria conteste al instante: una interfaz
 * síncrona habría que reescribirla -y con ella cada consumidor- el día que la
 * respuesta venga por red.
 */
export interface FavoritesStore {
  /** La lista entera, en orden estable. */
  read(): Promise<readonly Favorite[]>;
  /** Agrega uno. No «reemplaza la lista»: dos pestañas abiertas no pueden
   * pisarse, que es lo que pide el contrato al backend (§12). */
  add(favorite: Favorite): Promise<void>;
  /** Quita uno, por ruta. */
  remove(route: string): Promise<void>;
}

/** El store, PROVISTO UNA VEZ POR APLICACIÓN. La librería declara la forma y las
 * aplicaciones la proveen, como `EWMS_SHORTCUT_MAP` y `EWMS_TABLE_MESSAGES`. */
export const EWMS_FAVORITES_STORE = new InjectionToken<FavoritesStore>('EWMS_FAVORITES_STORE');
