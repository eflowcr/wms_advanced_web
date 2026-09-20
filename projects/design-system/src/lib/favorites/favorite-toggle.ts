import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { IconButton } from '../icon-button/icon-button';
import { Favorites } from './favorites';

/**
 * THE STAR (REQ-FE-DS4-002 RFE-03). One control, in the header of every screen
 * that can be a favourite.
 *
 * `aria-pressed`, NOT `aria-checked` and not a plain button. It is a two-state
 * button and `aria-pressed` is exactly that; `aria-checked` belongs to things
 * in a group where one is chosen.
 *
 * THE NAME SAYS WHAT IT DOES AND CHANGES WITH THE STATE -- «Agregar a
 * favoritos» / «Quitar de favoritos» -- because a button called «Favorito»
 * says what it IS and not what pressing it will do. Both strings arrive
 * translated from the consumer (ADR 0008).
 *
 * THE STATE IS NOT COLOUR ALONE. Marked, the control is the `primary` variant:
 * a filled blue box with a white star. Unmarked it is `ghost`: no box at all.
 * A background that appears and disappears is a change of shape, which is what
 * WCAG 1.4.1 asks for, and `aria-pressed` carries it for anyone who sees
 * neither.
 *
 * AND A LIVE REGION, which is RFE-05 and is not redundant with `aria-pressed`.
 * The pressed state is announced when the button is re-read; the live region
 * is what confirms the ACTION at the moment it happens, without the focus
 * having to move. The two messages are required inputs on purpose -- an
 * optional one is an optional one that nobody passes, and then the star is
 * silent.
 *
 * IT READS THE SERVICE RATHER THAN TAKING `pressed` AS AN INPUT, which is the
 * one place this piece is not purely presentational, deliberately. The comanda
 * asks for a PATTERN, not a button: a screen writes one tag and gets the
 * behaviour, instead of every screen wiring a signal to an input and an output
 * back to a service slightly differently. `ShortcutsHost` has the same shape
 * for the same reason.
 */
@Component({
  selector: 'ewms-favorite-toggle',
  template: `
    <ewms-icon-button
      icon="star"
      [variant]="marked() ? 'primary' : 'ghost'"
      [size]="size()"
      [label]="marked() ? removeLabel() : addLabel()"
      [tooltip]="marked() ? removeLabel() : addLabel()"
      [pressed]="marked()"
      (click)="onToggle()"
    />

    <!--
      Empty until something happens, and emptied again afterwards is NOT done:
      clearing it would re-announce. It simply holds the last confirmation.
    -->
    <span class="sr-only" role="status" data-favorite-announce>{{ announcement() }}</span>
  `,
  imports: [IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center', 'data-favorite-toggle': '' },
})
export class FavoriteToggle {
  /** Which screen this is. The route IS the favourite; its name is never stored. */
  readonly route = input.required<string>();

  /** Both already translated. They differ, and that is the requirement. */
  readonly addLabel = input.required<string>();
  readonly removeLabel = input.required<string>();

  /** What the live region says afterwards. Already translated. */
  readonly addedMessage = input.required<string>();
  readonly removedMessage = input.required<string>();

  readonly size = input<'sm' | 'md' | 'lg'>('md');

  private readonly favorites = inject(Favorites);

  protected readonly announcement = signal('');

  protected readonly marked = computed(() =>
    this.favorites.list().some((current) => current.route === this.route()),
  );

  protected onToggle(): void {
    // Read BEFORE the write: after it, `marked()` is the new state and the
    // message would describe what just stopped being true.
    const wasMarked = this.marked();
    void this.favorites.toggle(this.route()).then(() => {
      this.announcement.set(wasMarked ? this.removedMessage() : this.addedMessage());
    });
  }
}
