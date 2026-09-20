import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Icon } from '../icon/icon';
import { Tooltip } from '../tooltip/tooltip';
import type { IconName } from '../../icons/icons.generated';
import { Favorites } from './favorites';
import { EWMS_FAVORITE_LABELS, type Favorite } from './favorites.types';

/** Un favorito como lo dibuja el bloque: la ruta guardada y sus palabras. */
interface FavoriteRow {
  readonly favorite: Favorite;
  readonly label: string;
  readonly icon: IconName;
}

/** Una ruta que nadie sabe nombrar igual lleva icono, y es el del bloque. */
const NEUTRAL_ICON: IconName = 'star';

/**
 * Cuántos favoritos muestra el bloque. Ocho, y el número es del bloque y no de la
 * función: fijado sobre un árbol de dieciséis destinos, una lista de más de ocho
 * deja de ser un atajo y se vuelve un segundo menú. Marcar un noveno se permite;
 * el bloque muestra los primeros ocho. Es un límite de PANTALLA, no de datos.
 */
export const FAVORITES_SHOWN = 8;

/**
 * EL LUGAR FIJO EN LA NAVEGACIÓN (REQ-FE-DS4-002 RFE-04). Una estrella sin un
 * sitio donde mirar lo que marcaste es un botón que no hace nada visible.
 * MUESTRA UN ESTADO VACÍO Y NUNCA DESAPARECE: un bloque que se esfuma hace creer
 * que la función no está, y el vacío es además el único lugar que dice cómo
 * llenarlo. NO NAVEGA: emite lo elegido, como toda pieza de navegación.
 */
@Component({
  selector: 'ewms-favorites-nav',
  templateUrl: './favorites-nav.html',
  imports: [Icon, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class FavoritesNav {
  /** El encabezado del bloque, ya traducido. */
  readonly label = input.required<string>();

  /** Qué decir cuando todavía no hay nada. Ya traducido. */
  readonly emptyLabel = input.required<string>();

  /** Rail plegado o panel abierto, que pasa quien compone el rail. El bloque
   * dibuja solo iconos en el angosto, con tooltips, como el árbol. */
  readonly expanded = input<boolean>(true);

  /** Qué ruta es la página actual, para que el bloque la marque. */
  readonly activeRoute = input<string | null>(null);

  /**
   * SOBRE QUÉ FONDO SE APOYA EL BLOQUE, y se pregunta en vez de suponerse: se
   * escribió para el rail navy del shell, y el showroom lo monta sobre una barra
   * BLANCA, donde ese texto y ese hover son invisibles o están mal. Heredar el
   * color arreglaría el texto y no el hover, que no tiene token independiente.
   */
  readonly ground = input<'navy' | 'surface'>('navy');

  protected readonly tone = computed(() =>
    this.ground() === 'navy'
      ? { text: 'text-on-dark', hover: 'hover:bg-primary-hover', border: 'border-strong' }
      : { text: 'text-primary', hover: 'hover:bg-ghost-hover', border: 'border-default' },
  );

  readonly favoriteSelect = output<Favorite>();

  private readonly favorites = inject(Favorites);
  private readonly labels = inject(EWMS_FAVORITE_LABELS);

  /**
   * EL NOMBRE SE RESUELVE ACÁ, AL DIBUJAR, y eso es todo REQ-FE-DS4-002 v1.3:
   * `labelFor(route)()` se lee dentro del computed, así un cambio de idioma
   * repinta el bloque solo. UNA RUTA QUE YA NO RESUELVE SE MUESTRA TAL CUAL: una
   * fila vacía sería un botón que nadie puede identificar.
   */
  protected readonly shown = computed<readonly FavoriteRow[]>(() =>
    this.favorites
      .list()
      .slice(0, FAVORITES_SHOWN)
      .map((favorite) => ({
        favorite,
        label: this.labels.labelFor(favorite.route)() || favorite.route,
        icon: favorite.icon ?? this.labels.iconFor(favorite.route) ?? NEUTRAL_ICON,
      })),
  );

  protected onSelect(favorite: Favorite): void {
    this.favoriteSelect.emit(favorite);
  }
}
