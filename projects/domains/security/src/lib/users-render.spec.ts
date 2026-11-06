import { ApplicationInitStatus } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { AccessStore, ActiveContext, SecurityError } from '@ewms/core/security';
import { DialogService, FilterBar, KeyboardShortcuts, Table, ToastService } from '@ewms/design-system';
import { provideI18nTesting } from '@ewms/testing';
import { TranslocoService } from '@jsverse/transloco';
import { MemorySecurityGateway } from './memory-gateway';
import { provideSecurityRendering } from './security.testing';
import { UsersPage } from './users-page';

const confirm = vi.fn();
const toast = vi.fn();
const shortcuts = new Map<string, () => void>();

async function render(
  userId: string,
  gateway = new MemorySecurityGateway({ latency: 0 }),
): Promise<ComponentFixture<UsersPage>> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideI18nTesting({ es: {}, en: {} }),
      ...provideSecurityRendering(),
      { provide: DialogService, useValue: { confirm } },
      { provide: ToastService, useValue: { show: toast } },
      {
        provide: KeyboardShortcuts,
        useValue: { register: (id: string, run: () => void) => shortcuts.set(id, run), events: EMPTY },
      },
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
  await TestBed.inject(ApplicationInitStatus).donePromise;
  TestBed.inject(TranslocoService).setActiveLang('es');
  await TestBed.inject(AccessStore).connect(gateway, { userId, warehouseId: 'A', ownerId: 'X' }, true);
  const fixture = TestBed.createComponent(UsersPage);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return fixture;
}

const root = (fixture: ComponentFixture<UsersPage>): HTMLElement =>
  fixture.nativeElement as HTMLElement;
const table = (fixture: ComponentFixture<UsersPage>) => fixture.debugElement.query(By.directive(Table));
const rowsShown = (fixture: ComponentFixture<UsersPage>): string =>
  root(fixture).querySelector('ewms-table tbody')?.textContent ?? '';

async function settle(fixture: ComponentFixture<UsersPage>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

describe('Users page, rendered', () => {
  beforeEach(() => {
    confirm.mockReset().mockResolvedValue(true);
    toast.mockReset();
    shortcuts.clear();
  });

  it('lists the directory and creates a user from the create button', async () => {
    const fixture = await render('admin');
    await vi.waitFor(() => expect(root(fixture).querySelector('ewms-table')).not.toBeNull());
    expect(root(fixture).querySelector('h1')?.textContent).toContain('shell.menu.users');
    root(fixture).querySelector<HTMLButtonElement>('[data-user-create] button')!.click();
    await settle(fixture);
    const form = root(fixture).querySelector('[data-user-form]')!;
    expect(form.textContent).toContain('security.createUser');
    expect(document.activeElement).toBe(form.querySelector('input'));
    const name = form.querySelector<HTMLInputElement>('input')!;
    name.value = 'Nora Nueva';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    form.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await vi.waitFor(() => expect(root(fixture).querySelector('[data-user-form]')).toBeNull());
    expect(toast).toHaveBeenCalledWith('success', 'security.saved');
    await vi.waitFor(() =>
      expect(fixture.componentInstance['rows']()?.some((u) => u.name === 'Nora Nueva')).toBe(true),
    );
  });

  it('an external user needs a company from the owners the administrator manages (C5)', async () => {
    const fixture = await render('admin');
    await vi.waitFor(() => expect(root(fixture).querySelector('ewms-table')).not.toBeNull());
    shortcuts.get('create')!();
    await settle(fixture);
    expect(root(fixture).querySelector('[data-user-form] ewms-select')).toBeNull();
    fixture.componentInstance['model'].update((model) => ({ ...model, affiliation: 'external' }));
    await settle(fixture);
    expect(root(fixture).querySelector('[data-user-form] ewms-select')).not.toBeNull();
    expect(fixture.componentInstance['companies']()).toEqual([
      { value: 'X', label: 'X' },
      { value: 'Y', label: 'Y' },
    ]);
    expect(fixture.componentInstance['userForm'].companyId().invalid()).toBe(true);
  });

  it('edits from the row menu and from activation, and cancel discards the draft', async () => {
    const fixture = await render('admin');
    await vi.waitFor(() => expect(root(fixture).querySelector('ewms-table')).not.toBeNull());
    const rosa = fixture.componentInstance['rows']()!.find((u) => u.id === 'reader')!;
    const items = fixture.componentInstance['menuItems'](rosa).map((item) => item.id);
    expect(items).toEqual(['edit', 'status']);
    table(fixture).triggerEventHandler('rowMenu', { row: rosa, item: { id: 'edit' } });
    await settle(fixture);
    expect(root(fixture).querySelector('[data-user-form]')?.textContent).toContain('security.editUser');
    expect(fixture.componentInstance['model']().name).toBe('Rosa Consulta');
    root(fixture).querySelector<HTMLButtonElement>('[data-user-form] [data-effect="none"] button')!.click();
    await settle(fixture);
    expect(root(fixture).querySelector('[data-user-form]')).toBeNull();
    table(fixture).triggerEventHandler('rowActivate', { row: rosa });
    await settle(fixture);
    expect(fixture.componentInstance['draft']()?.id).toBe('reader');
    expect(await fixture.componentInstance.canLeave()).toBe(true);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'security.unsaved' }));
  });

  it('deactivates from the row menu only after the confirmation, and keeps it when declined', async () => {
    const fixture = await render('admin');
    await vi.waitFor(() => expect(root(fixture).querySelector('ewms-table')).not.toBeNull());
    const rosa = () => fixture.componentInstance['rows']()?.find((u) => u.id === 'reader');
    confirm.mockResolvedValueOnce(false);
    table(fixture).triggerEventHandler('rowMenu', { row: rosa(), item: { id: 'status' } });
    await settle(fixture);
    expect(rosa()?.active).toBe(true);
    table(fixture).triggerEventHandler('rowMenu', { row: rosa(), item: { id: 'status' } });
    await vi.waitFor(() => expect(rosa()?.active).toBe(false));
    expect(fixture.componentInstance['menuItems'](rosa()!)[1]?.label).toBe('security.activate');
  });

  it('filters by search and state through the filter bar, kept in the address', async () => {
    const fixture = await render('admin');
    await vi.waitFor(() => expect(root(fixture).querySelector('ewms-table')).not.toBeNull());
    fixture.debugElement
      .query(By.directive(FilterBar))
      .triggerEventHandler('valueChange', { search: 'rosa', state: 'active' });
    await settle(fixture);
    expect(TestBed.inject(Router).url).toContain('search=rosa');
    expect(rowsShown(fixture)).toContain('Rosa Consulta');
    expect(rowsShown(fixture)).not.toContain('Ana Admin');
    fixture.componentInstance['filter']({ state: 'inactive' });
    await settle(fixture);
    expect(rowsShown(fixture)).toContain('Usuario inactivo');
    expect(rowsShown(fixture)).not.toContain('Rosa Consulta');
  });

  it('shows a rejected load as an alert, and reload asks again', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const users = vi
      .spyOn(gateway, 'users')
      .mockRejectedValueOnce(new SecurityError('unavailable'))
      .mockRejectedValueOnce(new Error('network'));
    const fixture = await render('admin', gateway);
    await vi.waitFor(() =>
      expect(root(fixture).querySelector('[role="alert"]')?.textContent).toContain(
        'security.errors.unavailable',
      ),
    );
    users.mockRestore();
    root(fixture).querySelector<HTMLButtonElement>('[data-effect="none"] button')!.click();
    await vi.waitFor(() => expect(root(fixture).querySelector('[role="alert"]')).toBeNull());
    expect(root(fixture).querySelector('ewms-table')).not.toBeNull();
  });

  it('without users access the directory is an empty state and offers nothing', async () => {
    const fixture = await render('external');
    await settle(fixture);
    expect(root(fixture).querySelector('ewms-empty-state')).not.toBeNull();
    expect(root(fixture).querySelector('[data-user-create]')).toBeNull();
    shortcuts.get('create')!();
    expect(fixture.componentInstance['draft']()).toBeNull();
    expect(await fixture.componentInstance.canLeave()).toBe(true);
  });
});
