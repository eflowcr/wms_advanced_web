import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { Banner } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * «En construcción»: adonde llevan las trece entradas sin pantalla, nunca un 404. Es componente
 * y no redirección porque necesita título y `h1` (WCAG 2.4.2 y 2.4.6) para recibir el foco.
 * El nombre sale de la ruta, así que sirve a las trece sin lista propia.
 */
@Component({
  selector: 'app-under-construction',
  template: `
    <h1 class="text-h1" tabindex="-1" data-page-heading>{{ titleKey() | transloco }}</h1>

    <ewms-banner
      variant="info"
      [severityLabel]="'shell.toast.severity.info' | transloco"
      [title]="'shell.underConstruction.title' | transloco"
    >
      {{ 'shell.underConstruction.body' | transloco }}
    </ewms-banner>
  `,
  imports: [Banner, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
})
export class UnderConstruction {
  private readonly route = inject(ActivatedRoute);

  /** La clave y no el texto: traducida acá quedaría congelada en el idioma de apertura. */
  protected readonly titleKey = toSignal(
    this.route.data.pipe(map((data) => (data['titleKey'] as string | undefined) ?? '')),
    { initialValue: '' },
  );
}
