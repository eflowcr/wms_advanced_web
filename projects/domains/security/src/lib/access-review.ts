import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { form, FormField, maxLength, minLength, required } from '@angular/forms/signals';
import {
  AccessStore,
  Can,
  SecurityAdministration,
  SecurityError,
  type ReviewCampaign,
  type ReviewDecision,
  type ReviewItem,
  type SecuritySnapshot,
} from '@ewms/core/security';
import {
  Badge,
  Button,
  DatePicker,
  DialogService,
  EmptyState,
  FormPattern,
  Input,
  Select,
  ToastService,
  type SelectOption,
} from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

const REVIEW = 'security.profiles:review';

/**
 * Revisión de accesos (paso 4): una campaña congela las asignaciones vigentes y cada una recibe
 * confirmar o retirar, con autor y fecha. Nadie decide sobre su propio acceso.
 */
@Component({
  selector: 'sec-access-review',
  imports: [Can, Badge, Button, DatePicker, EmptyState, FormField, FormPattern, Input, Select, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './access-review.html',
})
export class AccessReview {
  readonly snapshot = input.required<SecuritySnapshot>();
  /** Una revocación cambió asignaciones: quien contiene la revisión recarga las suyas. */
  readonly changed = output<void>();
  protected readonly access = inject(AccessStore);
  private readonly admin = inject(SecurityAdministration);
  private readonly i18n = inject(TranslocoService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  protected readonly campaigns = signal<readonly ReviewCampaign[] | null>(null);
  protected readonly campaignId = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly starting = signal(false);
  protected readonly model = signal({ name: '', dueDate: '' });
  protected readonly startForm = form(this.model, (path) => {
    required(path.name);
    minLength(path.name, 2);
    maxLength(path.name, 80);
    required(path.dueDate);
  });

  protected readonly campaign = computed(
    () =>
      this.campaigns()?.find((c) => c.id === this.campaignId()) ?? this.campaigns()?.at(-1) ?? null,
  );
  protected readonly campaignOptions = computed<readonly SelectOption[]>(() =>
    (this.campaigns() ?? []).map((c) => ({ value: c.id, label: c.name })),
  );
  protected readonly progress = computed(() => {
    const items = this.campaign()?.items ?? [];
    return { decided: items.filter((i) => i.decision !== null).length, total: items.length };
  });

  constructor() {
    effect(() => {
      const ready = this.access.ready();
      this.access.generation();
      untracked(() => {
        this.campaigns.set(null);
        if (ready && this.access.can(REVIEW)) void this.load();
      });
    });
  }

  protected async load(): Promise<void> {
    try {
      const request = this.access.request(REVIEW);
      const campaigns = await this.admin.reviews(request);
      if (!request.signal.aborted) this.campaigns.set(campaigns);
    } catch (error) {
      this.showError(error);
    }
  }

  protected own(item: ReviewItem): boolean {
    return item.userId === this.access.actor()?.userId;
  }
  protected userName(id: string | null): string {
    return this.snapshot().users.find((u) => u.id === id)?.name ?? id ?? '';
  }
  protected profileName(id: string): string {
    return this.snapshot().profiles.find((p) => p.id === id)?.name ?? id;
  }
  protected authorName(item: ReviewItem): string {
    return this.userName(item.decidedBy);
  }
  protected chooseCampaign(value: unknown): void {
    if (typeof value === 'string') this.campaignId.set(value);
  }

  protected readonly start = async (): Promise<void> => {
    if (!this.startForm().valid() || this.busy() || !this.access.can(REVIEW)) return;
    const request = this.access.request(REVIEW);
    const { name, dueDate } = this.model();
    await this.write(async () => {
      await this.admin.startReview(request, { name: name.trim(), dueDate });
      this.starting.set(false);
      this.campaignId.set('');
      this.model.set({ name: '', dueDate: '' });
    });
  };

  protected async decide(item: ReviewItem, decision: ReviewDecision): Promise<void> {
    const campaign = this.campaign();
    if (!campaign || this.own(item) || item.decision || this.busy() || !this.access.can(REVIEW))
      return;
    const request = this.access.request(REVIEW);
    if (
      decision === 'revoke' &&
      !(await this.dialogs.confirm({
        title: this.i18n.translate('security.review.revokeTitle'),
        body: this.i18n.translate('security.review.revokeBody', {
          user: this.userName(item.userId),
          profile: this.profileName(item.profileId),
          context: `${item.warehouseId}/${item.ownerId}`,
        }),
        variant: 'warning',
        confirmLabel: this.i18n.translate('security.review.revoke'),
        cancelLabel: this.i18n.translate('security.cancel'),
      }))
    )
      return;
    await this.write(async () => {
      await this.admin.decide(request, campaign.id, item, decision, campaign.version);
      this.campaignId.set(campaign.id);
      if (decision === 'revoke') this.changed.emit();
    });
  }

  /** Cada escritura relee las campañas: la versión y las decisiones son del servidor. */
  private async write(operation: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await operation();
      this.toasts.show('success', this.i18n.translate('security.saved'));
      await this.load();
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy.set(false);
    }
  }
  private showError(error: unknown): void {
    if (error instanceof SecurityError && error.code === 'aborted') return;
    this.error.set(error instanceof SecurityError ? error.code : 'unavailable');
  }
}
