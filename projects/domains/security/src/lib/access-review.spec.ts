import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AccessStore, SecurityAdministration } from '@ewms/core/security';
import { DialogService, ToastService } from '@ewms/design-system';
import { TranslocoService } from '@jsverse/transloco';
import { AccessReview } from './access-review';
import { MemorySecurityGateway } from './memory-gateway';

const admin = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };
const confirmation = vi.fn().mockResolvedValue(true);

async function setup(userId = 'admin') {
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
  TestBed.overrideComponent(AccessReview, { set: { template: '' } });
  await TestBed.inject(AccessStore).connect(gateway, { ...admin, userId }, true);
  const snapshot = await gateway.snapshot({ actor: admin, signal: new AbortController().signal });
  const fixture = TestBed.createComponent(AccessReview);
  fixture.componentRef.setInput('snapshot', snapshot);
  fixture.detectChanges();
  const review = fixture.componentInstance;
  await review['load']();
  return { gateway, review };
}

describe('Access review', () => {
  it('starts a campaign and records who decided what and when', async () => {
    const { review, gateway } = await setup();
    const changed = vi.fn();
    review.changed.subscribe(changed);
    expect(review['campaign']()).toBeNull();
    review['model'].set({ name: 'Revisión Q4', dueDate: '2999-12-31' });
    await review['start']();
    const campaign = review['campaign']()!;
    expect(campaign.name).toBe('Revisión Q4');
    expect(review['progress']()).toEqual({ decided: 0, total: campaign.items.length });

    const reader = campaign.items.find((i) => i.userId === 'reader')!;
    await review['decide'](reader, 'confirm');
    const confirmed = review['campaign']()!.items.find((i) => i.userId === 'reader')!;
    expect(confirmed).toMatchObject({ decision: 'confirm', decidedBy: 'admin' });
    expect(review['authorName'](confirmed)).toBe('Ana Admin');
    expect(review['progress']().decided).toBe(1);
    expect(changed).not.toHaveBeenCalled();

    const operator = campaign.items.find((i) => i.userId === 'operator')!;
    await review['decide'](operator, 'revoke');
    expect(confirmation).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'security.review.revokeTitle' }),
    );
    expect(changed).toHaveBeenCalledTimes(1);
    const state = await gateway.snapshot({ actor: admin, signal: new AbortController().signal });
    expect(state.assignments).not.toContainEqual(
      expect.objectContaining({ userId: 'operator', profileId: operator.profileId, warehouseId: operator.warehouseId }),
    );
  });

  it('never offers deciding on the own access and shows a rejection', async () => {
    const { review, gateway } = await setup();
    review['model'].set({ name: 'Revisión Q4', dueDate: '2999-12-31' });
    await review['start']();
    const own = review['campaign']()!.items.find((i) => i.userId === 'admin')!;
    expect(review['own'](own)).toBe(true);
    const decide = vi.spyOn(gateway, 'decide');
    await review['decide'](own, 'confirm');
    expect(decide).not.toHaveBeenCalled();

    const reader = review['campaign']()!.items.find((i) => i.userId === 'reader')!;
    gateway.failNext('conflict');
    await review['decide'](reader, 'confirm');
    expect(review['error']()).toBe('conflict');
  });

  it('cancelling a revocation leaves the assignment untouched', async () => {
    const { review, gateway } = await setup();
    review['model'].set({ name: 'Revisión Q4', dueDate: '2999-12-31' });
    await review['start']();
    const reader = review['campaign']()!.items.find((i) => i.userId === 'reader')!;
    const decide = vi.spyOn(gateway, 'decide');
    confirmation.mockResolvedValueOnce(false);
    await review['decide'](reader, 'revoke');
    expect(decide).not.toHaveBeenCalled();
    expect(review['campaign']()!.items.find((i) => i.userId === 'reader')?.decision).toBeNull();
  });

  it('does not start a campaign without name and due date', async () => {
    const { review, gateway } = await setup();
    const start = vi.spyOn(gateway, 'startReview');
    review['model'].set({ name: '', dueDate: '' });
    expect(review['startForm']().valid()).toBe(false);
    await review['start']();
    expect(start).not.toHaveBeenCalled();
  });
});
