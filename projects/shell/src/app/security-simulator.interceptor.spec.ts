import {
  HttpClient,
  HttpErrorResponse,
  type HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ReviewCampaign,
  type AccessResult,
  type Actor,
  type Grants,
  type Profile,
  SECURITY_API_URL,
  type SecuritySnapshot,
  type SecurityUser,
  type SessionGrant,
} from '@ewms/core/security';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  resetSimulator,
  securitySimulatorInterceptor,
  setSimulatedSession,
  setSimulatedTaskRunning,
  setSimulatorFailure,
} from './security-simulator.interceptor';

const BASE = '/api/v1/security';
const admin: Actor = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };

/** Lo que haría el interceptor de sesión: el token vigente en cada petición. */
let token: string | null = null;
const bearer: HttpInterceptorFn = (req, next) =>
  next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);

async function rejection(request: Observable<unknown>): Promise<HttpErrorResponse> {
  try {
    await firstValueFrom(request);
  } catch (err) {
    if (err instanceof HttpErrorResponse) return err;
  }
  throw new Error('expected an HTTP error');
}

describe('securitySimulatorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    resetSimulator({ latency: 0 });
    token = null;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([bearer, securitySimulatorInterceptor])),
        provideHttpClientTesting(),
        { provide: SECURITY_API_URL, useValue: signal(BASE) },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('passes requests outside the Security Core through to next', async () => {
    const promise = firstValueFrom(http.get('/api/other'));
    httpMock.expectOne('/api/other').flush({ pass: true });
    expect(await promise).toEqual({ pass: true });
  });

  it('passes everything through while no URL is configured', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([securitySimulatorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const client = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    const promise = firstValueFrom(client.get(`${BASE}/access`));
    backend.expectOne(`${BASE}/access`).flush({ grants: {}, user: null });
    expect(await promise).toEqual({ grants: {}, user: null });
    backend.verify();
  });

  it('without a simulated session denies and never falls back to an administrator', async () => {
    const error = await rejection(http.get(`${BASE}/access`));
    expect(error.status).toBe(401);
    expect((await rejection(http.get(`${BASE}/users`))).status).toBe(401);
  });

  it('takes identity and context from the session, not from what the browser claims', async () => {
    token = setSimulatedSession({ userId: 'reader', warehouseId: 'A', ownerId: 'X' });
    const res = await firstValueFrom(
      http.get<AccessResult>(`${BASE}/access`, {
        headers: { 'X-Actor-User-Id': 'admin' },
        params: { userId: 'admin' },
      }),
    );
    expect(res.user?.id).toBe('reader');
    expect(res.grants['security.profiles:update']).toBeUndefined();
  });

  it('answers access, snapshot, users and inspect for the session', async () => {
    token = setSimulatedSession(admin);
    const access = await firstValueFrom(http.get<AccessResult>(`${BASE}/access`));
    expect(access.user?.id).toBe('admin');
    expect(access.grants['security.users:access']?.length).toBeGreaterThan(0);

    const snapshot = await firstValueFrom(http.get<SecuritySnapshot>(`${BASE}/snapshot`));
    expect(snapshot.users.some((u) => u.id === 'admin')).toBe(true);

    const users = await firstValueFrom(http.get<SecurityUser[]>(`${BASE}/users`));
    expect(users.some((u) => u.id === 'admin')).toBe(true);

    const inspected = await firstValueFrom(
      http.get<Grants>(`${BASE}/inspect`, {
        params: { userId: 'reader', warehouseId: 'A', ownerId: 'X' },
      }),
    );
    expect(inspected['security.users:access']).toBeDefined();
  });

  it('writes profiles, users, status and assignments', async () => {
    token = setSimulatedSession(admin);
    const profile: Profile = {
      id: 'custom-profile',
      name: 'Custom Profile',
      grants: ['general.dashboard:access', 'security.users:access'],
      version: 0,
    };
    await firstValueFrom(http.put(`${BASE}/profiles/custom-profile`, profile));
    let snapshot = await firstValueFrom(http.get<SecuritySnapshot>(`${BASE}/snapshot`));
    expect(snapshot.profiles.some((p) => p.id === 'custom-profile')).toBe(true);

    const user: SecurityUser = {
      id: 'new-user',
      name: 'New Test User',
      active: true,
      version: 0,
      affiliation: 'internal',
    };
    await firstValueFrom(http.put(`${BASE}/users/new-user`, user));
    await firstValueFrom(
      http.patch(`${BASE}/users/new-user/status`, { active: false, version: 1 }),
    );
    const users = await firstValueFrom(http.get<SecurityUser[]>(`${BASE}/users`));
    expect(users.find((u) => u.id === 'new-user')?.active).toBe(false);

    snapshot = await firstValueFrom(http.get<SecuritySnapshot>(`${BASE}/snapshot`));
    const assignments = [
      ...snapshot.assignments.filter((a) => a.userId === 'reader'),
      { userId: 'reader', profileId: 'custom-profile', warehouseId: 'A', ownerId: 'X' },
    ];
    await firstValueFrom(
      http.put(`${BASE}/users/reader/assignments`, {
        assignments,
        version: snapshot.version,
      }),
    );
    snapshot = await firstValueFrom(http.get<SecuritySnapshot>(`${BASE}/snapshot`));
    expect(snapshot.assignments.some((a) => a.profileId === 'custom-profile')).toBe(true);
  });

  it('adds a bulk assignment and rejects the rules of the comanda with a stable type', async () => {
    token = setSimulatedSession(admin);
    let snapshot = await firstValueFrom(http.get<SecuritySnapshot>(`${BASE}/snapshot`));
    const rows = ['reader', 'operator'].map((userId) => ({
      userId,
      profileId: 'audit',
      warehouseId: 'B',
      ownerId: 'Y',
    }));
    await firstValueFrom(
      http.post(`${BASE}/assignments`, { assignments: rows, version: snapshot.version }),
    );
    snapshot = await firstValueFrom(http.get<SecuritySnapshot>(`${BASE}/snapshot`));
    expect(snapshot.assignments.filter((a) => a.profileId === 'audit')).toEqual(rows);

    const own = await rejection(
      http.post(`${BASE}/assignments`, {
        assignments: [{ ...rows[0]!, userId: 'admin' }],
        version: snapshot.version,
      }),
    );
    expect(own.status).toBe(403);
    expect(own.error).toMatchObject({ type: 'urn:ewms:security:selfAssignment' });

    const clash = await rejection(
      http.post(`${BASE}/assignments`, {
        assignments: [{ ...rows[0]!, profileId: 'admin' }],
        version: snapshot.version,
      }),
    );
    expect(clash.status).toBe(409);
    expect(clash.error).toMatchObject({
      type: 'urn:ewms:security:segregation',
      conflicts: ['admin', 'audit'],
    });

    const external = await rejection(
      http.post(`${BASE}/assignments`, {
        assignments: [{ ...rows[0]!, userId: 'external' }],
        version: snapshot.version,
      }),
    );
    expect(external.error).toMatchObject({ type: 'urn:ewms:security:externalAffiliation' });
  });

  it('runs an access review campaign over HTTP', async () => {
    token = setSimulatedSession(admin);
    await firstValueFrom(http.post(`${BASE}/reviews`, { name: 'Q4', dueDate: '2999-12-31' }));
    let [campaign] = await firstValueFrom(http.get<ReviewCampaign[]>(`${BASE}/reviews`));
    const item = campaign!.items.find((i) => i.userId === 'reader')!;
    await firstValueFrom(
      http.post(`${BASE}/reviews/${campaign!.id}/decisions`, {
        assignment: item,
        decision: 'confirm',
        version: campaign!.version,
      }),
    );
    [campaign] = await firstValueFrom(http.get<ReviewCampaign[]>(`${BASE}/reviews`));
    expect(campaign!.items.find((i) => i.userId === 'reader')).toMatchObject({
      decision: 'confirm',
      decidedBy: 'admin',
    });
    const own = await rejection(
      http.post(`${BASE}/reviews/${campaign!.id}/decisions`, {
        assignment: campaign!.items.find((i) => i.userId === 'admin'),
        decision: 'confirm',
        version: campaign!.version,
      }),
    );
    expect(own.error).toMatchObject({ type: 'urn:ewms:security:selfAssignment' });
  });

  it('a closed session denies again', async () => {
    token = setSimulatedSession(admin);
    token = setSimulatedSession(null);
    expect((await rejection(http.get(`${BASE}/access`))).status).toBe(401);
  });

  it('an inspection without a target is invalid', async () => {
    token = setSimulatedSession(admin);
    expect((await rejection(http.get(`${BASE}/inspect`))).status).toBe(400);
  });

  it('an unexpected failure answers as unavailable', async () => {
    token = setSimulatedSession(admin);
    const error = await rejection(http.patch(`${BASE}/users/admin/status`, null));
    expect(error.status).toBe(503);
    expect(error.error).toMatchObject({ type: 'urn:ewms:security:unavailable' });
  });

  it('signs in a known active person in their context and serves them with that token', async () => {
    const grant = await firstValueFrom(
      http.post<SessionGrant>(`${BASE}/session`, { username: 'reader', password: 'demo' }),
    );
    expect(grant.session).toEqual({
      userId: 'reader',
      name: 'Rosa Consulta',
      warehouseId: 'A',
      ownerId: 'X',
    });
    token = grant.accessToken;
    const access = await firstValueFrom(http.get<AccessResult>(`${BASE}/access`));
    expect(access.user?.id).toBe('reader');
  });

  it('rejects unknown, inactive or passwordless sign-ins without saying which', async () => {
    for (const body of [
      { username: 'nobody', password: 'demo' },
      { username: 'inactive', password: 'demo' },
      { username: 'admin', password: '' },
      null,
    ]) {
      const error = await rejection(http.post(`${BASE}/session`, body));
      expect(error.status).toBe(401);
      expect(error.error).toMatchObject({ type: 'urn:ewms:security:invalidCredentials' });
    }
  });

  it('a session answers only to its current token', async () => {
    token = setSimulatedSession(admin);
    const issued = token;
    token = 'forged';
    expect((await rejection(http.get(`${BASE}/users`))).status).toBe(401);
    token = null;
    expect((await rejection(http.get(`${BASE}/users`))).status).toBe(401);
    token = issued;
    expect(await firstValueFrom(http.get(`${BASE}/users`))).toBeDefined();
  });

  it('renews with the session cookie and retires the previous token', async () => {
    expect((await rejection(http.post(`${BASE}/session/refresh`, null))).status).toBe(401);
    const previous = setSimulatedSession({ ...admin, warehouseId: 'B', ownerId: 'Y' });
    const grant = await firstValueFrom(
      http.post<SessionGrant>(`${BASE}/session/refresh`, null),
    );
    expect(grant.accessToken).not.toBe(previous);
    expect(grant.session).toMatchObject({ userId: 'admin', warehouseId: 'B', ownerId: 'Y' });
    token = previous;
    expect((await rejection(http.get(`${BASE}/users`))).status).toBe(401);
    token = grant.accessToken;
    expect(await firstValueFrom(http.get(`${BASE}/users`))).toBeDefined();
  });

  it('signing out ends the session and its renewal', async () => {
    token = setSimulatedSession(admin);
    await firstValueFrom(http.delete(`${BASE}/session`));
    expect((await rejection(http.get(`${BASE}/users`))).status).toBe(401);
    expect((await rejection(http.post(`${BASE}/session/refresh`, null))).status).toBe(401);
  });

  it('lists only the contexts where the person has an assignment', async () => {
    token = setSimulatedSession({ userId: 'operator', warehouseId: 'A', ownerId: 'X' });
    const contexts = await firstValueFrom(http.get(`${BASE}/session/contexts`));
    expect(contexts).toEqual([
      { warehouseId: 'A', ownerId: 'X' },
      { warehouseId: 'B', ownerId: 'Y' },
    ]);
  });

  it('switches the active context of the session and serves the new one', async () => {
    token = setSimulatedSession(admin);
    const grant = await firstValueFrom(
      http.put<SessionGrant>(`${BASE}/session/context`, { warehouseId: 'B', ownerId: 'Y' }),
    );
    expect(grant.session).toMatchObject({ userId: 'admin', warehouseId: 'B', ownerId: 'Y' });
    token = grant.accessToken;
    const snapshot = await firstValueFrom(http.get<SecuritySnapshot>(`${BASE}/snapshot`));
    expect(snapshot.contexts).toBeDefined();
  });

  it('refuses a context without assignment and a change during a running task', async () => {
    token = setSimulatedSession(admin);
    const unknown = await rejection(
      http.put(`${BASE}/session/context`, { warehouseId: 'Z', ownerId: 'Q' }),
    );
    expect(unknown.status).toBe(403);
    setSimulatedTaskRunning(true);
    const locked = await rejection(
      http.put(`${BASE}/session/context`, { warehouseId: 'B', ownerId: 'Y' }),
    );
    expect(locked.status).toBe(409);
    expect(locked.error).toMatchObject({ type: 'urn:ewms:security:taskInProgress' });
    setSimulatedTaskRunning(false);
    const grant = await firstValueFrom(
      http.put<SessionGrant>(`${BASE}/session/context`, { warehouseId: 'B', ownerId: 'Y' }),
    );
    expect(grant.session.warehouseId).toBe('B');
  });

  it('answers unknown routes with 404', async () => {
    token = setSimulatedSession(admin);
    expect((await rejection(http.get(`${BASE}/unknown`))).status).toBe(404);
  });

  it('rejects with RFC 9457 Problem Details and a stable type', async () => {
    token = setSimulatedSession(admin);
    const invalid: Profile = { id: 'bad-profile', name: ' ', grants: ['x'], version: 0 };
    const error = await rejection(http.put(`${BASE}/profiles/bad-profile`, invalid));
    expect(error.status).toBe(400);
    expect(error.headers.get('Content-Type')).toBe('application/problem+json');
    expect(error.error).toMatchObject({ type: 'urn:ewms:security:invalid', code: 'invalid' });
  });

  it('maps each rejection code to its status', async () => {
    token = setSimulatedSession(admin);
    const cases = [
      ['denied', 403],
      ['delegation', 403],
      ['selfEscalation', 403],
      ['conflict', 409],
      ['duplicate', 409],
      ['lastAdmin', 409],
      ['unavailable', 503],
    ] as const;
    for (const [code, status] of cases) {
      setSimulatorFailure(code);
      const error = await rejection(http.get(`${BASE}/users`));
      expect(error.status, code).toBe(status);
      expect(error.error).toMatchObject({ type: `urn:ewms:security:${code}` });
    }
  });
});
