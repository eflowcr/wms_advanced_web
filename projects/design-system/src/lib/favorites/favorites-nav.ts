import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Icon } from '../icon/icon';
import { Tooltip } from '../tooltip/tooltip';
import { Favorites } from './favorites';
import type { Favorite } from './favorites.types';

/**
 * How many favourites the block shows.
 *
 * Eight, and the number is about the block rather than about the feature:
 * pinned above a tree of sixteen destinations, a list longer than eight stops
 * being a shortcut and becomes a second menu -- and on the rail it would push
 * the tree off the screen. Marking a ninth is allowed; the block shows the
 * first eight. REQ-FE-DS4-002 §16 leaves the question of a hard limit open,
 * and this is a display limit, which is a different thing.
 */
export const FAVORITES_SHOWN = 8;

/**
 * THE FIXED PLACE IN THE NAVIGATION (REQ-FE-DS4-002 RFE-04).
 *
 * This is the half of favourites that makes them worth having. A star with
 * nowhere to look at what you starred is a button that does nothing you can
 * see; the comanda asks for the screens somebody uses all day to be *"always
 * visible in a fixed place in the navigation"*, and this is that place.
 *
 * IT SHOWS AN EMPTY STATE AND NEVER DISAPPEARS. A block that vanishes when
 * there is nothing in it makes somebody believe the feature is not there -- and
 * the empty state is also the only place that says how to put something in it.
 *
 * IT DOES NOT NAVIGATE. Like every other navigation piece here it emits what
 * was chosen; the shell, which is the only thing that knows what a route
 * means, does the navigating. That is what keeps `@angular/router` out of a
 * presentation library and lets the showroom show this block without one.
 */
@Component({
  selector: 'ewms-favorites-nav',
  templateUrl: './favorites-nav.html',
  imports: [Icon, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class FavoritesNav {
  /** The heading over the block, already translated. */
  readonly label = input.required<string>();

  /** What to say when there is nothing yet. Already translated. */
  readonly emptyLabel = input.required<string>();

  /**
   * Collapsed rail or expanded panel, passed down by whoever composes the
   * rail. The block draws icons only in the narrow one, with tooltips, for the
   * same reason the tree does.
   */
  readonly expanded = input<boolean>(true);

  /** Which route is the page you are on, so the block can mark it. */
  readonly activeRoute = input<string | null>(null);

  /**
   * WHICH GROUND THE BLOCK IS SITTING ON, and why it is asked rather than
   * assumed.
   *
   * The block was written for the App Shell's navy rail, where the text is
   * `--color-text-on-dark` and hover is a darker blue. The showroom mounts the
   * same block on a WHITE sidebar, where both of those are invisible or wrong.
   * Inheriting the colour from the container would fix the text and not the
   * hover, which has no ground-independent token.
   *
   * Two values, named after what they are, exactly like `ewms-demo-frame`'s.
   */
  readonly ground = input<'navy' | 'surface'>('navy');

  protected readonly tone = computed(() =>
    this.ground() === 'navy'
      ? { text: 'text-on-dark', hover: 'hover:bg-primary-hover', border: 'border-strong' }
      : { text: 'text-primary', hover: 'hover:bg-ghost-hover', border: 'border-default' },
  );

  readonly favoriteSelect = output<Favorite>();

  private readonly favorites = inject(Favorites);

  protected readonly shown = computed(() => this.favorites.list().slice(0, FAVORITES_SHOWN));

  protected onSelect(favorite: Favorite): void {
    this.favoriteSelect.emit(favorite);
  }
}
