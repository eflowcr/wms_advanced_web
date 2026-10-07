import { Component, computed, inject } from '@angular/core';
import { SessionContext } from '@ewms/core';
import { AccessStore, type Actor } from '@ewms/core/security';
import { Select, type SelectOption } from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-demo-context',
  imports: [Select, TranslocoPipe],
  template: `
    <aside
      class="flex flex-col gap-3 border-b border-default bg-warning-surface p-4"
      [attr.aria-label]="'security.demo.title' | transloco"
      data-security-demo
    >
      <p class="text-caption text-primary">{{ 'security.demo.notice' | transloco }}</p>
      <div class="grid grid-cols-fields gap-3">
        <ewms-select
          [label]="'security.demo.actor' | transloco"
          [options]="actors()"
          [value]="access.actor()?.userId"
          (valueChange)="selectUser($event)"
        />
        <ewms-select
          [label]="'security.context' | transloco"
          [options]="contexts()"
          [value]="context()"
          (valueChange)="selectContext($event)"
        />
      </div>
    </aside>
  `,
})
export class DemoContext {
  protected readonly access = inject(AccessStore);
  private readonly session = inject(SessionContext);
  private readonly i18n = inject(TranslocoService);
  private readonly language = toSignal(this.i18n.langChanges$);
  protected readonly actors = computed<readonly SelectOption[]>(() => {
    this.language();
    return ['admin', 'reader', 'operator'].map((value) => ({
      value,
      label: this.i18n.translate(`security.demo.${value}`),
    }));
  });
  protected readonly contexts = computed<readonly SelectOption[]>(() => {
    this.language();
    return [
      { value: 'A/X', label: this.i18n.translate('security.demo.ax') },
      { value: 'B/Y', label: this.i18n.translate('security.demo.by') },
    ];
  });
  protected readonly context = computed(
    () => `${this.access.actor()?.warehouseId}/${this.access.actor()?.ownerId}`,
  );
  protected selectUser(value: unknown): void {
    if (typeof value !== 'string' || !['admin', 'reader', 'operator'].includes(value)) return;
    const actor = this.access.actor();
    if (actor) void this.select({ ...actor, userId: value });
  }
  protected selectContext(value: unknown): void {
    const actor = this.access.actor();
    if (!actor || (value !== 'A/X' && value !== 'B/Y')) return;
    const [warehouseId, ownerId] = value.split('/');
    void this.select({ ...actor, warehouseId: warehouseId!, ownerId: ownerId! });
  }
  private async select(actor: Actor): Promise<void> {
    await this.access.select(actor);
    const user = this.access.user();
    if (user)
      this.session.setUser({ name: user.name, initials: user.name.slice(0, 2).toUpperCase() });
    this.session.setWarehouse({ code: actor.warehouseId, name: actor.warehouseId });
  }
}
