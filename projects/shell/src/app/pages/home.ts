import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccessStore, AuthSession } from '@ewms/core/security';
import { Icon, type IconName } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { MENU } from '../layout/menu';

interface HomeModule {
  readonly id: string;
  readonly route: string;
  readonly icon: IconName;
  readonly labelKey: string;
  readonly groupKey: string;
}

/**
 * Inicio: saluda a quien abrió la sesión y lleva a los módulos que su perfil le permite, los
 * mismos del menú. Sin ninguno, lo dice y a quién pedirlo. Ver vault: App-Shell.
 */
@Component({
  imports: [Icon, RouterLink, TranslocoPipe],
  selector: 'app-home',
  templateUrl: './home.html',
  host: { class: 'flex flex-col gap-8' },
})
export class Home {
  private readonly access = inject(AccessStore);
  private readonly auth = inject(AuthSession);

  protected readonly name = computed(() => this.auth.session()?.name.trim() ?? '');

  protected readonly modules = computed<readonly HomeModule[]>(() =>
    MENU.flatMap((group) =>
      (group.children ?? [])
        .filter((entry) => entry.route !== undefined && this.access.canRoute(entry.route))
        .map((entry) => ({
          id: entry.id,
          route: entry.route ?? '',
          icon: entry.icon,
          labelKey: entry.labelKey,
          groupKey: group.labelKey,
        })),
    ),
  );
}
