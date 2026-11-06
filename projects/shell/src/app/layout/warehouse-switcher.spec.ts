import { ApplicationInitStatus, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { LanguageService, SessionContext } from '@ewms/core';
import {
  ActiveContext,
  AuthSession,
  ContextChangeError,
  type SessionInfo,
} from '@ewms/core/security';
import { Select, ToastService } from '@ewms/design-system';
import { expectNoAxeViolations, provideI18nTesting } from '@ewms/testing';
import { By } from '@angular/platform-browser';
import { DICTIONARIES } from '../i18n.testing';
import { WarehouseSwitcher } from './warehouse-switcher';

const AX: SessionInfo = { userId: 'admin', name: 'Ana', warehouseId: 'A', ownerId: 'X' };

describe('WarehouseSwitcher', () => {
  let fixture: ComponentFixture<WarehouseSwitcher>;
  const session = signal<SessionInfo | null>(AX);
  let switchContext: ReturnType<typeof vi.fn>;
  let contexts: ReturnType<typeof vi.fn>;
  let show: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    session.set(AX);
    switchContext = vi.fn(async (context: { warehouseId: string; ownerId: string }) => {
      session.set({ ...AX, ...context });
    });
    contexts = vi.fn(async () => [
      { warehouseId: 'A', ownerId: 'X' },
      { warehouseId: 'B', ownerId: 'Y' },
    ]);
    show = vi.fn();
    await TestBed.configureTestingModule({
      imports: [WarehouseSwitcher],
      providers: [
        provideI18nTesting(DICTIONARIES),
        { provide: AuthSession, useValue: { session } },
        { provide: ActiveContext, useValue: { contexts, switchTo: switchContext } },
        { provide: ToastService, useValue: { show } },
      ],
    }).compileComponents();
    await TestBed.inject(ApplicationInitStatus).donePromise;
    await TestBed.inject(LanguageService).use('es');
    fixture = TestBed.createComponent(WarehouseSwitcher);
    await fixture.whenStable();
  });

  const select = () => fixture.debugElement.query(By.directive(Select)).componentInstance as Select;
  async function choose(value: string): Promise<void> {
    // Un model emite valueChange al cambiar, como cuando la persona elige.
    select().value.set(value);
    await fixture.whenStable();
  }

  it('shows the active warehouse among those of the session, by name', async () => {
    expect(contexts).toHaveBeenCalledTimes(1);
    expect(select().value()).toBe('A/X');
    expect(select().options()).toEqual([
      { value: 'A/X', label: 'Almacén A / Propietario X' },
      { value: 'B/Y', label: 'Almacén B / Propietario Y' },
    ]);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('shows who opened the session and where in the header', () => {
    const display = TestBed.inject(SessionContext);
    expect(display.user()).toEqual({ name: 'Ana', initials: 'A' });
    session.set({ ...AX, name: 'Rosa  Consulta', warehouseId: 'B', ownerId: 'Y' });
    fixture.detectChanges();
    expect(display.user().initials).toBe('RC');
    expect(display.warehouse().code).toBe('B');
  });

  it('switches on the server without signing in again', async () => {
    await choose('B/Y');
    expect(switchContext).toHaveBeenCalledWith({ warehouseId: 'B', ownerId: 'Y' });
    expect(select().value()).toBe('B/Y');
    expect(show).not.toHaveBeenCalled();
  });

  it('a refusal keeps the warehouse and says why (PACQ-09)', async () => {
    switchContext.mockRejectedValueOnce(new ContextChangeError('taskInProgress'));
    await choose('B/Y');
    expect(select().value()).toBe('A/X');
    expect(session()).toEqual(AX);
    expect(show).toHaveBeenCalledWith(
      'danger',
      'No se puede cambiar de almacén mientras hay una tarea en ejecución.',
    );
    switchContext.mockRejectedValueOnce(new Error('network'));
    await choose('B/Y');
    expect(show).toHaveBeenLastCalledWith('danger', expect.stringContaining('No se pudo cambiar'));
  });

  it('with a single warehouse shows it as text, with no keyboard stop', async () => {
    contexts.mockResolvedValue([{ warehouseId: 'A', ownerId: 'X' }]);
    session.set({ ...AX, userId: 'reader' });
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('input')).toBeNull();
    expect(root.querySelector('[data-warehouse-current]')?.textContent?.trim()).toBe(
      'Almacén activo: Almacén A / Propietario X',
    );
    session.set(null);
    await fixture.whenStable();
    expect(root.querySelector('[data-warehouse-current]')?.textContent?.trim()).toBe(
      'Almacén activo:',
    );
    await expectNoAxeViolations(root);
  });

  it('ignores the current warehouse and values it does not offer', async () => {
    await choose('A/X');
    await choose('Z/Q');
    expect(switchContext).not.toHaveBeenCalled();
  });

  it('asks again for the warehouses when another person opens the session', async () => {
    session.set({ ...AX, userId: 'reader' });
    await fixture.whenStable();
    expect(contexts).toHaveBeenCalledTimes(2);
    session.set(null);
    await fixture.whenStable();
    expect(select().value()).toBeNull();
  });
});
