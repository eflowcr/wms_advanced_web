import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CoreAuthAdapter } from './core-auth-adapter';
import { CoreAuthSession } from './core-auth-session';
import { SECURITY_API_URL } from './security-api-url';

const BASE = '/api/v1/security';

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SECURITY_API_URL, useValue: signal(BASE) },
    ],
  });
  return {
    auth: TestBed.inject(CoreAuthSession),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('CoreAuthSession (lazy facade)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('before the first use there is no session and closing sends nothing', async () => {
    const { auth, http } = setup();
    expect(auth.session()).toBeNull();
    expect(auth.token()).toBeNull();
    await auth.signOut();
    http.verify();
  });

  it('the first login loads the adapter and exposes its session and token', async () => {
    const { auth, http } = setup();
    const signing = auth.signIn({ username: 'ana', password: 'x' });
    (await vi.waitFor(() => http.expectOne(`${BASE}/auth/login`))).flush({
      access_token: 'acc-1',
      session_id: 's-1',
      principal_id: 'p-1',
    });
    (await vi.waitFor(() => http.expectOne(`${BASE}/auth/me`))).flush({ display_name: 'Ana' });
    await signing;
    expect(auth.token()).toBe('acc-1');
    expect(auth.session()).toEqual(TestBed.inject(CoreAuthAdapter).session());
    expect(auth.session()?.name).toBe('Ana');
  });

  it('adopting, verifying and closing go to the adapter, loaded on demand', async () => {
    const { auth, http } = setup();
    const session = { userId: 'p-1', name: 'Ana', warehouseId: 'W1', ownerId: '' };
    auth.adopt({ accessToken: 'acc-0', session });
    await vi.waitFor(() => expect(auth.token()).toBe('acc-0'));
    auth.adopt({ accessToken: 'acc-1', session: { ...session, warehouseId: 'W2' } });
    expect(auth.session()?.warehouseId).toBe('W2');
    await expect(auth.verifyPasscode('123456')).rejects.toThrow();
    const leaving = auth.signOut();
    expect(auth.token()).toBeNull();
    http.expectOne(`${BASE}/auth/terminate`).flush({});
    await leaving;
  });

  it('renewing goes through the same adapter, loaded once', async () => {
    const { auth, http } = setup();
    const renewing = Promise.all([auth.renew(), auth.renew()]);
    (await vi.waitFor(() => http.expectOne(`${BASE}/auth/refresh`))).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    expect(await renewing).toEqual([false, false]);
    http.verify();
  });
});
