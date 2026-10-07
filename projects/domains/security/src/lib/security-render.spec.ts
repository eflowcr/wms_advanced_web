import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';
import { AccessStore } from '@ewms/core/security';
import { DialogService, KeyboardShortcuts, ToastService } from '@ewms/design-system';
import { provideI18nTesting } from '@ewms/testing';
import { TRANSLOCO_MISSING_HANDLER, TranslocoService } from '@jsverse/transloco';
import { MemorySecurityGateway } from './memory-gateway';
import { SecurityPage } from './security-page';

describe('Security rendered contract', () => {
  it('renders the saved matrix and provenance, and exposes draft cancellation', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting({ es: {}, en: {} }),
        { provide: TRANSLOCO_MISSING_HANDLER, useValue: { handle: (key: string) => key } },
        { provide: DialogService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: KeyboardShortcuts, useValue: { register: vi.fn(), events: EMPTY } },
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;
    TestBed.inject(TranslocoService).setActiveLang('es');
    const access = TestBed.inject(AccessStore);
    await access.connect(
      new MemorySecurityGateway({ latency: 0 }),
      { userId: 'admin', warehouseId: 'A', ownerId: 'X' },
      true,
    );
    const fixture = TestBed.createComponent(SecurityPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance['load']();
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance['result']().length).toBeGreaterThan(0));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent).toContain('shell.menu.profiles');
    expect(root.querySelectorAll('fieldset').length).toBeGreaterThan(10);
    expect(root.querySelector('[data-assignments]')?.textContent).toContain('Consultation');
    expect(root.querySelector('[data-effective-access]')?.textContent).toContain('Consultation');
    const page = fixture.componentInstance;
    expect(root.querySelectorAll('[data-permission-module]').length).toBe(3);
    expect(root.querySelector('[data-profile-summary]')?.textContent).toContain('Administrator');
    page['chooseProfile']('read');
    fixture.detectChanges();
    const summary = root.querySelector('[data-profile-summary]')?.textContent;
    const filter = root.querySelector<HTMLInputElement>('[data-granted-filter] input')!;
    filter.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('fieldset').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('fieldset').length).toBeLessThan(15);
    expect(root.querySelector('[data-profile-summary]')?.textContent).toBe(summary);
    const search = root.querySelector<HTMLInputElement>('[data-screen-search] input')!;
    search.value = 'shell.menu.settings';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelectorAll('[data-permission-module]').length).toBe(1);
    expect(root.querySelectorAll('fieldset').length).toBe(2);
    expect(page['profileSummary']()).toEqual({ name: 'Consultation', screens: 2, actions: 1 });
    const edit = root.querySelector<HTMLButtonElement>('[data-profile-edit] button')!;
    edit.click();
    fixture.detectChanges();
    expect(root.querySelector('[data-profile-form] input')).not.toBeNull();
    expect(edit.disabled).toBe(true);
    const users = page['screens']().find((screen) => screen.id === 'users')!;
    await page['toggle'](users, 'users.view', false);
    fixture.detectChanges();
    expect(root.querySelectorAll('fieldset').length).toBe(1);
    expect(page['granted']('profiles.inspect')).toBe(true);
    expect(page['profileSummary']()).toEqual({ name: 'Consultation', screens: 1, actions: 1 });
    await vi.waitFor(() => expect(document.activeElement).toBe(filter));
    expect(root.querySelector('[data-profile-summary]')?.textContent).not.toBe(summary);
    fixture.componentInstance['cancel']();
    fixture.detectChanges();
    expect(root.querySelector('[data-profile-form]')).toBeNull();
    expect(edit.disabled).toBe(false);
    expect(root.querySelectorAll('fieldset').length).toBe(2);
    search.value = 'absent-screen';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelectorAll('fieldset').length).toBe(0);
    expect(root.querySelector('[data-permission-matrix]')?.textContent).toContain(
      'security.noResults',
    );
  });
});
