import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccessStore } from './access-store';
import { AuthError, AuthSession, SESSION_REQUEST, type SessionGrant } from './auth-session';
import { SECURITY_API_URL } from './security-api-url';

const BASE = '/api/v1/security';
const grant: SessionGrant = {
  accessToken: 'token-1',
  session: { userId: 'admin', name: 'Ana Admin', warehouseId: 'A', ownerId: 'X' },
};

function setup(url: string | null = BASE) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SECURITY_API_URL, useValue: signal(url ?? undefined) },
    ],
  });
  return {
    auth: TestBed.inject(AuthSession),
    http: TestBed.inject(HttpTestingController),
    access: TestBed.inject(AccessStore),
  };
}

describe('AuthSession', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('starts with no session and no token', () => {
    const { auth } = setup();
    expect(auth.session()).toBeNull();
    expect(auth.token()).toBeNull();
  });

  it('signs in with the credentials and keeps the token only in memory', async () => {
    const { auth, http } = setup();
    const signing = auth.signIn({ username: 'admin', password: 'secreto' });
    const request = http.expectOne(`${BASE}/session`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'admin', password: 'secreto' });
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.context.get(SESSION_REQUEST)).toBe(true);
    request.flush(grant);
    await signing;

    expect(auth.token()).toBe('token-1');
    expect(auth.session()).toEqual(grant.session);
    http.verify();
  });

  it('rejected credentials end as invalidCredentials, a failure as unavailable', async () => {
    const { auth, http } = setup();
    for (const [status, code] of [
      [401, 'invalidCredentials'],
      [400, 'invalidCredentials'],
      [503, 'unavailable'],
    ] as const) {
      const signing = auth.signIn({ username: 'admin', password: 'x' });
      http.expectOne(`${BASE}/session`).flush(null, { status, statusText: 'Error' });
      await expect(signing).rejects.toEqual(new AuthError(code));
      expect(auth.session()).toBeNull();
    }
  });

  it('without a configured URL nothing leaves and the session is unavailable', async () => {
    const { auth, http } = setup(null);
    await expect(auth.signIn({ username: 'a', password: 'b' })).rejects.toEqual(
      new AuthError('unavailable'),
    );
    expect(await auth.renew()).toBe(false);
    await auth.signOut();
    http.verify();
  });

  it('renews once for many callers and replaces the token', async () => {
    const { auth, http } = setup();
    const callers = [auth.renew(), auth.renew(), auth.renew()];
    const request = http.expectOne(`${BASE}/session/refresh`);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.context.get(SESSION_REQUEST)).toBe(true);
    request.flush({ ...grant, accessToken: 'token-2' });

    expect(await Promise.all(callers)).toEqual([true, true, true]);
    expect(auth.token()).toBe('token-2');
    http.verify();
  });

  it('a failed renewal ends the session and closes access', async () => {
    const { auth, http, access } = setup();
    const disconnect = vi.spyOn(access, 'disconnect');
    const signing = auth.signIn({ username: 'admin', password: 'x' });
    http.expectOne(`${BASE}/session`).flush(grant);
    await signing;

    const renewing = auth.renew();
    http.expectOne(`${BASE}/session/refresh`).flush(null, { status: 401, statusText: 'No' });
    expect(await renewing).toBe(false);
    expect(auth.token()).toBeNull();
    expect(auth.session()).toBeNull();
    expect(disconnect).toHaveBeenCalled();
  });

  it('signs out on the server and forgets everything even if the server fails', async () => {
    const { auth, http, access } = setup();
    const disconnect = vi.spyOn(access, 'disconnect');
    const signing = auth.signIn({ username: 'admin', password: 'x' });
    http.expectOne(`${BASE}/session`).flush(grant);
    await signing;

    const leaving = auth.signOut();
    const request = http.expectOne(`${BASE}/session`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.withCredentials).toBe(true);
    request.flush(null, { status: 503, statusText: 'Down' });
    await leaving;

    expect(auth.token()).toBeNull();
    expect(auth.session()).toBeNull();
    expect(disconnect).toHaveBeenCalled();
  });

  it('adopts a session the server issued elsewhere and the access follows it', () => {
    const { auth, access } = setup();
    access.status.set('ready');
    access.actor.set({ userId: 'admin', warehouseId: 'A', ownerId: 'X' });
    const select = vi.spyOn(access, 'select').mockResolvedValue();
    auth.adopt({ ...grant, accessToken: 'token-3' });
    expect(select).not.toHaveBeenCalled();
    const moved = { ...grant.session, warehouseId: 'B', ownerId: 'Y' };
    auth.adopt({ accessToken: 'token-4', session: moved });
    expect(auth.token()).toBe('token-4');
    expect(select).toHaveBeenCalledWith({ userId: 'admin', warehouseId: 'B', ownerId: 'Y' });
    auth.adopt({ accessToken: 'token-5', session: { ...moved, userId: 'reader' } });
    expect(select).toHaveBeenLastCalledWith({ userId: 'reader', warehouseId: 'B', ownerId: 'Y' });
  });
});
