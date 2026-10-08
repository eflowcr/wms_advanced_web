import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { form, FormField, required, minLength, maxLength } from '@angular/forms/signals';
import {
  Can,
  AccessStore,
  ActiveContext,
  SecurityError,
  type Affiliation,
  type SecurityUser,
} from '@ewms/core/security';
import { filtersInUrl } from '@ewms/shared';
import {
  ArrayTableSource,
  Button,
  DialogService,
  EmptyState,
  FilterBar,
  FormPattern,
  Input,
  KeyboardShortcuts,
  Radio,
  RadioGroup,
  Select,
  Table,
  TableColumn,
  ToastService,
  type FilterField,
  type FilterValues,
  type MenuItem,
  type RowMenuEvent,
  type SelectOption,
} from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'sec-users-page',
  imports: [
    Can,
    Button,
    EmptyState,
    FilterBar,
    FormField,
    FormPattern,
    Input,
    Radio,
    RadioGroup,
    Select,
    Table,
    TableColumn,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users-page.html',
})
export class UsersPage {
  protected readonly access = inject(AccessStore);
  private readonly i18n = inject(TranslocoService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly contexts = inject(ActiveContext);
  private readonly language = toSignal(this.i18n.langChanges$);
  private readonly root = viewChild<ElementRef<HTMLElement>>('root');
  protected readonly rows = signal<readonly SecurityUser[] | null>(null);
  protected readonly error = signal('');
  protected readonly draft = signal<SecurityUser | null>(null);
  protected readonly busy = signal(false);
  private pendingFocus: string | null = null;
  private actorKey = '';
  protected readonly model = signal({
    name: '',
    affiliation: 'internal' as Affiliation,
    companyId: '',
  });
  /** Un externo pertenece a una compañía (C5): el propietario de los contextos que se le asignan. */
  protected readonly userForm = form(this.model, (path) => {
    required(path.name);
    minLength(path.name, 2);
    maxLength(path.name, 80);
    required(path.companyId, {
      when: ({ valueOf }) => valueOf(path.affiliation) === 'external',
    });
  });
  protected readonly external = computed(() => this.model().affiliation === 'external');
  protected readonly companies = signal<readonly SelectOption[]>([]);
  private readonly urlFilters = filtersInUrl(['search', 'state']);
  protected readonly filters = computed<FilterValues>(() => {
    const value = this.urlFilters.value();
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  });
  protected readonly fields = computed<readonly FilterField[]>(() => {
    this.language();
    return [
      { kind: 'search', key: 'search', label: this.i18n.translate('security.searchUsers') },
      {
        kind: 'select',
        key: 'state',
        label: this.i18n.translate('security.state'),
        options: [
          { value: 'active', label: this.i18n.translate('security.active') },
          { value: 'inactive', label: this.i18n.translate('security.inactive') },
        ],
      },
    ];
  });
  protected readonly table = computed(() => {
    this.language();
    const filters = this.filters();
    const search = String(filters['search'] ?? '')
      .trim()
      .toLocaleLowerCase();
    const rows = (this.rows() ?? []).filter(
      (u) =>
        `${u.id} ${u.name}`.toLocaleLowerCase().includes(search) &&
        (!filters['state'] || (u.active ? 'active' : 'inactive') === filters['state']),
    );
    return new ArrayTableSource(
      rows.map((u) => ({
        ...u,
        stateLabel: this.i18n.translate(u.active ? 'security.active' : 'security.inactive'),
        affiliationLabel: this.i18n.translate(`security.affiliation.${u.affiliation}`),
        company: u.companyId ?? '—',
      })),
      ['name', 'id'],
    );
  });
  protected readonly byId = (row: SecurityUser): string => row.id;
  protected readonly allowExport = (): boolean => this.access.can('security.users:export');
  protected readonly menuItems = (user: SecurityUser): readonly MenuItem[] => {
    this.language();
    return [
      ...(this.access.can('security.users:update')
        ? [{ id: 'edit', label: this.i18n.translate('security.editUser'), icon: 'edit' as const }]
        : []),
      ...(this.access.can('security.users:deactivate')
        ? [
            {
              id: 'status',
              label: this.i18n.translate(user.active ? 'security.deactivate' : 'security.activate'),
              icon: 'controls' as const,
            },
          ]
        : []),
    ];
  };

  constructor() {
    inject(KeyboardShortcuts).register('create', () => this.begin(null));
    inject(KeyboardShortcuts).register('search', () => this.focus('[data-user-filters] input'));
    effect(() => {
      const ready = this.access.ready();
      this.access.generation();
      const actor = JSON.stringify(this.access.actor());
      untracked(() => {
        if (actor !== this.actorKey) {
          this.actorKey = actor;
          this.draft.set(null);
        }
        const draft = this.draft();
        if (
          ready &&
          draft &&
          !this.access.can(draft.version === 0 ? 'security.users:create' : 'security.users:update')
        )
          this.draft.set(null);
        this.rows.set(null);
        if (ready && this.access.can('security.users:access')) void this.load();
      });
    });
  }

  protected async load(): Promise<void> {
    this.error.set('');
    try {
      const request = this.access.request('security.users:access');
      const [rows] = await Promise.all([this.access.gateway.users(request), this.loadCompanies()]);
      if (!request.signal.aborted) {
        this.rows.set(rows);
        if (this.pendingFocus) {
          this.focus(this.pendingFocus);
          this.pendingFocus = null;
        }
      }
    } catch (error) {
      this.showError(error);
    }
  }
  protected filter(value: FilterValues): void {
    this.urlFilters.set(value);
  }
  protected begin(user: SecurityUser | null): void {
    if (!this.access.can(user ? 'security.users:update' : 'security.users:create')) return;
    this.error.set('');
    this.draft.set(
      user
        ? { ...user }
        : { id: crypto.randomUUID(), name: '', active: true, version: 0, affiliation: 'internal' },
    );
    this.model.set({
      name: user?.name ?? '',
      affiliation: user?.affiliation ?? 'internal',
      companyId: user?.companyId ?? '',
    });
    this.userForm().reset();
    this.focus('[data-user-form] input');
  }
  /** Las compañías que se ofrecen: los propietarios de los contextos de quien administra. */
  private async loadCompanies(): Promise<void> {
    const owners = new Set((await this.contexts.contexts()).map((c) => c.ownerId));
    this.companies.set([...owners].map((id) => ({ value: id, label: id })));
  }

  protected cancel(): void {
    this.draft.set(null);
    this.error.set('');
    this.focus('[data-user-create] button, [data-user-filters] input');
  }
  async canLeave(): Promise<boolean> {
    if (!this.draft() || !this.access.can('security.users:access')) return true;
    return this.dialogs.confirm({
      title: this.i18n.translate('security.unsaved'),
      body: this.i18n.translate('security.discardBody'),
      variant: 'warning',
      confirmLabel: this.i18n.translate('security.discard'),
      cancelLabel: this.i18n.translate('security.continueEditing'),
    });
  }
  protected readonly save = async (): Promise<void> => {
    const draft = this.draft();
    if (!draft || this.busy()) return;
    const capability = draft.version === 0 ? 'security.users:create' : 'security.users:update';
    if (!this.access.can(capability)) {
      this.error.set('denied');
      return;
    }
    const request = this.access.request(capability);
    const { name, affiliation, companyId } = this.model();
    const user = {
      ...draft,
      name,
      affiliation,
      companyId: affiliation === 'external' ? companyId : null,
    };
    await this.write(
      () => this.access.gateway.saveUser(request, user),
      () => this.draft.set(null),
    );
  };
  protected onMenu(event: RowMenuEvent<SecurityUser>): void {
    if (event.item.id === 'edit') this.begin(event.row);
    if (event.item.id === 'status') void this.changeStatus(event.row);
  }
  protected async changeStatus(user: SecurityUser): Promise<void> {
    if (!this.access.can('security.users:deactivate') || this.busy()) return;
    const request = this.access.request('security.users:deactivate');
    if (
      !(await this.dialogs.confirm({
        title: this.i18n.translate(user.active ? 'security.deactivate' : 'security.activate'),
        body: this.i18n.translate('security.statusConfirm', { name: user.name }),
        variant: 'warning',
        confirmLabel: this.i18n.translate('security.confirm'),
        cancelLabel: this.i18n.translate('security.cancel'),
      })) ||
      request.signal.aborted
    )
      return;
    await this.write(
      () => this.access.gateway.setUserStatus(request, user.id, !user.active, user.version),
      () => undefined,
    );
  }
  private async write(operation: () => Promise<void>, complete: () => void): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await operation();
      complete();
      // Cada pantalla recarga lo que acaba de escribir: releer permisos no recarga datos.
      this.rows.set(null);
      void this.load();
      this.toasts.show('success', this.i18n.translate('security.saved'));
      this.pendingFocus = '[data-user-create] button, [data-user-filters] input';
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
  private focus(selector: string): void {
    setTimeout(() => this.root()?.nativeElement.querySelector<HTMLElement>(selector)?.focus());
  }
}
