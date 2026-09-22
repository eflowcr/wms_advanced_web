import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Button } from '../button/button';
import { Favorites } from './favorites';

/**
 * La estrella (REQ-FE-DS4-002 RFE-03): `aria-pressed`, nombre que dice qué hará, estado por
 * forma y no solo color (WCAG 1.4.1) y región viva (RFE-05). Lee el servicio a propósito.
 */
@Component({
  selector: 'ewms-favorite-toggle',
  template: `
    <ewms-button
      [iconOnly]="true"
      icon="star"
      [variant]="marked() ? 'primary' : 'ghost'"
      [size]="size()"
      [label]="marked() ? removeLabel() : addLabel()"
      [pressed]="marked()"
      (click)="onToggle()"
    />

    <!-- No se vacía después: vaciarla volvería a anunciar. Guarda la última confirmación. -->
    <span class="sr-only" role="status" data-favorite-announce>{{ announcement() }}</span>
  `,
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center', 'data-favorite-toggle': '' },
})
export class FavoriteToggle {
  /** La ruta es el favorito; el nombre no se guarda nunca. */
  readonly route = input.required<string>();

  /** Distintas a propósito: es el requisito. */
  readonly addLabel = input.required<string>();
  readonly removeLabel = input.required<string>();

  /** Lo que dice la región viva después. */
  readonly addedMessage = input.required<string>();
  readonly removedMessage = input.required<string>();

  readonly size = input<'sm' | 'md' | 'lg'>('md');

  private readonly favorites = inject(Favorites);

  protected readonly announcement = signal('');

  protected readonly marked = computed(() =>
    this.favorites.list().some((current) => current.route === this.route()),
  );

  protected onToggle(): void {
    // Leído antes de escribir: después `marked()` ya es el estado nuevo.
    const wasMarked = this.marked();
    void this.favorites.toggle(this.route()).then(() => {
      this.announcement.set(wasMarked ? this.removedMessage() : this.addedMessage());
    });
  }
}
