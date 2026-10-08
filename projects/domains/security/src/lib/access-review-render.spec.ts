import { ApplicationInitStatus } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AccessStore, SecurityAdministration, SecurityError } from '@ewms/core/security';
import { DialogService, Select, ToastService } from '@ewms/design-system';
import { provideI18nTesting } from '@ewms/testing';
import { TranslocoService } from '@jsverse/transloco';
import { AccessReview } from './access-review';
import { MemorySecurityGateway } from './memory-gateway';
import { provideSecurityRendering } from './security.testing';

const admin = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };
const confirm = vi.fn();
const toast = vi.fn();

async function render(gateway = new MemorySecurityGateway({ latency: 0 })) {
  TestBed.configureTestingModule({
    providers: [
      provideI18nTesting({ es: {}, en: {} }),
      ...provideSecurityRendering(),
      { provide: DialogService, useValue: { confirm } },
      { provide: ToastService, useValue: { show: toast } },
      { provide: SecurityAdministration, useValue: gateway },
    ],
  });
  await TestBed.inject(ApplicationInitStatus).donePromise;
  TestBed.inject(TranslocoService).setActiveLang('es');
  await TestBed.inject(AccessStore).connect(gateway, admin, true);
  const snapshot = await gateway.snapshot({ actor: admin, signal: new AbortController().signal });
  const fixture = TestBed.createComponent(AccessReview);
  fixture.componentRef.setInput('snapshot', snapshot);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return { fixture, gateway };
}

const root = (fixture: ComponentFixture<AccessReview>): HTMLElement =>
  fixture.nativeElement as HTMLElement;
const button = (fixture: ComponentFixture<AccessReview>, text: string): HTMLButtonElement =>
  [...root(fixture).querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.includes(text),
  )!;

async function startCampaign(fixture: ComponentFixture<AccessReview>, name: string): Promise<void> {
  root(fixture).querySelector<HTMLButtonElement>('[data-review-open] button')!.click();
  await fixture.whenStable();
  const input = root(fixture).querySelector<HTMLInputElement>('[data-review-form] ewms-input input')!;
  input.value = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.componentInstance['model'].update((model) => ({ ...model, dueDate: '2999-12-31' }));
  await fixture.whenStable();
  root(fixture).querySelector<HTMLButtonElement>('[data-review-form] button[type="submit"]')!.click();
  await vi.waitFor(() => expect(root(fixture).querySelector('[data-review-form]')).toBeNull());
}

describe('Access review, rendered', () => {
  beforeEach(() => {
    confirm.mockReset().mockResolvedValue(true);
    toast.mockReset();
  });

  it('without a campaign shows the empty state, and the form opens and cancels', async () => {
    const { fixture } = await render();
    await vi.waitFor(() => expect(root(fixture).querySelector('ewms-empty-state')).not.toBeNull());
    root(fixture).querySelector<HTMLButtonElement>('[data-review-open] button')!.click();
    await fixture.whenStable();
    expect(root(fixture).querySelector('[data-review-form]')).not.toBeNull();
    expect(root(fixture).querySelector<HTMLButtonElement>('[data-review-open] button')!.disabled).toBe(
      true,
    );
    root(fixture).querySelector<HTMLButtonElement>('[data-review-form] [data-effect="none"] button')!.click();
    await fixture.whenStable();
    expect(root(fixture).querySelector('[data-review-form]')).toBeNull();
  });

  it('a campaign lists each assignment: confirm records the author, own access is not offered', async () => {
    const { fixture } = await render();
    await startCampaign(fixture, 'Revisión Q4');
    expect(toast).toHaveBeenCalledWith('success', 'security.saved');
    const items = () => [...root(fixture).querySelectorAll('[data-review-items] li')];
    const own = items().filter((li) => li.querySelector('[data-review-own]'));
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((li) => li.querySelector('button') === null)).toBe(true);
    expect(root(fixture).querySelector('[data-review-progress]')).not.toBeNull();
    button(fixture, 'security.review.confirm').click();
    await vi.waitFor(() => expect(root(fixture).querySelector('[data-review-author]')).not.toBeNull());
    expect(root(fixture).querySelector('ewms-badge')).not.toBeNull();
    expect(fixture.componentInstance['progress']().decided).toBe(1);
  });

  it('revoke asks first and announces the change; declined, nothing is decided', async () => {
    const { fixture } = await render();
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    await startCampaign(fixture, 'Revisión Q4');
    confirm.mockResolvedValueOnce(false);
    button(fixture, 'security.review.revoke').click();
    await fixture.whenStable();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'security.review.revokeTitle', variant: 'warning' }),
    );
    expect(fixture.componentInstance['progress']().decided).toBe(0);
    button(fixture, 'security.review.revoke').click();
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(fixture.componentInstance['progress']().decided).toBe(1);
  });

  it('with two campaigns a selector chooses which one is shown', async () => {
    const { fixture } = await render();
    await startCampaign(fixture, 'Primera');
    expect(root(fixture).querySelector('ewms-select')).toBeNull();
    await startCampaign(fixture, 'Segunda');
    const select = fixture.debugElement.query(By.directive(Select));
    expect(select).not.toBeNull();
    const first = fixture.componentInstance['campaigns']()!.find((c) => c.name === 'Primera')!;
    select.triggerEventHandler('valueChange', first.id);
    await fixture.whenStable();
    expect(fixture.componentInstance['campaign']()?.name).toBe('Primera');
    select.triggerEventHandler('valueChange', null);
    expect(fixture.componentInstance['campaign']()?.name).toBe('Primera');
  });

  it('a rejected write is an alert with its reason', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    vi.spyOn(gateway, 'startReview').mockRejectedValueOnce(new SecurityError('conflict'));
    const { fixture } = await render(gateway);
    root(fixture).querySelector<HTMLButtonElement>('[data-review-open] button')!.click();
    await fixture.whenStable();
    fixture.componentInstance['model'].set({ name: 'Revisión', dueDate: '2999-12-31' });
    await fixture.componentInstance['start']();
    await fixture.whenStable();
    expect(root(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'security.errors.conflict',
    );
  });
});
