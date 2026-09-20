import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { IconButton } from '../icon-button/icon-button';
import { Favorites } from './favorites';

/**
 * LA ESTRELLA (REQ-FE-DS4-002 RFE-03), en la cabecera de cada pantalla que puede
 * ser favorita.
 *
 * `aria-pressed` y no `aria-checked`: es un botón de dos estados, y `aria-checked`
 * es de las cosas de un grupo donde se elige una.
 * EL NOMBRE DICE QUÉ HACE Y CAMBIA CON EL ESTADO -«Agregar a favoritos» /
 * «Quitar de favoritos»-, porque uno llamado «Favorito» dice qué ES y no qué va a
 * pasar al pulsarlo.
 * EL ESTADO NO ES SOLO COLOR: marcada es la variante `primary` -caja azul- y sin
 * marcar es `ghost`, sin caja. Un fondo que aparece y desaparece es un cambio de
 * forma (WCAG 1.4.1). Y una región viva (RFE-05), que no es redundante con
 * `aria-pressed`: aquel se anuncia al releer el botón, esta confirma la ACCIÓN en
 * el momento, sin mover el foco.
 * LEE EL SERVICIO EN VEZ DE RECIBIR `pressed`: es el único punto donde esta pieza
 * no es puramente presentacional, y es deliberado -la comanda pide un PATRÓN, no
 * un botón-.
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
  /** Qué pantalla es esta. La ruta ES el favorito; su nombre no se guarda nunca. */
  readonly route = input.required<string>();

  /** Las dos ya traducidas. Son distintas, y eso es el requisito. */
  readonly addLabel = input.required<string>();
  readonly removeLabel = input.required<string>();

  /** Lo que dice la región viva después. Ya traducido. */
  readonly addedMessage = input.required<string>();
  readonly removedMessage = input.required<string>();

  readonly size = input<'sm' | 'md' | 'lg'>('md');

  private readonly favorites = inject(Favorites);

  protected readonly announcement = signal('');

  protected readonly marked = computed(() =>
    this.favorites.list().some((current) => current.route === this.route()),
  );

  protected onToggle(): void {
    // Se lee ANTES de escribir: después, `marked()` es el estado nuevo y el
    // mensaje describiría lo que acaba de dejar de ser cierto.
    const wasMarked = this.marked();
    void this.favorites.toggle(this.route()).then(() => {
      this.announcement.set(wasMarked ? this.removedMessage() : this.addedMessage());
    });
  }
}
