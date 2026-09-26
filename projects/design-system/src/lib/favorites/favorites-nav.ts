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
 * El activo de cada fondo, en semibold, como en el menú: sobre el navy una píldora surface, sobre
 * claro una fila navy (decisión del usuario, 2026-09-25). Por estado y no con variantes `aria-*`.
 */
const NAVY_ACTIVE_CLASSES = 'bg-surface text-h4 text-primary';
const SURFACE_ACTIVE_CLASSES = 'bg-brand-navy text-h4 text-on-dark';
/** Plegado, la misma píldora pero solo alrededor del ícono. */
const NAVY_INDICATOR_CLASSES = 'bg-surface text-primary';
const SURFACE_INDICATOR_CLASSES = 'bg-brand-navy text-on-dark';
/**
 * Sangría de cada fondo: en el menú el bloque se alinea con las filas del árbol (10 + 16); en el
 * catálogo, con su columna, que ya trae su relleno, y las filas con las de sus páginas (8).
 */
const NAVY_BLOCK_CLASSES = 'border-strong px-2.5 text-on-dark';
const SURFACE_BLOCK_CLASSES = 'border-default text-primary';

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

  /** El menú lateral y la hoja inferior son navy; el catálogo, claro. */
  readonly ground = input<'navy' | 'surface'>('surface');

  protected readonly blockClasses = computed(() =>
    this.ground() === 'navy' ? NAVY_BLOCK_CLASSES : SURFACE_BLOCK_CLASSES,
  );

  /** El título y el aviso de vacío, a la altura del texto de las filas. */
  protected readonly textInset = computed(() => (this.ground() === 'navy' ? 'px-4' : ''));

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
    const inset = this.ground() === 'navy' ? 'px-4' : 'px-2';
    const shape = this.expanded() ? inset : 'justify-center px-1';
    const navy = this.ground() === 'navy';
    if (this.activeRoute() === route) {
      // Plegado, lo activo va en el indicador del ícono.
      if (!this.expanded()) {
        return shape;
      }
      return `${shape} ${navy ? NAVY_ACTIVE_CLASSES : SURFACE_ACTIVE_CLASSES}`;
    }
    return `${shape} text-p ${navy ? 'hover:bg-primary-hover' : 'hover:bg-ghost-hover'}`;
  }

  protected indicatorClasses(route: string): string {
    if (this.activeRoute() !== route) {
      return '';
    }
    return this.ground() === 'navy' ? NAVY_INDICATOR_CLASSES : SURFACE_INDICATOR_CLASSES;
  }

  protected onSelect(favorite: Favorite): void {
    this.favoriteSelect.emit(favorite);
  }
}
