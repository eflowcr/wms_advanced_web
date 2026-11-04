import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccessStore } from './access-store';
import { AuthError, SESSION_REQUEST } from './auth-session';
import { CoreAuthAdapter, CSRF_HEADER, LOGIN_CHALLENGE } from './core-auth-adapter';
import { SECURITY_API_URL } from './security-api-url';
import { STEP_UP } from './step-up';

const BASE = '/api/v1/security';
const ME = {
  principal_id: 'p-1',
  username: 'ana',
  display_name: 'Ana Admin',
  active_warehouse_id: 'W1',
};

/** Un JWT sin firma válida: la consola solo lee `sub` y `sid`, la firma la valida el servidor. */
function jwt(claims: Record<string, string>): string {
  const part = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${part({ alg: 'HS256' })}.${part(claims)}.firma`;
}

function setup(
  stepUp?: (auth: CoreAuthAdapter) => Promise<boolean>,
  url: string | null = BASE,
) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SECURITY_API_URL, useValue: signal(url ?? undefined) },
      ...(stepUp
        ? [{ provide: STEP_UP, useFactory: () => () => stepUp(TestBed.inject(CoreAuthAdapter)) }]
        : []),
    ],
  });
  return {
    auth: TestBed.inject(CoreAuthAdapter),
    http: TestBed.inject(HttpTestingController),
    access: TestBed.inject(AccessStore),
  };
}

/** Responde el login y luego `/auth/me`, que sale con el token recién recibido. */
async function answerLogin(http: HttpTestingController, body: object): Promise<void> {
  http.expectOne(`${BASE}/auth/login`).flush(body);
  (await vi.waitFor(() => http.expectOne(`${BASE}/auth/me`))).flush(ME);
}

describe('CoreAuthAdapter (API Go)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('signs in on /auth/login and keeps only the access token, in memory', async () => {
    const { auth, http } = setup();
    const signing = auth.signIn({ username: 'ana', password: 'secreto' });
    const login = http.expectOne(`${BASE}/auth/login`);
    expect(login.request.method).toBe('POST');
    expect(login.request.body).toEqual({ username: 'ana', password: 'secreto' });
    expect(login.request.withCredentials).toBe(true);
    expect(login.request.context.get(SESSION_REQUEST)).toBe(true);
    login.flush({
      access_token: 'acc-1',
      refresh_token: 'nunca-se-guarda',
      expires_in: 900,
      session_id: 's-1',
      principal_id: 'p-1',
      requires_mfa: false,
    });
    const me = await vi.waitFor(() => http.expectOne(`${BASE}/auth/me`));
    expect(me.request.headers.get('Authorization')).toBe('Bearer acc-1');
    expect(me.request.context.get(SESSION_REQUEST)).toBe(true);
    me.flush(ME);
    await signing;

    expect(auth.token()).toBe('acc-1');
    expect(auth.session()).toEqual({
      userId: 'p-1',
      name: 'Ana Admin',
      warehouseId: 'W1',
      ownerId: '',
    });
    http.verify();
  });

  it('reads the PascalCase body the API sends today', async () => {
    const { auth, http } = setup();
    const signing = auth.signIn({ username: 'ana', password: 'x' });
    http
      .expectOne(`${BASE}/auth/login`)
      .flush({ AccessToken: 'acc-2', SessionID: 's-2', PrincipalID: 'p-2', RequiresMFA: false });
    (await vi.waitFor(() => http.expectOne(`${BASE}/auth/me`))).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    await signing;
    expect(auth.token()).toBe('acc-2');
    expect(auth.session()).toEqual({ userId: 'p-2', name: 'ana', warehouseId: '', ownerId: '' });
  });

  it('every rejection of the account reads the same; anything else is unavailable', async () => {
    const { auth, http } = setup();
    for (const [status, code] of [
      [400, 'invalidCredentials'],
      [401, 'invalidCredentials'],
      [403, 'invalidCredentials'],
      [423, 'invalidCredentials'],
      [429, 'unavailable'],
      [500, 'unavailable'],
    ] as const) {
      const signing = auth.signIn({ username: 'ana', password: 'x' });
      http.expectOne(`${BASE}/auth/login`).flush({}, { status, statusText: 'Error' });
      await expect(signing).rejects.toEqual(new AuthError(code));
      expect(auth.session()).toBeNull();
    }
  });

  it('a login that needs the second factor asks for it and opens the session after', async () => {
    let challenge = '';
    const { auth, http } = setup(async (session) => {
      challenge = LOGIN_CHALLENGE;
      const verifying = session.verifyPasscode(' 123456 ');
      const verify = http.expectOne(`${BASE}/auth/verify-mfa`);
      expect(verify.request.body).toEqual({ session_id: 's-3', passcode: '123456' });
      expect(verify.request.context.get(SESSION_REQUEST)).toBe(true);
      verify.flush({ access_token: 'acc-3', expires_in: 900 });
      (await vi.waitFor(() => http.expectOne(`${BASE}/auth/me`))).flush(ME);
      await verifying;
      return true;
    });
    const signing = auth.signIn({ username: 'ana', password: 'x' });
    http
      .expectOne(`${BASE}/auth/login`)
      .flush({ session_id: 's-3', principal_id: 'p-1', requires_mfa: true });
    await signing;
    expect(challenge).toContain('insufficient_user_authentication');
    expect(auth.token()).toBe('acc-3');
    expect(auth.session()?.name).toBe('Ana Admin');
  });

  it('cancelling the second factor of the login leaves no session', async () => {
    const { auth, http } = setup(async () => false);
    const signing = auth.signIn({ username: 'ana', password: 'x' });
    http.expectOne(`${BASE}/auth/login`).flush({ session_id: 's-4', requires_mfa: true });
    await expect(signing).rejects.toEqual(new AuthError('secondFactorCancelled'));
    expect(auth.token()).toBeNull();
    expect(auth.session()).toBeNull();
  });

  it('renews once with the cookie and the CSRF header; the session comes from the token', async () => {
    const { auth, http } = setup();
    const first = auth.renew();
    const second = auth.renew();
    const refresh = http.expectOne(`${BASE}/auth/refresh`);
    expect(refresh.request.body).toBeNull();
    expect(refresh.request.withCredentials).toBe(true);
    expect(refresh.request.headers.get(CSRF_HEADER)).toBe('1');
    expect(refresh.request.context.get(SESSION_REQUEST)).toBe(true);
    refresh.flush({ access_token: jwt({ sub: 'p-9', sid: 's-9' }), expires_in: 900 });
    (await vi.waitFor(() => http.expectOne(`${BASE}/auth/me`))).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(auth.session()?.userId).toBe('p-9');
    http.verify();
  });

  it('a failed renewal ends the session and the effective permissions', async () => {
    const { auth, http, access } = setup();
    const disconnect = vi.spyOn(access, 'disconnect');
    const renewing = auth.renew();
    http
      .expectOne(`${BASE}/auth/refresh`)
      .flush({ error: 'bad_request' }, { status: 400, statusText: 'Bad Request' });
    expect(await renewing).toBe(false);
    expect(auth.token()).toBeNull();
    expect(disconnect).toHaveBeenCalled();
  });

  it('signs out locally first and then terminates the server session with the token', async () => {
    const { auth, http } = setup();
    const signing = auth.signIn({ username: 'ana', password: 'x' });
    await answerLogin(http, { access_token: 'acc-5', session_id: 's-5', principal_id: 'p-1' });
    await signing;

    const leaving = auth.signOut();
    expect(auth.token()).toBeNull();
    const terminate = http.expectOne(`${BASE}/auth/terminate`);
    expect(terminate.request.method).toBe('POST');
    expect(terminate.request.headers.get('Authorization')).toBe('Bearer acc-5');
    expect(terminate.request.headers.get(CSRF_HEADER)).toBe('1');
    expect(terminate.request.withCredentials).toBe(true);
    terminate.flush({}, { status: 500, statusText: 'Error' });
    await leaving;
    expect(auth.session()).toBeNull();
  });

  it('a step-up inside the session verifies with its session id and swaps the token', async () => {
    const { auth, http } = setup();
    const signing = auth.signIn({ username: 'ana', password: 'x' });
    await answerLogin(http, { access_token: 'acc-6', session_id: 's-6', principal_id: 'p-1' });
    await signing;

    const verifying = auth.verifyPasscode('654321');
    const verify = http.expectOne(`${BASE}/auth/verify-mfa`);
    expect(verify.request.body).toEqual({ session_id: 's-6', passcode: '654321' });
    expect(verify.request.context.get(SESSION_REQUEST)).toBe(false);
    verify.flush({ access_token: 'acc-6-mfa' });
    await verifying;
    expect(auth.token()).toBe('acc-6-mfa');
    expect(auth.session()?.name).toBe('Ana Admin');
  });

  it('without a configured URL nothing leaves', async () => {
    const { auth, http } = setup(undefined, null);
    await expect(auth.signIn({ username: 'a', password: 'b' })).rejects.toEqual(
      new AuthError('unavailable'),
    );
    await expect(auth.verifyPasscode('1')).rejects.toEqual(new AuthError('unavailable'));
    expect(await auth.renew()).toBe(false);
    await auth.signOut();
    http.verify();
  });

  it('a second factor without the dialog, or a grant without token, opens nothing', async () => {
    const { auth, http } = setup();
    const needsFactor = auth.signIn({ username: 'ana', password: 'x' });
    http.expectOne(`${BASE}/auth/login`).flush({ RequiresMFA: true, SessionID: 's-7' });
    await expect(needsFactor).rejects.toEqual(new AuthError('secondFactorCancelled'));
    const empty = auth.signIn({ username: 'ana', password: 'x' });
    http.expectOne(`${BASE}/auth/login`).flush({});
    await expect(empty).rejects.toEqual(new AuthError('unavailable'));
    expect(auth.session()).toBeNull();
  });

  it('a token it cannot read still opens the session, named after the server or the person', async () => {
    const { auth, http } = setup();
    const renewing = auth.renew();
    http.expectOne(`${BASE}/auth/refresh`).flush({ access_token: 'a.%%%.b' });
    (await vi.waitFor(() => http.expectOne(`${BASE}/auth/me`))).flush({ username: 'ana' });
    expect(await renewing).toBe(true);
    expect(auth.session()).toEqual({ userId: '', name: 'ana', warehouseId: '', ownerId: '' });
  });

  it('a session of another person or context makes the permissions read again', async () => {
    const { auth, access } = setup();
    vi.spyOn(access, 'status').mockReturnValue('ready');
    vi.spyOn(access, 'actor').mockReturnValue({ userId: 'p-1', warehouseId: 'W1', ownerId: '' });
    const select = vi.spyOn(access, 'select').mockResolvedValue();
    const session = { userId: 'p-1', name: 'Ana', warehouseId: 'W1', ownerId: '' };
    auth.adopt({ accessToken: 'a', session });
    expect(select).not.toHaveBeenCalled();
    auth.adopt({ accessToken: 'b', session: { ...session, warehouseId: 'W2' } });
    expect(select).toHaveBeenCalledWith({ userId: 'p-1', warehouseId: 'W2', ownerId: '' });
  });

  it('a step-up answer without a token keeps the current one', async () => {
    const { auth, http } = setup();
    const signing = auth.signIn({ username: 'ana', password: 'x' });
    await answerLogin(http, { access_token: 'acc-8', session_id: 's-8', principal_id: 'p-1' });
    await signing;
    const verifying = auth.verifyPasscode('111111');
    http.expectOne(`${BASE}/auth/verify-mfa`).flush({});
    await verifying;
    expect(auth.token()).toBe('acc-8');
  });
});
