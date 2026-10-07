import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionContext } from '@ewms/core';
import {
  AccessStore,
  AuthSession,
  HttpSecurityGateway,
  type SessionInfo,
} from '@ewms/core/security';
import { SECURITY_DEMO } from './demo-mode';
import { startSession } from './security-routing';

describe('startSession', () => {
  const session = signal<SessionInfo | null>(null);
  const gateway = { access: vi.fn() };
  let access: AccessStore;
  let connect: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    session.set(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { session } },
        { provide: HttpSecurityGateway, useValue: gateway },
      ],
    });
    access = TestBed.inject(AccessStore);
    connect = vi.spyOn(access, 'connect').mockImplementation(async () => {
      access.status.set('ready');
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  const run = () => TestBed.runInInjectionContext(startSession);

  it('does nothing without a session', async () => {
    await run();
    expect(connect).not.toHaveBeenCalled();
  });

  it('connects the access of whoever opened the session, once', async () => {
    session.set({ userId: 'reader', name: 'Rosa  Consulta', warehouseId: 'B', ownerId: 'Y' });
    await run();
    await run();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith(
      gateway,
      { userId: 'reader', warehouseId: 'B', ownerId: 'Y' },
      SECURITY_DEMO,
    );
    const context = TestBed.inject(SessionContext);
    expect(context.user()).toEqual({ name: 'Rosa  Consulta', initials: 'RC' });
    expect(context.warehouse().code).toBe('B');
  });
});
