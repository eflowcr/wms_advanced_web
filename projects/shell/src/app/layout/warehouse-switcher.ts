import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SessionContext } from '@ewms/core';
import {
  ActiveContext,
  AuthSession,
  ContextChangeError,
  type AccessContext,
  type ContextChangeCode,
} from '@ewms/core/security';
import { Select, ToastService, type SelectOption } from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

/** t(shell.warehouse.taskInProgress, shell.warehouse.denied, shell.warehouse.unavailable) */
const REFUSAL: Readonly<Record<ContextChangeCode, string>> = {
  taskInProgress: 'shell.warehouse.taskInProgress',
  denied: 'shell.warehouse.denied',
  unavailable: 'shell.warehouse.unavailable',
};

const key = (context: AccessContext) => `${context.warehouseId}/${context.ownerId}`;

/**
 * El almacén activo siempre a la vista y su cambio sin volver a iniciar sesión (SEC-MUL-003).
 * Lo decide el servidor: si lo rechaza, el campo vuelve al almacén vigente y dice el motivo.
 * Con un solo almacén no hay nada que elegir: se muestra como texto, sin parada de teclado.
 */
@Component({
  selector: 'app-warehouse-switcher',
  imports: [Select, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full', 'data-warehouse-switcher': '' },
  template: `
    @if (options().length > 1) {
      <ewms-select
        size="sm"
        [label]="'shell.warehouse.label' | transloco"
        [hideLabel]="true"
        [options]="options()"
        [value]="current()"
        (valueChange)="choose($event)"
      />
    } @else {
      <p class="truncate text-caption text-secondary" data-warehouse-current>
        <span class="sr-only">{{ 'shell.warehouse.label' | transloco }}: </span>{{ currentLabel() }}
      </p>
    }
  `,
})
export class WarehouseSwitcher {
  private readonly auth = inject(AuthSession);
  private readonly active = inject(ActiveContext);
  private readonly display = inject(SessionContext);
  private readonly toasts = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly language = toSignal(this.i18n.langChanges$);
  private readonly field = viewChild(Select);
  private readonly contexts = signal<readonly AccessContext[]>([]);

  protected readonly current = computed(() => {
    const session = this.auth.session();
    return session ? key(session) : null;
  });

  protected readonly currentLabel = computed(() => {
    this.language();
    const session = this.auth.session();
    return session ? this.label(session) : '';
  });

  protected readonly options = computed<readonly SelectOption[]>(() => {
    this.language();
    return this.contexts().map((context) => ({ value: key(context), label: this.label(context) }));
  });

  constructor() {
    // Cada persona tiene sus almacenes: se piden de nuevo cuando cambia quién abrió la sesión.
    effect(() => {
      const userId = this.auth.session()?.userId;
      untracked(() => {
        if (userId) void this.active.contexts().then((contexts) => this.contexts.set(contexts));
      });
    });
    // Lo que la cabecera muestra sale de la sesión del servidor: quién y en qué almacén.
    effect(() => {
      const info = this.auth.session();
      untracked(() => {
        if (!info) return;
        this.display.setUser({ name: info.name, initials: initials(info.name) });
        this.display.setWarehouse({ code: info.warehouseId, name: info.warehouseId });
      });
    });
  }

  private label(context: AccessContext): string {
    return this.i18n.translate('shell.warehouse.option', {
      warehouse: context.warehouseId,
      owner: context.ownerId,
    });
  }

  protected async choose(value: unknown): Promise<void> {
    const target = this.contexts().find((context) => key(context) === value);
    if (!target || value === this.current()) return;
    try {
      await this.active.switchTo(target);
    } catch (err) {
      this.field()?.value.set(this.current());
      const code = err instanceof ContextChangeError ? err.code : 'unavailable';
      this.toasts.show('danger', this.i18n.translate(REFUSAL[code]));
    }
  }
}

/** Dos letras para el avatar: la inicial de las dos primeras palabras del nombre. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}
