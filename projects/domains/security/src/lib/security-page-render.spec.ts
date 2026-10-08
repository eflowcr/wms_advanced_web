import { ApplicationInitStatus } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { EMPTY } from 'rxjs';
import {
  AccessStore,
  SecurityAdministration,
  SecurityError,
  SENSITIVE_CAPABILITIES,
} from '@ewms/core/security';
import {
  Checkbox,
  DatePicker,
  DialogService,
  KeyboardShortcuts,
  Select,
  ToastService,
} from '@ewms/design-system';
import { provideI18nTesting } from '@ewms/testing';
import { TranslocoService } from '@jsverse/transloco';
import { AccessReview } from './access-review';
import { BulkAssignment } from './bulk-assignment';
import { MemorySecurityGateway } from './memory-gateway';
import { SecurityPage } from './security-page';
import { provideSecurityRendering } from './security.testing';

const confirm = vi.fn();
const toast = vi.fn();

async function render(userId = 'admin', gateway = new MemorySecurityGateway({ latency: 0 })) {
  TestBed.configureTestingModule({
    providers: [
      provideI18nTesting({ es: {}, en: {} }),
      ...provideSecurityRendering(),
      { provide: DialogService, useValue: { confirm } },
      { provide: ToastService, useValue: { show: toast } },
      { provide: KeyboardShortcuts, useValue: { register: vi.fn(), events: EMPTY } },
      { provide: SecurityAdministration, useValue: gateway },
      { provide: SENSITIVE_CAPABILITIES, useValue: ['security.users:export'] },
    ],
  });
  await TestBed.inject(ApplicationInitStatus).donePromise;
  TestBed.inject(TranslocoService).setActiveLang('es');
  await TestBed.inject(AccessStore).connect(gateway, { userId, warehouseId: 'A', ownerId: 'X' }, true);
  const fixture = TestBed.createComponent(SecurityPage);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return { fixture, gateway, page: fixture.componentInstance };
}

type Fixture = ComponentFixture<SecurityPage>;
const root = (fixture: Fixture): HTMLElement => fixture.nativeElement as HTMLElement;
const ready = (fixture: Fixture) =>
  vi.waitFor(() => expect(root(fixture).querySelector('[data-permission-matrix]')).not.toBeNull());
const button = (fixture: Fixture, text: string): HTMLButtonElement =>
  [...root(fixture).querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === text,
  )!;
const select = (fixture: Fixture, label: string) =>
  fixture.debugElement
    .queryAll(By.directive(Select))
    .find((de) => (de.componentInstance as Select).label() === label)!;
/** Las casillas de una pantalla de la matriz: Acceder primero, después sus acciones. */
const boxes = (fixture: Fixture, screenLabel: string) =>
  fixture.debugElement
    .queryAll(By.css('fieldset'))
    .find((de) => de.query(By.css('legend')).nativeElement.textContent.includes(screenLabel))!
    .queryAll(By.directive(Checkbox));

describe('Security page, rendered', () => {
  beforeEach(() => {
    confirm.mockReset().mockResolvedValue(true);
    toast.mockReset();
  });

  it('a failed load is an alert with reload, and reload brings the page back', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const snapshot = vi.spyOn(gateway, 'snapshot').mockRejectedValueOnce(new SecurityError('unavailable'));
    const { fixture } = await render('admin', gateway);
    await vi.waitFor(() =>
      expect(root(fixture).querySelector('[role="alert"]')?.textContent).toContain(
        'security.errors.unavailable',
      ),
    );
    snapshot.mockRestore();
    button(fixture, 'security.reload').click();
    await ready(fixture);
    expect(root(fixture).querySelector('[role="alert"]')).toBeNull();
  });

  it('without profiles access the page is an empty state', async () => {
    const { fixture } = await render('external');
    await fixture.whenStable();
    expect(root(fixture).querySelector('ewms-empty-state')).not.toBeNull();
    expect(root(fixture).querySelector('[data-permission-matrix]')).toBeNull();
  });

  it('creates a profile from the matrix: a dependency is asked, a sensitive action is marked', async () => {
    const { fixture, page } = await render();
    await ready(fixture);
    select(fixture, 'security.profile').triggerEventHandler('valueChange', 'read');
    expect(page['profileId']()).toBe('read');
    button(fixture, 'security.createProfile').click();
    await fixture.whenStable();
    expect(root(fixture).querySelector('[data-profile-form]')).not.toBeNull();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(root(fixture).querySelector('[data-profile-form] input')),
    );
    expect(root(fixture).querySelector('[data-unsaved], [role="status"]')).not.toBeNull();
    const users = boxes(fixture, 'shell.menu.users');
    expect(root(fixture).querySelector('[data-sensitive]')).not.toBeNull();
    users[1]!.triggerEventHandler('checkedChange', true);
    await vi.waitFor(() => expect(page['granted']('security.users:access')).toBe(true));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'security.dependencyTitle' }));
    users[0]!.triggerEventHandler('checkedChange', false);
    await fixture.whenStable();
    expect(page['granted']('security.users:access')).toBe(false);
    page['name'].set({ name: 'Auditoría' });
    users[0]!.triggerEventHandler('checkedChange', true);
    confirm.mockResolvedValueOnce(false);
    await page['saveProfile']();
    expect(page['draft']()).not.toBeNull();
    await page['saveProfile']();
    await vi.waitFor(() => expect(page['draft']()).toBeNull());
    expect(toast).toHaveBeenCalledWith('success', 'security.saved');
    await vi.waitFor(() =>
      expect(page['profiles']().some((option) => option.label === 'Auditoría')).toBe(true),
    );
  });

  it('a rejected profile save shows the conflict and keeps the draft', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    vi.spyOn(gateway, 'saveProfile').mockRejectedValueOnce(
      new SecurityError('segregation', ['Access audit']),
    );
    const { fixture, page } = await render('admin', gateway);
    await ready(fixture);
    page['begin'](false);
    page['name'].set({ name: 'Administrator' });
    await page['saveProfile']();
    await fixture.whenStable();
    expect(root(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'security.errors.segregation',
    );
    expect(page['draft']()).not.toBeNull();
  });

  it('edits assignments: adds, refuses a duplicate or an unknown context, removes and saves', async () => {
    const { fixture, page } = await render();
    await ready(fixture);
    select(fixture, 'security.user').triggerEventHandler('valueChange', 'operator');
    select(fixture, 'security.context').triggerEventHandler('valueChange', 'B/Y');
    select(fixture, 'security.profile').triggerEventHandler('valueChange', 'catalogs');
    await fixture.whenStable();
    const assignmentProfile = fixture.debugElement
      .queryAll(By.directive(Select))
      .filter((de) => (de.componentInstance as Select).label() === 'security.profile')
      .at(-1)!;
    assignmentProfile.triggerEventHandler('valueChange', 'catalogs');
    fixture.debugElement
      .query(By.directive(DatePicker))
      .triggerEventHandler('valueChange', { from: '2999-01-01', to: '2999-12-31' });
    button(fixture, 'security.addAssignment').click();
    await fixture.whenStable();
    expect(page['assignments']()?.at(-1)).toEqual(
      expect.objectContaining({ profileId: 'catalogs', validFrom: '2999-01-01' }),
    );
    expect(page['validityState'](page['assignments']()!.at(-1)!)).toBe('scheduled');
    expect(page['validityState']({ ...page['assignments']()!.at(-1)!, validFrom: null, validUntil: '2000-01-01' })).toBe('expired');
    button(fixture, 'security.addAssignment').click();
    expect(page['error']()).toBe('duplicate');
    const before = page['assignments']();
    page['chooseContext']('Z/Z');
    expect(page['canAssignContext']()).toBe(false);
    page['addAssignment']();
    expect(page['assignments']()).toBe(before);
    page['chooseContext']('B/Y');
    const remove = [...root(fixture).querySelectorAll<HTMLButtonElement>('[data-assignments] button')];
    remove[0]!.click();
    await fixture.whenStable();
    const count = page['assignments']()!.length;
    confirm.mockResolvedValueOnce(false);
    button(fixture, 'security.reviewSave').click();
    await fixture.whenStable();
    expect(page['assignments']()?.length).toBe(count);
    button(fixture, 'security.reviewSave').click();
    await vi.waitFor(() => expect(page['assignments']()).toBeNull());
    expect(toast).toHaveBeenCalledWith('success', 'security.saved');
  });

  it('an external user is offered only its company, and cancel drops the edits', async () => {
    const { fixture, page } = await render();
    await ready(fixture);
    select(fixture, 'security.user').triggerEventHandler('valueChange', 'external');
    await fixture.whenStable();
    expect(page['contexts']().map((c) => c.value)).toEqual(['B/Y']);
    expect(root(fixture).querySelector('[data-affiliation]')?.textContent).toContain('Y');
    page['assignmentProfile'].set('admin');
    page['addAssignment']();
    expect(page['error']()).toBe('externalAffiliation');
    page['chooseAssignmentProfile']('catalogs');
    page['chooseValidity'](null);
    page['addAssignment']();
    expect(page['error']()).toBe('duplicate');
    page['removeAssignment'](page['shownAssignments']()[0]!);
    await fixture.whenStable();
    expect(root(fixture).querySelector('[data-assignments] ewms-empty-state')).not.toBeNull();
    expect(await page.canLeave()).toBe(true);
    button(fixture, 'security.cancel').click();
    await fixture.whenStable();
    expect(page['assignments']()).toBeNull();
  });

  it('bulk assignment opens, closes, and reloads the page once saved', async () => {
    const { fixture, page } = await render();
    await ready(fixture);
    root(fixture).querySelector<HTMLButtonElement>('[data-bulk-open] button')!.click();
    await fixture.whenStable();
    const bulk = () => fixture.debugElement.query(By.directive(BulkAssignment));
    expect(bulk()).not.toBeNull();
    bulk().triggerEventHandler('closed');
    await fixture.whenStable();
    expect(bulk()).toBeNull();
    page['openBulk']();
    await fixture.whenStable();
    const load = vi.spyOn(page as unknown as { load: () => Promise<void> }, 'load');
    bulk().triggerEventHandler('saved');
    await vi.waitFor(() => expect(bulk()).toBeNull());
    expect(load).toHaveBeenCalled();
    await ready(fixture);
  });

  it('a revocation in the access review reloads the assignments', async () => {
    const { fixture, page, gateway } = await render();
    await ready(fixture);
    const load = vi.spyOn(gateway, 'snapshot');
    fixture.debugElement.query(By.directive(AccessReview)).triggerEventHandler('changed');
    await ready(fixture);
    expect(load).toHaveBeenCalled();
    expect(page['capabilityKey']('not-a-code')).toBe('security.capabilities.access');
  });
});
