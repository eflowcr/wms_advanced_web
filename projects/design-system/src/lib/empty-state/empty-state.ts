import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { IconName } from '../../icons/icons.generated';
import { Button, type ButtonVariant } from '../button/button';
import { Icon } from '../icon/icon';

/** Por qué no hay nada: cada caso tiene su ícono y su acción. Ver vault: Estado-Vacio. */
export type EmptyStateKind = 'no-data' | 'no-results' | 'error' | 'no-access';

/** `compact` dentro de tabla, panel o card; `page` ocupa la pantalla. */
export type EmptyStateSize = 'compact' | 'page';

/** Una sola acción, ya traducida: la primaria del contexto, «Limpiar filtros» o «Reintentar». */
export interface EmptyStateAction {
  readonly label: string;
  readonly icon?: IconName;
  readonly run: () => void;
}

const ICONS: Readonly<Record<EmptyStateKind, IconName>> = {
  'no-data': 'package',
  'no-results': 'search',
  error: 'alert-triangle',
  'no-access': 'lock',
};

/** Crear es la acción del caso; limpiar y reintentar acompañan. */
const ACTION_VARIANT: Readonly<Record<EmptyStateKind, ButtonVariant>> = {
  'no-data': 'primary',
  'no-results': 'secondary',
  error: 'secondary',
  'no-access': 'secondary',
};

/**
 * Lo que se muestra cuando no hay filas, resultados, datos o permiso. Un solo componente para
 * tabla, select y pantalla. Sin textos propios (ADR 0008). Ver vault: Estado-Vacio.
 */
@Component({
  selector: 'ewms-empty-state',
  imports: [Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `title` es atributo nativo: sin anularlo, el literal saldría como tooltip del navegador.
  host: { class: 'block', '[attr.title]': 'null' },
  template: `
    <div
      [class]="boxClasses()"
      [attr.role]="announced() ? 'status' : null"
      [attr.data-empty-state]="kind()"
    >
      <span [class]="iconClasses()" aria-hidden="true" [attr.data-icon]="iconName()">
        <ewms-icon [name]="iconName()" [size]="compact() ? 'lg' : 'xl'" />
      </span>
      @if (compact()) {
        <p class="text-h4 text-primary">{{ title() }}</p>
      } @else {
        <h2 class="text-h3 text-primary">{{ title() }}</h2>
      }
      @if (description()) {
        <p class="max-w-120 text-secondary" [class.text-caption]="compact()">
          {{ description() }}
        </p>
      }
      @if (action(); as act) {
        <ewms-button
          class="mt-1"
          [variant]="actionVariant()"
          [size]="compact() ? 'sm' : 'md'"
          [icon]="act.icon ?? null"
          data-empty-action
          (click)="act.run()"
        >
          {{ act.label }}
        </ewms-button>
      }
    </div>
  `,
})
export class EmptyState {
  readonly kind = input<EmptyStateKind>('no-data');

  /** Ya traducido. */
  readonly title = input.required<string>();

  /** Una o dos líneas; en `no-access`, a quién pedir el permiso. */
  readonly description = input<string>('');

  /** Sin acción en `no-access`: el texto dice a quién pedirlo. */
  readonly action = input<EmptyStateAction | null>(null);

  readonly size = input<EmptyStateSize>('page');

  /** Solo `no-data`: el ícono del contexto, del catálogo. */
  readonly icon = input<IconName | null>(null);

  protected readonly compact = computed(() => this.size() === 'compact');

  protected readonly iconName = computed(() =>
    this.kind() === 'no-data' ? (this.icon() ?? ICONS['no-data']) : ICONS[this.kind()],
  );

  protected readonly actionVariant = computed(() => ACTION_VARIANT[this.kind()]);

  /** Sin resultados o con error aparece por algo que hizo el usuario: se anuncia sin mover foco. */
  protected readonly announced = computed(
    () => this.kind() === 'no-results' || this.kind() === 'error',
  );

  protected readonly boxClasses = computed(
    () =>
      'flex flex-col items-center text-center ' +
      (this.compact() ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-16'),
  );

  protected readonly iconClasses = computed(
    () =>
      'inline-flex rounded-full ' +
      (this.compact() ? 'p-2 ' : 'p-3 ') +
      (this.kind() === 'error' ? 'bg-danger-surface text-danger' : 'bg-secondary text-secondary'),
  );
}
