import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AccessStore,
  Can,
  SecurityAdministration,
  SecurityError,
  assignableTo,
  type Assignment,
  type SecuritySnapshot,
} from '@ewms/core/security';
import {
  Button,
  Checkbox,
  DatePicker,
  DialogService,
  Select,
  ToastService,
  type DateRange,
  type SelectOption,
} from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

const contextKey = (c: { warehouseId: string; ownerId: string }) => `${c.warehouseId}/${c.ownerId}`;

/**
 * Alta masiva (paso 4): personas × contextos × un perfil generan filas explícitas, que se
 * revisan antes de guardarse de una vez. Nunca ofrece a quien asigna.
 */
@Component({
  selector: 'sec-bulk-assignment',
  imports: [Can, Button, Checkbox, DatePicker, Select, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-assignment.html',
})
export class BulkAssignment {
  readonly snapshot = input.required<SecuritySnapshot>();
  readonly saved = output<void>();
  readonly closed = output<void>();
  private readonly access = inject(AccessStore);
  private readonly admin = inject(SecurityAdministration);
  private readonly i18n = inject(TranslocoService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  protected readonly users = signal<readonly string[]>([]);
  protected readonly contexts = signal<readonly string[]>([]);
  protected readonly profileId = signal('');
  protected readonly validity = signal<DateRange | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly conflicts = signal<readonly string[]>([]);

  protected readonly userOptions = computed(() =>
    this.snapshot().users.filter((u) => u.active && u.id !== this.access.actor()?.userId),
  );
  protected readonly contextOptions = computed(() => this.snapshot().contexts);
  protected readonly profileOptions = computed<readonly SelectOption[]>(() =>
    this.snapshot().profiles.map((p) => ({ value: p.id, label: p.name })),
  );
  protected readonly conflictNames = computed(() =>
    this.conflicts().map((id) => this.profileName(id)).join(', '),
  );

  /** Las filas que se guardarían; lo que ya existe o un externo no puede recibir, se cuenta aparte. */
  protected readonly preview = computed(() => {
    const state = this.snapshot();
    const profile = state.profiles.find((p) => p.id === this.profileId());
    const { from, to } = this.validity() ?? {};
    const rows: Assignment[] = [];
    let skipped = 0;
    if (!profile) return { rows, skipped };
    for (const user of this.userOptions().filter((u) => this.users().includes(u.id))) {
      for (const context of state.contexts.filter((c) => this.contexts().includes(contextKey(c)))) {
        const exists = state.assignments.some(
          (a) =>
            a.userId === user.id && a.profileId === profile.id && contextKey(a) === contextKey(context),
        );
        if (exists || !assignableTo(user, profile, context)) {
          skipped += 1;
          continue;
        }
        rows.push({
          userId: user.id,
          profileId: profile.id,
          ...context,
          validFrom: from || null,
          validUntil: to || null,
        });
      }
    }
    return { rows, skipped };
  });

  protected readonly contextKey = contextKey;

  protected toggleUser(id: string, checked: boolean): void {
    this.users.update((ids) => (checked ? [...ids, id] : ids.filter((u) => u !== id)));
  }
  protected toggleContext(key: string, checked: boolean): void {
    this.contexts.update((keys) => (checked ? [...keys, key] : keys.filter((k) => k !== key)));
  }
  protected chooseProfile(value: unknown): void {
    if (typeof value === 'string') this.profileId.set(value);
  }
  protected chooseValidity(value: unknown): void {
    this.validity.set(value && typeof value === 'object' ? (value as DateRange) : null);
  }

  protected async save(): Promise<void> {
    const { rows, skipped } = this.preview();
    if (rows.length === 0 || this.busy() || !this.access.can('security.profiles:assign')) return;
    const request = this.access.request('security.profiles:assign');
    const approved = await this.dialogs.confirm({
      title: this.i18n.translate('security.bulk.title'),
      body: this.i18n.translate('security.bulk.summary', {
        count: rows.length,
        profile: this.profileName(this.profileId()),
        skipped,
      }),
      variant: 'warning',
      confirmLabel: this.i18n.translate('security.save'),
      cancelLabel: this.i18n.translate('security.cancel'),
    });
    if (!approved || request.signal.aborted) return;
    this.busy.set(true);
    this.error.set('');
    this.conflicts.set([]);
    try {
      await this.admin.addAssignments(request, rows, this.snapshot().version);
      this.toasts.show('success', this.i18n.translate('security.saved'));
      this.saved.emit();
    } catch (error) {
      if (error instanceof SecurityError && error.code === 'aborted') return;
      this.error.set(error instanceof SecurityError ? error.code : 'unavailable');
      this.conflicts.set(error instanceof SecurityError ? error.conflicts : []);
    } finally {
      this.busy.set(false);
    }
  }

  private profileName(id: string): string {
    return this.snapshot().profiles.find((p) => p.id === id)?.name ?? id;
  }
}
