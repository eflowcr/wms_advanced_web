import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { CRUMB_FOLD_THRESHOLD, foldCrumbs, type Crumb } from './navigation.types';

/**
 * WHERE YOU ARE, AS A PATH.
 *
 * An `<ol>` inside a named `<nav>`, because the order is the meaning: these
 * are not a list of links, they are one route through a tree. The last crumb
 * is the page you are on, carries `aria-current="page"`, and is NOT a link --
 * a link to where you already are is a link that does nothing, and a screen
 * reader announces it as a destination.
 *
 * THE FOLD (the sheet's second open question, closed in DS-5). Past five
 * levels the middle collapses into an ellipsis, and THE ELLIPSIS IS A BUTTON.
 * The alternatives were both worse: truncating the labels makes
 * "Ubicación A1-12-03" read "Ubicaci…", and dropping the middle silently
 * removes navigation the user can see they had. A button says the path
 * continues and gives it back in one press.
 *
 * The first and the last are never folded: the first is the way out and the
 * last is where you are.
 */
@Component({
  selector: 'ewms-breadcrumbs',
  templateUrl: './breadcrumbs.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0' },
})
export class Breadcrumbs {
  readonly items = input.required<readonly Crumb[]>();

  /** The landmark's name, already translated. Required, like the rail's. */
  readonly label = input.required<string>();

  /**
   * What the fold button is called, already translated.
   *
   * It says what it does and how much it hides -- «Mostrar 4 niveles
   * ocultos» -- so the consumer receives the count and writes the sentence.
   * A button called «…» has no accessible name at all.
   */
  readonly expandLabel = input.required<(hidden: number) => string>();

  /** A crumb was chosen. The last one never emits: it is not a link. */
  readonly crumbSelect = output<Crumb>();

  /** The fold, opened by the user. Closes again when the trail changes. */
  private readonly unfolded = signal(false);

  protected readonly threshold = CRUMB_FOLD_THRESHOLD;

  private readonly folded = computed(() => foldCrumbs(this.items(), this.unfolded()));

  protected readonly visible = computed(() => this.folded().visible);
  protected readonly hidden = computed(() => this.folded().folded);

  protected isLast(crumb: Crumb): boolean {
    const visible = this.visible();
    return visible[visible.length - 1] === crumb;
  }

  /** The fold sits between the first crumb and the rest, when there is one. */
  protected showsFoldAfter(crumb: Crumb): boolean {
    return this.hidden() > 0 && this.visible()[0] === crumb;
  }

  protected onExpand(): void {
    this.unfolded.set(true);
  }

  protected onSelect(crumb: Crumb): void {
    this.crumbSelect.emit(crumb);
  }
}
