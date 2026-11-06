import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActiveContext, ContextChangeError } from './active-context';
import { HttpActiveContext } from './http-active-context';
import { AuthSession, SESSION_REQUEST, type SessionGrant } from './auth-session';
import { SECURITY_API_URL } from './security-api-url';

const BASE = '/api/v1/security';
const moved: SessionGrant = {
  accessToken: 'token-3',
  session: { userId: 'admin', name: 'Ana Admin', warehouseId: 'B', ownerId: 'Y' },
};

function setup(url: string | null = BASE) {
  const adopt = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SECURITY_API_URL, useValue: signal(url ?? undefined) },
      { provide: AuthSession, useValue: { adopt } },
      { provide: ActiveContext, useExisting: HttpActiveContext },
    ],
  });
  return {
    active: TestBed.inject(ActiveContext),
    http: TestBed.inject(HttpTestingController),
    adopt,
  };
}

describe('ActiveContext', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lists the contexts of the session with its token, not as a session request', async () => {
    const { active, http } = setup();
    const listing = active.contexts();
    const request = http.expectOne(`${BASE}/session/contexts`);
    expect(request.request.method).toBe('GET');
    expect(request.request.context.get(SESSION_REQUEST)).toBe(false);
    request.flush([
      { warehouseId: 'A', ownerId: 'X' },
      { warehouseId: 'B', ownerId: 'Y' },
    ]);
    expect(await listing).toHaveLength(2);
    http.verify();
  });

  it('a session that does not load its contexts offers none', async () => {
    const { active, http } = setup();
    const listing = active.contexts();
    http.expectOne(`${BASE}/session/contexts`).flush(null, { status: 503, statusText: 'No' });
    expect(await listing).toEqual([]);
  });

  it('switches on the server, sends only the context and the session adopts the answer', async () => {
    const { active, http, adopt } = setup();
    const switching = active.switchTo({ warehouseId: 'B', ownerId: 'Y', extra: 1 } as never);
    const request = http.expectOne(`${BASE}/session/context`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ warehouseId: 'B', ownerId: 'Y' });
    request.flush(moved);
    await switching;
    expect(adopt).toHaveBeenCalledWith(moved);
  });

  it('a refused change gives the reason of the server', async () => {
    const { active, http } = setup();
    for (const [status, body, code] of [
      [409, { type: 'urn:ewms:security:taskInProgress' }, 'taskInProgress'],
      [403, null, 'denied'],
      [503, null, 'unavailable'],
    ] as const) {
      const switching = active.switchTo({ warehouseId: 'B', ownerId: 'Y' });
      http.expectOne(`${BASE}/session/context`).flush(body, { status, statusText: 'No' });
      await expect(switching).rejects.toEqual(new ContextChangeError(code));
    }
  });

  it('an unexpected failure is unavailable', async () => {
    const { active, http, adopt } = setup();
    adopt.mockImplementationOnce(() => {
      throw new TypeError('broken');
    });
    const switching = active.switchTo({ warehouseId: 'B', ownerId: 'Y' });
    http.expectOne(`${BASE}/session/context`).flush(moved);
    await expect(switching).rejects.toEqual(new ContextChangeError('unavailable'));
  });

  it('without a configured URL there is no context to list or switch', async () => {
    const { active, http } = setup(null);
    expect(await active.contexts()).toEqual([]);
    await expect(active.switchTo({ warehouseId: 'B', ownerId: 'Y' })).rejects.toEqual(
      new ContextChangeError('unavailable'),
    );
    http.verify();
  });
});
