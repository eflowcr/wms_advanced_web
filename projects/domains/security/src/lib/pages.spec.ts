import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import {
  AccessStore,
  ActiveContext,
  SENSITIVE_CAPABILITIES,
  SecurityError,
} from '@ewms/core/security';
import { DialogService, KeyboardShortcuts, ToastService } from '@ewms/design-system';
import { TranslocoService } from '@jsverse/transloco';
import { MemorySecurityGateway } from './memory-gateway';
import { SecurityPage } from './security-page';
import { UsersPage } from './users-page';

const admin = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };
const confirmation = vi.fn().mockResolvedValue(true);
const toast = vi.fn();

async function setup(userId = 'admin', sensitive: readonly string[] | null = null) {
  TestBed.configureTestingModule({
    providers: [
      ...(sensitive ? [{ provide: SENSITIVE_CAPABILITIES, useValue: sensitive }] : []),
      {
        provide: TranslocoService,
        useValue: { langChanges$: of('es'), translate: (key: string) => key },
      },
      { provide: DialogService, useValue: { confirm: confirmation } },
      { provide: ToastService, useValue: { show: toast } },
      { provide: KeyboardShortcuts, useValue: { register: vi.fn() } },
      { provide: ActivatedRoute, useValue: { queryParams: of({}), snapshot: { queryParams: {} } } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      {
        provide: ActiveContext,
        useValue: {
          contexts: () =>
            Promise.resolve([
              { warehouseId: 'A', ownerId: 'X' },
              { warehouseId: 'B', ownerId: 'Y' },
            ]),
        },
      },
    ],
  });
  const gateway = new MemorySecurityGateway({ latency: 0 });
  const access = TestBed.inject(AccessStore);
  await access.connect(gateway, { ...admin, userId }, true);
  confirmation.mockResolvedValue(true);
  return { gateway, access };
}

async function securityPage() {
  const fixture = TestBed.createComponent(SecurityPage);
  fixture.detectChanges();
  await fixture.whenStable();
  await fixture.componentInstance['load']();
  return fixture.componentInstance;
}

describe('Security page operations', () => {
  beforeEach(() => TestBed.overrideComponent(SecurityPage, { set: { template: '' } }));
  it('requires explicit dependency approval and cancel never changes saved grants', async () => {
    const { access } = await setup();
    const fixture = TestBed.createComponent(SecurityPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    await page['load']();
    page['begin'](true);
    const screen = page['screens']().find((s) => s.id === 'users')!;
    confirmation.mockResolvedValueOnce(false);
    await page['toggle'](screen, 'security.users:export', true);
    expect(page['granted']('security.users:export')).toBe(false);
    await page['toggle'](screen, 'security.users:export', true);
    expect(page['granted']('security.users:access')).toBe(true);
    expect(page['granted']('security.users:export')).toBe(true);
    await page['toggle'](screen, 'security.users:access', false);
    expect(page['granted']('security.users:export')).toBe(false);
    page['cancel']();
    expect(page['draft']()).toBeNull();
    expect(access.can('security.users:export')).toBe(true);
  });
  it('shows stale edit errors while retaining the draft and does not retry a rejected save', async () => {
    const { gateway } = await setup();
    const fixture = TestBed.createComponent(SecurityPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    await page['load']();
    page['begin'](false);
    page['name'].set({ name: 'Changed administrator' });
    gateway.failNext('conflict');
    const save = vi.spyOn(gateway, 'saveProfile');
    await page['saveProfile']();
    expect(save).toHaveBeenCalledTimes(1);
    expect(page['error']()).toBe('conflict');
    expect(page['draft']()).not.toBeNull();
    expect(await page.canLeave()).toBe(true);
    confirmation.mockResolvedValueOnce(false);
    expect(await page.canLeave()).toBe(false);
  });
  it('detects assignment duplicates and preserves saved assignments on cancel', async () => {
    await setup();
    const fixture = TestBed.createComponent(SecurityPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    await page['load']();
    page['addAssignment']();
    expect(page['error']()).toBe('duplicate');
    const existing = page['shownAssignments']()[0]!;
    page['removeAssignment'](existing);
    expect(page['shownAssignments']()).toHaveLength(1);
    page['cancel']();
    expect(page['shownAssignments']()).toHaveLength(2);
  });
  it('does not expose administrative execution to consultation', async () => {
    await setup('reader');
    const fixture = TestBed.createComponent(SecurityPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    await page['load']();
    page['begin'](true);
    page['addAssignment']();
    expect(page['draft']()).toBeNull();
    expect(page['assignments']()).toBeNull();
    expect(await page.canLeave()).toBe(true);
  });
  it('reviews and saves assignment deltas with user-facing profile names', async () => {
    const { gateway } = await setup();
    const fixture = TestBed.createComponent(SecurityPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    await page['load']();
    page['removeAssignment'](page['shownAssignments']()[0]!);
    await page['saveAssignments']();
    expect(confirmation).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'security.summary' }),
    );
    expect(page['assignments']()).toBeNull();
    const saved = await gateway.snapshot({ actor: admin, signal: new AbortController().signal });
    expect(saved.assignments.filter((a) => a.userId === 'reader')).toEqual([
      { userId: 'reader', profileId: 'read', warehouseId: 'B', ownerId: 'Y' },
    ]);
  });

  it('never offers editing the own assignments (C6)', async () => {
    await setup();
    const page = await securityPage();
    page['chooseUser']('admin');
    expect(page['ownSelection']()).toBe(true);
    page['addAssignment']();
    page['removeAssignment'](page['shownAssignments']()[0]!);
    expect(page['assignments']()).toBeNull();
    page['chooseUser']('reader');
    expect(page['ownSelection']()).toBe(false);
  });
  it('offers an external user only its company and profiles without internal modules (C5)', async () => {
    await setup();
    const page = await securityPage();
    page['chooseUser']('external');
    expect(page['assignmentProfiles']().map((o) => o.value)).toEqual(['catalogs']);
    expect(page['contexts']().map((o) => o.value)).toEqual(['B/Y']);
    expect(page['context']()).toBe('B/Y');
    page['chooseUser']('reader');
    expect(page['assignmentProfiles']().map((o) => o.value)).toContain('admin');
    expect(page['contexts']()).toHaveLength(2);
  });
  it('shows the segregation rejection with the profiles in conflict and keeps the draft', async () => {
    await setup();
    const page = await securityPage();
    page['chooseUser']('reader');
    for (const profile of ['admin', 'audit']) {
      page['chooseAssignmentProfile'](profile);
      page['addAssignment']();
    }
    await page['saveAssignments']();
    expect(page['error']()).toBe('segregation');
    expect(page['conflictNames']()).toBe('Administrator, Access audit');
    expect(page['assignments']()).not.toBeNull();
  });
  it('saves the validity of a new assignment and tells scheduled from expired', async () => {
    const { gateway } = await setup();
    const page = await securityPage();
    page['chooseUser']('operator');
    page['chooseAssignmentProfile']('audit');
    page['chooseContext']('B/Y');
    page['chooseValidity']({ from: '2999-11-01', to: '2999-11-30' });
    page['addAssignment']();
    await page['saveAssignments']();
    const saved = await gateway.snapshot({ actor: admin, signal: new AbortController().signal });
    const row = saved.assignments.find((a) => a.userId === 'operator' && a.profileId === 'audit')!;
    expect(row).toMatchObject({ validFrom: '2999-11-01', validUntil: '2999-11-30' });
    expect(page['validityState'](row)).toBe('scheduled');
    expect(page['validityState']({ ...row, validFrom: null, validUntil: '2000-01-01' })).toBe(
      'expired',
    );
    expect(page['validityState']({ ...row, validFrom: null, validUntil: null })).toBe('inForce');
  });
  it('marks the sensitive permissions of the catalog and none by default', async () => {
    await setup();
    expect((await securityPage())['sensitive']('security.users:deactivate')).toBe(false);
    TestBed.resetTestingModule();
    TestBed.overrideComponent(SecurityPage, { set: { template: '' } });
    await setup('admin', ['security.users:deactivate']);
    expect((await securityPage())['sensitive']('security.users:deactivate')).toBe(true);
  });
});

describe('Users page operations', () => {
  beforeEach(() => TestBed.overrideComponent(UsersPage, { set: { template: '' } }));
  it('creates a stable user, keeps status separate from editing and can cancel', async () => {
    const { gateway } = await setup();
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    await page['load']();
    page['begin'](null);
    const id = page['draft']()!.id;
    page['model'].set({ name: '=1+1', affiliation: 'internal', companyId: '' });
    await page['save']();
    expect(page['draft']()).toBeNull();
    const user = (await gateway.users({ actor: admin, signal: new AbortController().signal })).find(
      (u) => u.id === id,
    )!;
    expect(user.name).toBe('=1+1');
    page['begin'](user);
    page['model'].set({ name: 'Discarded', affiliation: 'internal', companyId: '' });
    page['cancel']();
    expect(user.name).toBe('=1+1');
    await page['changeStatus'](user);
    expect(
      (await gateway.users({ actor: admin, signal: new AbortController().signal })).find(
        (u) => u.id === id,
      )?.active,
    ).toBe(false);
  });
  it('uses the same checks for direct creation, menu edit, status and export', async () => {
    const { access } = await setup('reader');
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    await page['load']();
    const user = page['rows']()![0]!;
    page['begin'](null);
    page['onMenu']({ row: user, item: { id: 'edit', label: 'Edit' } });
    await page['changeStatus'](user);
    expect(page['draft']()).toBeNull();
    expect(page['menuItems'](user)).toEqual([]);
    expect(page['allowExport']()).toBe(false);
    expect(() => access.request('security.users:export')).toThrow(new SecurityError('denied'));
  });
  it('retains a user draft on conflict and exposes an explicit reload path', async () => {
    const { gateway } = await setup();
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    await page['load']();
    page['begin'](page['rows']()![1]!);
    gateway.failNext('conflict');
    await page['save']();
    expect(page['draft']()).not.toBeNull();
    expect(page['error']()).toBe('conflict');
    page['cancel']();
    expect(await page.canLeave()).toBe(true);
  });

  it('creates an external user of a company and shows the affiliation', async () => {
    const { gateway } = await setup();
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    await page['load']();
    page['begin'](null);
    const id = page['draft']()!.id;
    page['model'].set({ name: 'Proveedor externo', affiliation: 'external', companyId: '' });
    expect(page['userForm']().valid()).toBe(false);
    page['model'].set({ name: 'Proveedor externo', affiliation: 'external', companyId: 'Y' });
    expect(page['userForm']().valid()).toBe(true);
    await page['save']();
    const user = (await gateway.users({ actor: admin, signal: new AbortController().signal })).find(
      (u) => u.id === id,
    );
    expect(user).toMatchObject({ affiliation: 'external', companyId: 'Y' });
    page['begin'](user!);
    page['model'].update((m) => ({ ...m, affiliation: 'internal' }));
    await page['save']();
    expect(
      (await gateway.users({ actor: admin, signal: new AbortController().signal })).find(
        (u) => u.id === id,
      ),
    ).toMatchObject({ affiliation: 'internal', companyId: null });
  });
});
