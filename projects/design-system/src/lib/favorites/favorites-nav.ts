import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Icon } from '../icon/icon';
import { Tooltip } from '../tooltip/tooltip';
import type { IconName } from '../../icons/icons.generated';
import { Favorites } from './favorites';
import { EWMS_FAVORITE_LABELS, type Favorite } from './favorites.types';

interface FavoriteRow {
  readonly favorite: Favorite;
  readonly label: string;
  readonly icon: IconName;
}

/** Una ruta sin icono propio lleva el del bloque. */
const NEUTRAL_ICON: IconName = 'star';

/**
 * El activo es el del menú: navy con texto claro y semibold (decisión del usuario, 2026-09-25). Por
 * estado y no con variantes `aria-*`, como en el rail: utilidades que la hoja ya tenía.
 */
const ACTIVE_CLASSES = 'bg-brand-navy text-h4 text-on-dark';

/** Límite de pantalla, no de datos: más de ocho deja de ser atajo. Ver vault: REQ-FE-DS4-002. */
export const FAVORITES_SHOWN = 8;

/**
 * Lugar fijo de favoritos (REQ-FE-DS4-002 RFE-04). Nunca desaparece: vacío muestra cómo
 * llenarlo. No navega: emite lo elegido.
 */
@Component({
  selector: 'ewms-favorites-nav',
  templateUrl: './favorites-nav.html',
  imports: [Icon, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class FavoritesNav {
  readonly label = input.required<string>();

  readonly emptyLabel = input.required<string>();

  /** Plegado dibuja solo iconos con tooltip, como el árbol. */
  readonly expanded = input<boolean>(true);

  readonly activeRoute = input<string | null>(null);

  readonly favoriteSelect = output<Favorite>();

  private readonly favorites = inject(Favorites);
  private readonly labels = inject(EWMS_FAVORITE_LABELS);

  // El nombre se resuelve al dibujar (REQ-FE-DS4-002 v1.3): un cambio de idioma repinta solo.
  // Una ruta que ya no resuelve se muestra tal cual.
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

  protected rowClasses(route: string): string {
    const shape = this.expanded() ? 'px-4' : 'justify-center px-1';
    return `${shape} ${this.activeRoute() === route ? ACTIVE_CLASSES : 'text-p hover:bg-ghost-hover'}`;
  }

  protected onSelect(favorite: Favorite): void {
    this.favoriteSelect.emit(favorite);
  }
}
