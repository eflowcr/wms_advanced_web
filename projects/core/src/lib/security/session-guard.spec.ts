import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { AuthSession, type SessionInfo } from './auth-session';
import { safeReturnUrl, sessionGuard } from './session-guard';

const info: SessionInfo = { userId: 'admin', name: 'Ana', warehouseId: 'A', ownerId: 'X' };

describe('sessionGuard', () => {
  const session = signal<SessionInfo | null>(null);
  let renew: ReturnType<typeof vi.fn>;
  let router: Router;

  beforeEach(() => {
    session.set(null);
    renew = vi.fn(async () => false);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthSession, useValue: { session, renew } }],
    });
    router = TestBed.inject(Router);
  });

  afterEach(() => TestBed.resetTestingModule());

  const run = () => TestBed.runInInjectionContext(() => sessionGuard({} as never, [], {} as never));

  it('lets a live session through without asking the server', async () => {
    session.set(info);
    expect(await run()).toBe(true);
    expect(renew).not.toHaveBeenCalled();
  });

  it('recovers the session with the renewal cookie after a reload', async () => {
    renew.mockImplementation(async () => {
      session.set(info);
      return true;
    });
    expect(await run()).toBe(true);
  });

  it('without a session sends to sign in, remembering the requested address', async () => {
    vi.spyOn(router, 'currentNavigation').mockReturnValue({
      extractedUrl: router.parseUrl('/configuracion/usuarios?state=inactive'),
    } as never);
    const result = await run();
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe(
      '/login?returnUrl=%2Fconfiguracion%2Fusuarios%3Fstate%3Dinactive',
    );
  });

  it('does not add a return address for the start page', async () => {
    const result = await run();
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});

describe('safeReturnUrl', () => {
  it('accepts only addresses inside the console', () => {
    expect(safeReturnUrl('/configuracion/usuarios?x=1')).toBe('/configuracion/usuarios?x=1');
    for (const unsafe of [null, '', 'https://evil.example', '//evil.example', '/\\evil', 'x']) {
      expect(safeReturnUrl(unsafe), String(unsafe)).toBe('/');
    }
  });
});
