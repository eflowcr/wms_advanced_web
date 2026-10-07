import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type Actor,
  type Assignment,
  type Profile,
  SecurityError,
  type SecurityRequest,
  type SecuritySnapshot,
  type SecurityUser,
} from './access';
import { HttpSecurityGateway, SECURITY_API_URL } from './http-security-gateway';
import { ACCESS_QUERY } from './security-access.interceptor';

describe('HttpSecurityGateway', () => {
  let gateway: HttpSecurityGateway;
  let httpMock: HttpTestingController;

  const actor: Actor = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };
  const req: SecurityRequest = { actor, signal: new AbortController().signal };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SECURITY_API_URL, useValue: signal('/api/v1/security') },
      ],
    });
    gateway = TestBed.inject(HttpSecurityGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('queries effective access of the server session, marked and without identity', async () => {
    const promise = gateway.access(actor, req.signal);
    const mock = httpMock.expectOne('/api/v1/security/access');
    expect(mock.request.method).toBe('GET');
    expect(mock.request.params.keys()).toEqual([]);
    expect(mock.request.headers.keys().filter((h) => /actor/i.test(h))).toEqual([]);
    expect(mock.request.context.get(ACCESS_QUERY)).toBe(true);

    const expected = {
      grants: { 'users.view': ['admin'] },
      user: { id: 'admin', name: 'Admin', active: true, version: 1 },
    };
    mock.flush(expected);

    const result = await promise;
    expect(result).toEqual(expected);
  });

  it('returns empty access when actor is null without issuing an HTTP request', async () => {
    const result = await gateway.access(null, req.signal);
    expect(result).toEqual({ grants: {}, user: null });
    httpMock.expectNone('/api/v1/security/access');
  });

  it('fetches snapshot via GET /api/v1/security/snapshot', async () => {
    const promise = gateway.snapshot(req);
    const mock = httpMock.expectOne('/api/v1/security/snapshot');
    expect(mock.request.method).toBe('GET');
    expect(mock.request.headers.keys()).toEqual([]);
    expect(mock.request.context.get(ACCESS_QUERY)).toBe(false);

    const snapshot: SecuritySnapshot = {
      version: 1,
      users: [],
      profiles: [],
      assignments: [],
      contexts: [],
    };
    mock.flush(snapshot);

    const result = await promise;
    expect(result).toEqual(snapshot);
  });

  it('fetches inspect grants via GET /api/v1/security/inspect', async () => {
    const target: Actor = { userId: 'reader', warehouseId: 'B', ownerId: 'Y' };
    const promise = gateway.inspect(req, target);
    const mock = httpMock.expectOne(
      (r) =>
        r.url === '/api/v1/security/inspect' &&
        r.method === 'GET' &&
        r.params.get('userId') === 'reader' &&
        r.params.get('warehouseId') === 'B' &&
        r.params.get('ownerId') === 'Y',
    );
    mock.flush({ 'users.view': ['read'] });

    const result = await promise;
    expect(result).toEqual({ 'users.view': ['read'] });
  });

  it('fetches users via GET /api/v1/security/users', async () => {
    const promise = gateway.users(req);
    const mock = httpMock.expectOne('/api/v1/security/users');
    expect(mock.request.method).toBe('GET');

    const users: readonly SecurityUser[] = [
      { id: 'admin', name: 'Admin', active: true, version: 1 },
    ];
    mock.flush(users);

    const result = await promise;
    expect(result).toEqual(users);
  });

  it('saves profile via PUT /api/v1/security/profiles/:id and notifies subscribers', async () => {
    let notified = false;
    const unsub = gateway.subscribe(() => {
      notified = true;
    });

    const profile: Profile = { id: 'prof1', name: 'Profile 1', grants: [], version: 1 };
    const promise = gateway.saveProfile(req, profile);
    const mock = httpMock.expectOne('/api/v1/security/profiles/prof1');
    expect(mock.request.method).toBe('PUT');
    expect(mock.request.body).toEqual(profile);
    mock.flush({ ok: true });

    await promise;
    expect(notified).toBe(true);
    unsub();
  });

  it('sets assignments via PUT /api/v1/security/users/:id/assignments', async () => {
    let notified = false;
    gateway.subscribe(() => {
      notified = true;
    });

    const assignments: readonly Assignment[] = [
      { userId: 'u1', profileId: 'p1', warehouseId: 'A', ownerId: 'X' },
    ];
    const promise = gateway.setAssignments(req, 'u1', assignments, 2);
    const mock = httpMock.expectOne('/api/v1/security/users/u1/assignments');
    expect(mock.request.method).toBe('PUT');
    expect(mock.request.headers.keys()).toEqual([]);
    expect(mock.request.body).toEqual({ assignments, version: 2 });
    mock.flush({ ok: true });

    await promise;
    expect(notified).toBe(true);
  });

  it('saves user via PUT /api/v1/security/users/:id', async () => {
    const user: SecurityUser = { id: 'u1', name: 'User 1', active: true, version: 1 };
    const promise = gateway.saveUser(req, user);
    const mock = httpMock.expectOne('/api/v1/security/users/u1');
    expect(mock.request.method).toBe('PUT');
    expect(mock.request.body).toEqual(user);
    mock.flush({ ok: true });

    await promise;
  });

  it('sets user status via PATCH /api/v1/security/users/:id/status', async () => {
    const promise = gateway.setUserStatus(req, 'u1', false, 3);
    const mock = httpMock.expectOne('/api/v1/security/users/u1/status');
    expect(mock.request.method).toBe('PATCH');
    expect(mock.request.body).toEqual({ active: false, version: 3 });
    mock.flush({ ok: true });

    await promise;
  });

  it('translates RFC 9457 Problem Details into stable SecurityError codes', async () => {
    const testError = async (
      status: number,
      problemBody: Record<string, unknown> | null,
      expectedCode: string,
    ) => {
      const promise = gateway.users(req);
      const mock = httpMock.expectOne('/api/v1/security/users');
      mock.flush(problemBody, {
        status,
        statusText: 'Error',
        headers: { 'Content-Type': 'application/problem+json' },
      });
      await expect(promise).rejects.toEqual(new SecurityError(expectedCode as never));
    };

    await testError(403, { type: 'urn:ewms:security:denied', code: 'denied' }, 'denied');
    await testError(409, { type: 'urn:ewms:security:conflict', code: 'conflict' }, 'conflict');
    await testError(409, { type: 'urn:ewms:security:duplicate', code: 'duplicate' }, 'duplicate');
    await testError(409, { type: 'urn:ewms:security:lastAdmin', code: 'lastAdmin' }, 'lastAdmin');
    await testError(403, { type: 'urn:ewms:security:selfEscalation' }, 'selfEscalation');
    await testError(403, { type: 'urn:ewms:security:delegation' }, 'delegation');
    await testError(400, { type: 'urn:ewms:security:invalid' }, 'invalid');
    await testError(403, null, 'denied');
    await testError(401, null, 'denied');
    await testError(409, null, 'conflict');
    await testError(400, null, 'invalid');
    await testError(500, { type: 'urn:ewms:unknown' }, 'unavailable');
    await testError(500, { code: 'unknown-code' }, 'unavailable');
    await testError(503, null, 'unavailable');
  });

  it('translates AbortError and aborted signal into SecurityError aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(gateway.users({ actor, signal: controller.signal })).rejects.toEqual(
      new SecurityError('aborted'),
    );
    httpMock.expectNone('/api/v1/security/users');

    // Simular un error con name AbortError
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    vi.spyOn(gateway['http'], 'get').mockImplementationOnce(() => {
      throw abortErr;
    });
    await expect(gateway.users(req)).rejects.toEqual(new SecurityError('aborted'));
  });

  it('aborting the signal cancels the request in flight', async () => {
    const controller = new AbortController();
    const promise = gateway.users({ actor, signal: controller.signal });
    const mock = httpMock.expectOne('/api/v1/security/users');
    controller.abort();

    await expect(promise).rejects.toEqual(new SecurityError('aborted'));
    expect(mock.cancelled).toBe(true);
  });

  it('translates unexpected direct errors appropriately', async () => {
    vi.spyOn(gateway['http'], 'get').mockImplementationOnce(() => {
      throw new SecurityError('conflict');
    });
    await expect(gateway.users(req)).rejects.toEqual(new SecurityError('conflict'));

    vi.spyOn(gateway['http'], 'get').mockImplementationOnce(() => {
      throw new TypeError('network error');
    });
    await expect(gateway.users(req)).rejects.toEqual(new SecurityError('unavailable'));
  });
});

describe('HttpSecurityGateway without a configured URL', () => {
  it('rejects as unavailable and sends nothing', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const gateway = TestBed.inject(HttpSecurityGateway);
    const httpMock = TestBed.inject(HttpTestingController);
    const signal = new AbortController().signal;
    const actor: Actor = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };

    expect(TestBed.inject(SECURITY_API_URL)()).toBeUndefined();
    await expect(gateway.access(actor, signal)).rejects.toEqual(new SecurityError('unavailable'));
    await expect(gateway.users({ actor, signal })).rejects.toEqual(
      new SecurityError('unavailable'),
    );
    httpMock.verify();
    TestBed.resetTestingModule();
  });
});
