import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccessStore, SecurityAdministration } from '@ewms/core/security';
import { DialogService, EWMS_DATE_PICKER_MESSAGES, ToastService } from '@ewms/design-system';
import { provideI18nTesting } from '@ewms/testing';
import { TRANSLOCO_MISSING_HANDLER, TranslocoService } from '@jsverse/transloco';
import { BulkAssignment } from './bulk-assignment';
import { MemorySecurityGateway } from './memory-gateway';

const admin = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };

describe('Bulk assignment rendered contract', () => {
  it('lists people without the actor, contexts and a reviewed preview of explicit rows', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting({ es: {}, en: {} }),
        { provide: TRANSLOCO_MISSING_HANDLER, useValue: { handle: (key: string) => key } },
        { provide: DialogService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: SecurityAdministration, useValue: gateway },
        {
          provide: EWMS_DATE_PICKER_MESSAGES,
          useValue: { chooseDate: 'date', previousMonth: 'previous', nextMonth: 'next' },
        },
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;
    TestBed.inject(TranslocoService).setActiveLang('es');
    await TestBed.inject(AccessStore).connect(gateway, admin, true);
    const snapshot = await gateway.snapshot({ actor: admin, signal: new AbortController().signal });
    const fixture = TestBed.createComponent(BulkAssignment);
    fixture.componentRef.setInput('snapshot', snapshot);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const people = [...root.querySelectorAll('[data-bulk-users] label')].map((l) => l.textContent);
    expect(people.join()).not.toContain('Ana Admin');
    expect(people.join()).toContain('Rosa Consulta');
    expect(root.querySelector('[data-bulk-users] legend')?.textContent).toContain(
      'security.bulk.users',
    );
    const save = root.querySelector('[data-ewms-can="security.profiles:assign"] button');
    expect(save?.hasAttribute('disabled')).toBe(true);

    const check = (scope: string, index: number) => {
      root.querySelectorAll<HTMLInputElement>(`${scope} input[type="checkbox"]`)[index]!.click();
      fixture.detectChanges();
    };
    check('[data-bulk-users]', 0);
    check('[data-bulk-contexts]', 0);
    check('[data-bulk-contexts]', 1);
    check('[data-bulk-contexts]', 1);
    fixture.componentInstance['chooseProfile']('audit');
    fixture.componentInstance['chooseValidity']({ from: '2999-01-01' });
    fixture.detectChanges();
    expect(fixture.componentInstance['preview']().rows).toEqual([
      expect.objectContaining({ userId: 'reader', warehouseId: 'A', validFrom: '2999-01-01' }),
    ]);
    expect(root.querySelector('[data-bulk-preview]')?.getAttribute('aria-live')).toBe('polite');
    expect(save?.hasAttribute('disabled')).toBe(false);

    gateway.failNext('unavailable');
    await fixture.componentInstance['save']();
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'security.errors.unavailable',
    );
    fixture.componentInstance['chooseValidity'](null);
    expect(fixture.componentInstance['validity']()).toBeNull();
    root.querySelector<HTMLButtonElement>('[data-effect="none"] button')!.click();
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
