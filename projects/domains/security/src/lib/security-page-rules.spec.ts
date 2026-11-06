import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AccessStore, SecurityError } from '@ewms/core/security';
import { DialogService, KeyboardShortcuts, ToastService } from '@ewms/design-system';
import { TranslocoService } from '@jsverse/transloco';
import { MemorySecurityGateway } from './memory-gateway';
import { SecurityPage } from './security-page';

const confirm = vi.fn();

async function page(userId: string, gateway = new MemorySecurityGateway({ latency: 0 })) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: TranslocoService,
        useValue: { langChanges$: of('es'), translate: (key: string) => key },
      },
      { provide: DialogService, useValue: { confirm } },
      { provide: ToastService, useValue: { show: vi.fn() } },
      { provide: KeyboardShortcuts, useValue: { register: vi.fn() } },
    ],
  });
  TestBed.overrideComponent(SecurityPage, { set: { template: '' } });
  await TestBed.inject(AccessStore).connect(gateway, { userId, warehouseId: 'A', ownerId: 'X' }, true);
  const fixture = TestBed.createComponent(SecurityPage);
  fixture.detectChanges();
  await fixture.whenStable();
  await fixture.componentInstance['load']();
  return { page: fixture.componentInstance, gateway };
}

describe('Security page rules', () => {
  beforeEach(() => confirm.mockReset().mockResolvedValue(true));

  it('without profiles access nothing loads', async () => {
    const { page: view } = await page('operator');
    expect(view['snapshot']()).toBeNull();
    expect(view['result']()).toEqual([]);
  });

  it('consultation reads profiles but cannot edit or assign', async () => {
    const { page: view } = await page('reader');
    view['begin'](true);
    expect(view['draft']()).toBeNull();
    const screen = view['screens']()[0]!;
    await view['toggle'](screen, screen.actions[0] ?? '', true);
    expect(view['draft']()).toBeNull();
    view['draft'].set({ id: 'read', name: 'Consultation', grants: [], version: 1 });
    await view['saveProfile']();
    expect(view['error']()).toBe('denied');
    view['assignments'].set([]);
    await view['saveAssignments']();
    expect(view['error']()).toBe('denied');
    view['openBulk']();
    expect(view['bulkOpen']()).toBe(false);
  });

  it('with unsaved changes the selectors keep their value, and a stray value never lands', async () => {
    const { page: view } = await page('admin');
    view['chooseUser'](7);
    view['chooseAssignmentProfile'](7);
    view['chooseContext'](7);
    expect([view['userId'](), view['assignmentProfile'](), view['context']()]).toEqual([
      'reader',
      'read',
      'A/X',
    ]);
    view['begin'](false);
    view['chooseProfile']('read');
    view['chooseUser']('operator');
    expect([view['profileId'](), view['userId']()]).toEqual(['admin', 'reader']);
    view['openBulk']();
    expect(view['bulkOpen']()).toBe(false);
    await view['saveAssignments']();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('reloading falls back to the first profile, person and context that still exist', async () => {
    const { page: view } = await page('admin');
    view['profileId'].set('gone');
    view['userId'].set('gone');
    view['context'].set('Z/Z');
    await view['load']();
    expect([view['profileId'](), view['userId'](), view['context']()]).toEqual(['admin', 'admin', 'A/X']);
    view['profileId'].set('gone');
    view['begin'](false);
    expect(view['draft']()).toBeNull();
    expect(view['capabilityLabel']('unknown.code:access')).toBe(
      'shell.menu.profiles · security.capabilities.access',
    );
  });

  it('a failure that is not the server becomes «unavailable»; an aborted one says nothing', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const { page: view } = await page('admin', gateway);
    vi.spyOn(gateway, 'snapshot').mockRejectedValueOnce(new Error('network'));
    await view['load']();
    expect(view['error']()).toBe('unavailable');
    vi.spyOn(gateway, 'snapshot').mockRejectedValueOnce(new SecurityError('aborted'));
    await view['load']();
    expect(view['error']()).toBe('');
    vi.spyOn(gateway, 'inspect').mockRejectedValueOnce(new SecurityError('delegation'));
    view['chooseContext']('B/Y');
    await vi.waitFor(() => expect(view['error']()).toBe('delegation'));
  });
});
