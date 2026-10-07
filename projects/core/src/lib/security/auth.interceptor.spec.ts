import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthSession, SESSION_REQUEST } from './auth-session';
import { authInterceptor } from './auth.interceptor';
import { SECURITY_API_URL } from './security-api-url';

const BASE = '/api/v1/security';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let token: string | null;
  let renew: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    token = 'token-1';
    renew = vi.fn(async () => {
      token = 'token-2';
      return true;
    });
    navigate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: SECURITY_API_URL, useValue: signal(BASE) },
        { provide: AuthSession, useValue: { token: () => token, renew } },
        { provide: Router, useValue: { navigate, url: '/configuracion/usuarios?state=active' } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    TestBed.resetTestingModule();
  });

  const unauthorized = (headers: Record<string, string> = {}) => ({
    status: 401,
    statusText: 'Unauthorized',
    headers,
  });

  it('adds the token only to the Security Core', async () => {
    const own = firstValueFrom(http.get(`${BASE}/users`));
    const other = firstValueFrom(http.get('/i18n/es.json'));
    const lookalike = firstValueFrom(http.get(`${BASE}-other/users`));
    const ownRequest = backend.expectOne(`${BASE}/users`);
    expect(ownRequest.request.headers.get('Authorization')).toBe('Bearer token-1');
    ownRequest.flush([]);
    const otherRequest = backend.expectOne('/i18n/es.json');
    expect(otherRequest.request.headers.has('Authorization')).toBe(false);
    otherRequest.flush({});
    const lookalikeRequest = backend.expectOne(`${BASE}-other/users`);
    expect(lookalikeRequest.request.headers.has('Authorization')).toBe(false);
    lookalikeRequest.flush([]);
    await Promise.all([own, other, lookalike]);
  });

  it('sends nothing extra without a token or for session requests', async () => {
    token = null;
    const anonymous = firstValueFrom(http.get(`${BASE}/users`));
    const anonymousRequest = backend.expectOne(`${BASE}/users`);
    expect(anonymousRequest.request.headers.has('Authorization')).toBe(false);
    anonymousRequest.flush([]);
    token = 'token-1';
    const context = new HttpContext().set(SESSION_REQUEST, true);
    const session = firstValueFrom(http.post(`${BASE}/session/refresh`, null, { context }));
    const sessionRequest = backend.expectOne(`${BASE}/session/refresh`);
    expect(sessionRequest.request.headers.has('Authorization')).toBe(false);
    sessionRequest.flush(null, unauthorized());
    await anonymous;
    await expect(session).rejects.toBeDefined();
    expect(renew).not.toHaveBeenCalled();
  });

  it('a 401 renews once and repeats the request once with the new token', async () => {
    const result = firstValueFrom(http.put(`${BASE}/users/u1`, { name: 'x' }));
    backend.expectOne(`${BASE}/users/u1`).flush(null, unauthorized());
    await vi.waitFor(() => expect(renew).toHaveBeenCalledTimes(1));
    const retry = backend.expectOne(`${BASE}/users/u1`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer token-2');
    expect(retry.request.body).toEqual({ name: 'x' });
    retry.flush({ ok: true });
    expect(await result).toEqual({ ok: true });
  });

  it('a second 401 after renewing is not retried again', async () => {
    const result = firstValueFrom(http.get(`${BASE}/users`));
    backend.expectOne(`${BASE}/users`).flush(null, unauthorized());
    await vi.waitFor(() => expect(renew).toHaveBeenCalledTimes(1));
    backend.expectOne(`${BASE}/users`).flush(null, unauthorized());
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(renew).toHaveBeenCalledTimes(1);
  });

  it('a failed renewal sends the person to sign in and keeps where they were', async () => {
    renew.mockResolvedValue(false);
    const result = firstValueFrom(http.get(`${BASE}/users`));
    backend.expectOne(`${BASE}/users`).flush(null, unauthorized());
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/configuracion/usuarios?state=active' },
    });
  });

  it('leaves a step-up challenge (RFC 9470) and other errors untouched', async () => {
    const stepUp = firstValueFrom(http.post(`${BASE}/users/u1/status`, {}));
    backend.expectOne(`${BASE}/users/u1/status`).flush(
      null,
      unauthorized({
        'WWW-Authenticate': 'Bearer error="insufficient_user_authentication"',
      }),
    );
    await expect(stepUp).rejects.toMatchObject({ status: 401 });
    const forbidden = firstValueFrom(http.get(`${BASE}/users`));
    backend.expectOne(`${BASE}/users`).flush(null, { status: 403, statusText: 'Forbidden' });
    await expect(forbidden).rejects.toMatchObject({ status: 403 });
    expect(renew).not.toHaveBeenCalled();
  });

  it('does nothing while no URL is configured', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { token: () => token, renew } },
      ],
    });
    const client = TestBed.inject(HttpClient);
    const mock = TestBed.inject(HttpTestingController);
    const result = firstValueFrom(client.get(`${BASE}/users`));
    const request = mock.expectOne(`${BASE}/users`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
    await result;
    mock.verify();
    backend = mock;
  });
});
