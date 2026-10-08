import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AccessStore, SecurityAdministration } from '@ewms/core/security';
import { DialogService, ToastService } from '@ewms/design-system';
import { TranslocoService } from '@jsverse/transloco';
import { BulkAssignment } from './bulk-assignment';
import { MemorySecurityGateway } from './memory-gateway';

const admin = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };
const confirmation = vi.fn().mockResolvedValue(true);

async function setup() {
  const gateway = new MemorySecurityGateway({ latency: 0 });
  TestBed.configureTestingModule({
    providers: [
      {
        provide: TranslocoService,
        useValue: { langChanges$: of('es'), translate: (key: string) => key },
      },
      { provide: DialogService, useValue: { confirm: confirmation } },
      { provide: ToastService, useValue: { show: vi.fn() } },
      { provide: SecurityAdministration, useValue: gateway },
    ],
  });
  TestBed.overrideComponent(BulkAssignment, { set: { template: '' } });
  await TestBed.inject(AccessStore).connect(gateway, admin, true);
  const snapshot = await gateway.snapshot({ actor: admin, signal: new AbortController().signal });
  const fixture = TestBed.createComponent(BulkAssignment);
  fixture.componentRef.setInput('snapshot', snapshot);
  fixture.detectChanges();
  return { gateway, snapshot, fixture, bulk: fixture.componentInstance };
}

describe('Bulk assignment', () => {
  it('generates one explicit row per user and context, without the actor', async () => {
    const { bulk } = await setup();
    expect(bulk['userOptions']().map((u) => u.id)).not.toContain('admin');
    bulk['toggleUser']('reader', true);
    bulk['toggleUser']('operator', true);
    bulk['toggleUser']('external', true);
    bulk['toggleContext']('A/X', true);
    bulk['toggleContext']('B/Y', true);
    bulk['profileId'].set('audit');
    bulk['validity'].set({ to: '2999-12-31' });
    const { rows, skipped } = bulk['preview']();
    expect(rows).toEqual(
      ['reader', 'operator'].flatMap((userId) =>
        ['A/X', 'B/Y'].map((context) => ({
          userId,
          profileId: 'audit',
          warehouseId: context[0],
          ownerId: context[2],
          validFrom: null,
          validUntil: '2999-12-31',
        })),
      ),
    );
    // Un externo no recibe módulos internos: sus filas se omiten y se cuentan.
    expect(skipped).toBe(2);
  });

  it('leaves out rows that already exist', async () => {
    const { bulk } = await setup();
    bulk['toggleUser']('reader', true);
    bulk['toggleContext']('A/X', true);
    bulk['profileId'].set('read');
    expect(bulk['preview']()).toEqual({ rows: [], skipped: 1 });
  });

  it('saves every row at once, then reports a rejection with the profiles in conflict', async () => {
    const { bulk, gateway, snapshot, fixture } = await setup();
    const add = vi.spyOn(gateway, 'addAssignments');
    const saved = vi.fn();
    bulk.saved.subscribe(saved);
    bulk['toggleUser']('reader', true);
    bulk['toggleUser']('operator', true);
    bulk['toggleContext']('A/X', true);
    bulk['profileId'].set('admin');
    await bulk['save']();
    expect(bulk['error']()).toBe('');
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0]![1]).toHaveLength(2);
    expect(add.mock.calls[0]![2]).toBe(snapshot.version);
    expect(saved).toHaveBeenCalledTimes(1);

    // Quien la contiene recarga el snapshot; Administrator y Access audit no conviven.
    const fresh = await gateway.snapshot({ actor: admin, signal: new AbortController().signal });
    fixture.componentRef.setInput('snapshot', fresh);
    bulk['toggleUser']('operator', false);
    bulk['profileId'].set('audit');
    await bulk['save']();
    expect(bulk['error']()).toBe('segregation');
    expect(bulk['conflictNames']()).toBe('Administrator, Access audit');
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite changes made since the snapshot was read', async () => {
    const { bulk, gateway } = await setup();
    await gateway.addAssignments(
      { actor: admin, signal: new AbortController().signal },
      [{ userId: 'operator', profileId: 'audit', warehouseId: 'B', ownerId: 'Y' }],
      1,
    );
    bulk['toggleUser']('reader', true);
    bulk['toggleContext']('B/Y', true);
    bulk['profileId'].set('catalogs');
    await bulk['save']();
    expect(bulk['error']()).toBe('conflict');
  });
});
