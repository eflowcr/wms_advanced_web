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
  AccessStore,
  SCREEN_CATALOG,
  effectiveAccess,
  SecurityError,
  type Assignment,
  type Grants,
  type Profile,
  type ScreenDefinition,
  type SecuritySnapshot,
} from '@ewms/core/security';
import {
  Button,
  Checkbox,
  DialogService,
  EmptyState,
  FormPattern,
  Input,
  KeyboardShortcuts,
  Select,
  ToastService,
  type SelectOption,
} from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'sec-security-page',
  imports: [Button, Checkbox, EmptyState, FormField, FormPattern, Input, Select, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './security-page.html',
})
export class SecurityPage {
  protected readonly access = inject(AccessStore);
  private readonly i18n = inject(TranslocoService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly language = toSignal(this.i18n.langChanges$);
  private readonly root = viewChild<ElementRef<HTMLElement>>('root');
  protected readonly snapshot = signal<SecuritySnapshot | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly profileId = signal('admin');
  protected readonly userId = signal('reader');
  protected readonly assignmentProfile = signal('read');
  protected readonly context = signal('A/X');
  protected readonly search = signal('');
  protected readonly onlyGranted = signal(false);
  protected readonly draft = signal<Profile | null>(null);
  protected readonly assignments = signal<readonly Assignment[] | null>(null);
  private assignmentVersion = 0;
  private pendingFocus: string | null = null;
  private actorKey = '';
  private inspectSequence = 0;
  protected readonly inspecting = signal(false);
  private readonly inspected = signal<Grants>({});
  protected readonly name = signal({ name: '' });
  protected readonly profileForm = form(this.name, (path) => {
    required(path.name);
    minLength(path.name, 2);
    maxLength(path.name, 80);
  });
  protected readonly screens = computed(() => {
    this.language();
    const query = this.search().trim().toLocaleLowerCase();
    return SCREEN_CATALOG.filter(
      (s) =>
        `${this.i18n.translate(s.labelKey)} ${this.i18n.translate(this.moduleKey(s))}`
          .toLocaleLowerCase()
          .includes(query) &&
        (!this.onlyGranted() || (s.status !== 'internal' && this.granted(`${s.id}.view`))),
    );
  });
  protected readonly modules = computed(() =>
    ['security.general', 'shell.menu.catalogs', 'shell.menu.settings']
      .map((labelKey) => ({
        labelKey,
        screens: this.screens().filter((s) => this.moduleKey(s) === labelKey),
      }))
      .filter((module) => module.screens.length > 0),
  );
  protected readonly profileSummary = computed(() => {
    const profile = this.draft() ?? this.selectedProfile();
    const screens = SCREEN_CATALOG.filter(
      (s) => s.status !== 'internal' && this.granted(`${s.id}.view`),
    );
    return {
      name: this.draft() ? this.name().name : (profile?.name ?? ''),
      screens: screens.length,
      actions: screens.reduce((count, screen) => count + this.actionCount(screen), 0),
    };
  });

  private moduleKey(screen: ScreenDefinition): string {
    if (screen.route.startsWith('/catalogos/')) return 'shell.menu.catalogs';
    if (screen.route.startsWith('/configuracion/')) return 'shell.menu.settings';
    return 'security.general';
  }
  protected actionCount(screen: ScreenDefinition): number {
    return screen.actions.filter((action) => this.granted(action)).length;
  }
  protected grantState(screen: ScreenDefinition): string {
    if (screen.status === 'internal') return 'security.grantState.common';
    if (!this.granted(`${screen.id}.view`)) return 'security.grantState.denied';
    return this.partial(screen) ? 'security.partial' : 'security.grantState.complete';
  }
  protected readonly profiles = computed<readonly SelectOption[]>(() =>
    (this.snapshot()?.profiles ?? []).map((p) => ({ value: p.id, label: p.name })),
  );
  protected readonly users = computed<readonly SelectOption[]>(() =>
    (this.snapshot()?.users ?? []).map((u) => ({ value: u.id, label: u.name })),
  );
  protected readonly contexts = computed<readonly SelectOption[]>(() =>
    (this.snapshot()?.contexts ?? []).map((c) => ({
      value: `${c.warehouseId}/${c.ownerId}`,
      label: `${c.warehouseId} / ${c.ownerId}`,
    })),
  );
  protected readonly selectedProfile = computed(
    () => this.snapshot()?.profiles.find((p) => p.id === this.profileId()) ?? null,
  );
  protected readonly savedAssignments = computed(
    () => this.snapshot()?.assignments.filter((a) => a.userId === this.userId()) ?? [],
  );
  protected readonly shownAssignments = computed(
    () => this.assignments() ?? this.savedAssignments(),
  );
  protected readonly dirty = computed(() => this.draft() !== null || this.assignments() !== null);
  protected readonly result = computed(() => {
    const state = this.snapshot();
    const [warehouseId, ownerId] = this.context().split('/');
    if (!state || !warehouseId || !ownerId || !this.access.can('profiles.inspect')) return [];
    const grants = this.inspected();
    return Object.entries(grants).map(([capability, sources]) => ({
      capability,
      sources: sources.map((id) => state.profiles.find((p) => p.id === id)?.name ?? id).join(', '),
    }));
  });

  constructor() {
    inject(KeyboardShortcuts).register('create', () => this.begin(true));
    inject(KeyboardShortcuts).register('search', () => this.focus('[data-screen-search] input'));
    effect(() => {
      const state = this.snapshot();
      const userId = this.userId();
      const context = this.context();
      const allowed = this.access.can('profiles.inspect');
      untracked(() => {
        this.inspected.set({});
        this.inspecting.set(false);
        const sequence = ++this.inspectSequence;
        if (!state || !allowed) return;
        const [warehouseId, ownerId] = context.split('/');
        if (!warehouseId || !ownerId) return;
        this.inspecting.set(true);
        const request = this.access.request('profiles.inspect');
        void this.access.gateway
          .inspect(request, { userId, warehouseId, ownerId })
          .then((grants) => {
            if (!request.signal.aborted && sequence === this.inspectSequence)
              this.inspected.set(grants);
          })
          .catch((error: unknown) => {
            if (sequence === this.inspectSequence) this.showError(error);
          })
          .finally(() => {
            if (sequence === this.inspectSequence) this.inspecting.set(false);
          });
      });
    });
    effect(() => {
      const ready = this.access.ready();
      this.access.generation();
      const actor = JSON.stringify(this.access.actor());
      untracked(() => {
        if (actor !== this.actorKey) {
          this.actorKey = actor;
          this.draft.set(null);
          this.assignments.set(null);
        }
        if (ready && !this.access.can('profiles.manage')) this.draft.set(null);
        if (ready && !this.access.can('profiles.assign')) this.assignments.set(null);
        this.snapshot.set(null);
        if (ready && this.access.can('profiles.view')) void this.load();
      });
    });
  }

  protected async load(): Promise<void> {
    this.error.set('');
    try {
      const request = this.access.request('profiles.view');
      const state = await this.access.gateway.snapshot(request);
      if (request.signal.aborted) return;
      this.snapshot.set(state);
      if (this.pendingFocus) {
        this.focus(this.pendingFocus);
        this.pendingFocus = null;
      }
      if (!state.contexts.some((c) => `${c.warehouseId}/${c.ownerId}` === this.context())) {
        const context = state.contexts[0];
        this.context.set(context ? `${context.warehouseId}/${context.ownerId}` : '');
      }
      if (!state.profiles.some((p) => p.id === this.profileId()))
        this.profileId.set(state.profiles[0]?.id ?? '');
      if (!state.users.some((u) => u.id === this.userId()))
        this.userId.set(state.users[0]?.id ?? '');
    } catch (error) {
      this.showError(error);
    }
  }

  protected begin(create: boolean): void {
    if (!this.access.can('profiles.manage')) return;
    const profile = create
      ? { id: crypto.randomUUID(), name: '', grants: [], version: 0 }
      : this.selectedProfile();
    if (!profile) return;
    this.draft.set(structuredClone(profile));
    this.name.set({ name: profile.name });
    this.profileForm().reset();
    this.error.set('');
    this.focus('input');
  }

  protected granted(capability: string): boolean {
    return (this.draft() ?? this.selectedProfile())?.grants.includes(capability) ?? false;
  }
  protected partial(screen: ScreenDefinition): boolean {
    const count = screen.actions.filter((a) => this.granted(a)).length;
    return this.granted(`${screen.id}.view`) && count < screen.actions.length;
  }

  protected async toggle(
    screen: ScreenDefinition,
    capability: string,
    checked: boolean,
  ): Promise<void> {
    const draft = this.draft();
    if (!draft || !this.access.can('profiles.manage')) return;
    const grants = new Set(draft.grants);
    const view = `${screen.id}.view`;
    if (checked && capability !== view && !grants.has(view)) {
      const approved = await this.dialogs.confirm({
        title: this.i18n.translate('security.dependencyTitle'),
        body: this.i18n.translate('security.dependencyBody', {
          screen: this.i18n.translate(screen.labelKey),
        }),
        variant: 'info',
        confirmLabel: this.i18n.translate('security.allowScreen'),
        cancelLabel: this.i18n.translate('security.cancel'),
      });
      if (!approved || this.draft() !== draft || !this.access.can('profiles.manage')) return;
      grants.add(view);
    }
    if (checked) grants.add(capability);
    else grants.delete(capability);
    if (capability === view && !checked) screen.actions.forEach((a) => grants.delete(a));
    this.draft.set({ ...draft, grants: [...grants] });
    if (this.onlyGranted() && capability === view && !checked)
      this.focus('[data-granted-filter] input');
  }

  protected readonly saveProfile = async (): Promise<void> => {
    const draft = this.draft();
    if (!draft || this.busy()) return;
    if (!this.access.can('profiles.manage')) {
      this.error.set('denied');
      return;
    }
    const request = this.access.request('profiles.manage');
    const state = this.snapshot();
    const old = state?.profiles.find((p) => p.id === draft.id);
    const added = draft.grants.filter((g) => !old?.grants.includes(g));
    const removed = old?.grants.filter((g) => !draft.grants.includes(g)) ?? [];
    const affected =
      state?.users
        .filter((u) => state.assignments.some((a) => a.userId === u.id && a.profileId === draft.id))
        .map((u) => u.name)
        .join(', ') || this.i18n.translate('security.none');
    const body = this.i18n.translate('security.summaryBody', {
      name: this.name().name.trim(),
      added: added.map((g) => this.capabilityLabel(g)).join(', ') || '—',
      removed: removed.map((g) => this.capabilityLabel(g)).join(', ') || '—',
      affected,
    });
    if (
      !(await this.dialogs.confirm({
        title: this.i18n.translate('security.summary'),
        body,
        variant: 'warning',
        confirmLabel: this.i18n.translate('security.save'),
        cancelLabel: this.i18n.translate('security.cancel'),
      })) ||
      request.signal.aborted
    )
      return;
    await this.write(
      async () => this.access.gateway.saveProfile(request, { ...draft, name: this.name().name }),
      () => {
        this.profileId.set(draft.id);
        this.draft.set(null);
      },
    );
  };

  protected chooseProfile(value: unknown): void {
    if (typeof value === 'string' && !this.dirty()) this.profileId.set(value);
  }
  protected chooseUser(value: unknown): void {
    if (typeof value === 'string' && !this.dirty()) this.userId.set(value);
  }
  protected chooseAssignmentProfile(value: unknown): void {
    if (typeof value === 'string') this.assignmentProfile.set(value);
  }
  protected chooseContext(value: unknown): void {
    if (typeof value === 'string') this.context.set(value);
  }

  protected addAssignment(): void {
    if (!this.canAssignContext()) return;
    const [warehouseId, ownerId] = this.context().split('/');
    if (
      !warehouseId ||
      !ownerId ||
      !this.snapshot()?.contexts.some((c) => c.warehouseId === warehouseId && c.ownerId === ownerId)
    ) {
      this.error.set('invalid');
      return;
    }
    const row = {
      userId: this.userId(),
      profileId: this.assignmentProfile(),
      warehouseId,
      ownerId,
    };
    const assignments = this.shownAssignments();
    if (
      assignments.some(
        (a) =>
          a.profileId === row.profileId && a.warehouseId === warehouseId && a.ownerId === ownerId,
      )
    ) {
      this.error.set('duplicate');
      return;
    }
    this.startAssignments();
    this.assignments.set([...assignments, row]);
  }
  protected removeAssignment(row: Assignment): void {
    if (!this.canAssign(row)) return;
    this.startAssignments();
    this.assignments.set(this.shownAssignments().filter((a) => a !== row));
  }
  private startAssignments(): void {
    if (this.assignments() === null) this.assignmentVersion = this.snapshot()?.version ?? 0;
  }
  protected async saveAssignments(): Promise<void> {
    const assignments = this.assignments();
    if (!assignments || this.busy()) return;
    if (!this.access.can('profiles.assign')) {
      this.error.set('denied');
      return;
    }
    const request = this.access.request('profiles.assign');
    const key = (a: Assignment) => `${a.profileId} · ${a.warehouseId}/${a.ownerId}`;
    const describe = (a: Assignment) =>
      `${this.profileName(a.profileId)} · ${a.warehouseId}/${a.ownerId}`;
    const saved = this.savedAssignments();
    const added =
      assignments
        .filter((a) => !saved.some((b) => key(a) === key(b)))
        .map(describe)
        .join(', ') || '—';
    const removed =
      saved
        .filter((a) => !assignments.some((b) => key(a) === key(b)))
        .map(describe)
        .join(', ') || '—';
    const body = this.i18n.translate('security.assignmentSummary', {
      name: this.snapshot()?.users.find((u) => u.id === this.userId())?.name ?? this.userId(),
      count: assignments.length,
      added,
      removed,
    });
    if (
      !(await this.dialogs.confirm({
        title: this.i18n.translate('security.summary'),
        body,
        variant: 'warning',
        confirmLabel: this.i18n.translate('security.save'),
        cancelLabel: this.i18n.translate('security.cancel'),
      })) ||
      request.signal.aborted
    )
      return;
    await this.write(
      () =>
        this.access.gateway.setAssignments(
          request,
          this.userId(),
          assignments,
          this.assignmentVersion,
        ),
      () => this.assignments.set(null),
    );
  }
  protected cancel(): void {
    this.draft.set(null);
    this.assignments.set(null);
    this.error.set('');
    this.focus('[data-profile-edit] button');
  }
  async canLeave(): Promise<boolean> {
    if (!this.dirty() || !this.access.can('profiles.view')) return true;
    return this.dialogs.confirm({
      title: this.i18n.translate('security.unsaved'),
      body: this.i18n.translate('security.discardBody'),
      variant: 'warning',
      confirmLabel: this.i18n.translate('security.discard'),
      cancelLabel: this.i18n.translate('security.continueEditing'),
    });
  }
  protected profileName(id: string): string {
    return this.snapshot()?.profiles.find((p) => p.id === id)?.name ?? id;
  }
  protected canAssign(row: { warehouseId: string; ownerId: string }): boolean {
    const state = this.snapshot();
    const actor = this.access.actor();
    return (
      state !== null &&
      actor !== null &&
      this.access.ready() &&
      (effectiveAccess(state, { ...actor, warehouseId: row.warehouseId, ownerId: row.ownerId })[
        'profiles.assign'
      ]?.length ?? 0) > 0
    );
  }
  protected canAssignContext(): boolean {
    const [warehouseId, ownerId] = this.context().split('/');
    return this.canAssign({ warehouseId: warehouseId ?? '', ownerId: ownerId ?? '' });
  }
  protected capabilityLabel(capability: string): string {
    const screen = SCREEN_CATALOG.find(
      (s) => `${s.id}.view` === capability || s.actions.includes(capability),
    );
    return `${this.i18n.translate(screen?.labelKey ?? 'shell.menu.profiles')} · ${this.i18n.translate(`security.capabilities.${capability.endsWith('.view') ? 'view' : capability}`)}`;
  }
  private async write(operation: () => Promise<void>, complete: () => void): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await operation();
      complete();
      this.toasts.show('success', this.i18n.translate('security.saved'));
      this.pendingFocus = '[data-profile-edit] button';
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
