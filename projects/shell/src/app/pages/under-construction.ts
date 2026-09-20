import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { Banner } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * «EN CONSTRUCCIÓN» — THE PAGE THIRTEEN MENU ENTRIES LEAD TO, AND NOT A 404.
 *
 * The menu is the real one (menu.ts): the design specifies a tree with
 * Catálogos and Configuración, and drawing a menu whose entries 404 tells an
 * operator the application is broken. This page tells them the truth instead,
 * and keeps the shape of the navigation honest while the domains arrive in
 * DS-6.
 *
 * IT HAS A TITLE AND AN `h1`, which is the whole requirement (WCAG 2.4.2 and
 * 2.4.6) and the reason it is a component rather than a redirect: the App
 * Shell moves the focus to the `h1` of every page it lands on, and a page
 * without one would drop the focus of everybody who arrived here.
 *
 * The name of the screen comes from the ROUTE, so this one component serves
 * all thirteen without a list of its own.
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

  /**
   * The route's title KEY, not its translated title.
   *
   * The key goes through the `transloco` pipe in the template, which is what
   * makes the heading follow a language change without a reload. Translating
   * it here, once, would freeze it in whatever language was active when the
   * page opened -- the half-translated screen ADR 0008 exists to prevent.
   */
  protected readonly titleKey = toSignal(
    this.route.data.pipe(map((data) => (data['titleKey'] as string | undefined) ?? '')),
    { initialValue: '' },
  );
}
