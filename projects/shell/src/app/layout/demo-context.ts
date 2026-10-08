import { Component, computed, inject, signal } from '@angular/core';
import { AuthSession } from '@ewms/core/security';
import { Select, Toggle, type SelectOption } from '@ewms/design-system';
import { setDemoTaskRunning } from '../demo-mode';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

/** El simulador acepta cualquier contraseña no vacía; cambiar de escenario es iniciar sesión. */
const SIMULATED_PASSWORD = 'demo';

/**
 * Franja del artefacto de demostración: cambia de persona iniciando sesión en el simulador y
 * simula una tarea en ejecución. El almacén se cambia en la cabecera, como en producción.
 */
@Component({
  selector: 'app-demo-context',
  imports: [Select, Toggle, TranslocoPipe],
  // Literal: transloco-keys-manager lee el scope de esta llamada. Solo la demostración lo carga.
  providers: [provideTranslocoScope('demo')],
  template: `
    <aside
      class="flex flex-col gap-3 border-b border-default bg-warning-surface p-4"
      [attr.aria-label]="'demo.title' | transloco"
      data-security-demo
    >
      <p class="text-caption text-primary">{{ 'demo.notice' | transloco }}</p>
      <div class="grid grid-cols-fields items-end gap-3">
        <ewms-select
          [label]="'demo.actor' | transloco"
          [options]="actors()"
          [value]="auth.session()?.userId"
          (valueChange)="selectUser($event)"
        />
        <ewms-toggle
          [label]="'demo.taskRunning' | transloco"
          [checked]="taskRunning()"
          (checkedChange)="setTaskRunning($event)"
        />
      </div>
    </aside>
  `,
})
export class DemoContext {
  protected readonly auth = inject(AuthSession);
  private readonly i18n = inject(TranslocoService);
  private readonly language = toSignal(this.i18n.langChanges$);
  private readonly loaded = toSignal(
    this.i18n.events$.pipe(filter((event) => event.type === 'translationLoadSuccess')),
  );
  protected readonly taskRunning = signal(false);
  protected readonly actors = computed<readonly SelectOption[]>(() => {
    this.language();
    this.loaded();
    /** t(demo.admin, demo.reader, demo.operator) */
    return ['admin', 'reader', 'operator'].map((value) => ({
      value,
      label: this.i18n.translate(`demo.${value}`),
    }));
  });
  protected selectUser(value: unknown): void {
    if (typeof value !== 'string' || !['admin', 'reader', 'operator'].includes(value)) return;
    if (value !== this.auth.session()?.userId)
      void this.auth.signIn({ username: value, password: SIMULATED_PASSWORD });
  }
  protected setTaskRunning(running: boolean): void {
    this.taskRunning.set(running);
    void setDemoTaskRunning?.(running);
  }
}
